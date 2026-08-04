import { satisfies, valid, validRange } from 'semver';
import { z } from 'zod';
import type {
  PluginComponentLoader,
  PluginDiagnostic,
  PluginDiagnosticStage,
  PluginPackageDescriptor,
  PluginPackageMetadata,
  PluginRegistration,
  PluginRouteContribution,
  PluginValidationOptions,
  PluginVersionRequirement,
  WorkspacePlugin,
} from './index';
import { PLUGIN_API_VERSION } from './index';

const nonEmptyStructureString = z.string();
const componentLoaderSchema = z.custom<PluginComponentLoader>((value) => typeof value === 'function', '必须是函数');
const menuSchema = z
  .object({
    label: nonEmptyStructureString,
    icon: z.string().optional(),
    order: z.number().finite(),
  })
  .strict();
const routeReferenceSchema = z
  .object({
    pluginId: nonEmptyStructureString,
    routeId: nonEmptyStructureString,
  })
  .passthrough();
const versionRequirementSchema = z
  .object({
    id: nonEmptyStructureString,
    range: nonEmptyStructureString,
    optional: z.boolean().optional(),
  })
  .strict();
const capabilitySchema = z
  .object({
    id: nonEmptyStructureString,
    version: nonEmptyStructureString,
  })
  .strict();
const pluginSchema = z
  .object({
    manifest: z
      .object({
        id: nonEmptyStructureString,
        name: nonEmptyStructureString,
        version: nonEmptyStructureString,
        apiVersion: z.number().int(),
        description: z.string().optional(),
        requires: z
          .object({
            plugins: z.array(versionRequirementSchema).optional(),
            capabilities: z.array(versionRequirementSchema).optional(),
          })
          .strict()
          .optional(),
        provides: z
          .object({
            capabilities: z.array(capabilitySchema).optional(),
          })
          .strict()
          .optional(),
      })
      .strict(),
    routes: z
      .array(
        z
          .object({
            id: nonEmptyStructureString,
            path: nonEmptyStructureString,
            permission: nonEmptyStructureString,
            menu: menuSchema,
            load: componentLoaderSchema,
          })
          .strict(),
      )
      .optional(),
    routeLinks: z
      .array(
        z
          .object({
            id: nonEmptyStructureString,
            parentRoute: routeReferenceSchema,
            targetRoute: routeReferenceSchema,
            permission: z.string().optional(),
            menu: menuSchema,
          })
          .strict(),
      )
      .optional(),
    modules: z
      .array(
        z
          .object({
            id: nonEmptyStructureString,
            routeId: nonEmptyStructureString,
            slotId: nonEmptyStructureString,
            targetPluginId: z.string().optional(),
            permission: z.string().optional(),
            priority: z.number().finite().optional(),
            load: componentLoaderSchema,
          })
          .strict(),
      )
      .optional(),
    extensionSlots: z
      .array(
        z
          .object({
            id: nonEmptyStructureString,
            routeId: nonEmptyStructureString,
            ownerModuleId: z.string().optional(),
            description: z.string().optional(),
          })
          .strict(),
      )
      .optional(),
  })
  .strict();

interface ValidationRecord {
  index: number;
  source: PluginPackageMetadata;
  plugin: WorkspacePlugin | null;
  diagnostics: PluginDiagnostic[];
}

interface LoadedCandidate {
  index: number;
  source: PluginPackageMetadata;
  value: unknown;
  diagnostics?: readonly PluginDiagnostic[];
}

function createDiagnostic(
  code: string,
  stage: PluginDiagnosticStage,
  message: string,
  path?: string,
  severity: PluginDiagnostic['severity'] = 'error',
): PluginDiagnostic {
  return { code, stage, severity, message, ...(path ? { path } : {}) };
}

function diagnosticKey(diagnostic: PluginDiagnostic) {
  return `${diagnostic.stage}\0${diagnostic.code}\0${diagnostic.path ?? ''}\0${diagnostic.message}`;
}

function addDiagnostic(record: ValidationRecord, diagnostic: PluginDiagnostic) {
  const key = diagnosticKey(diagnostic);
  if (record.diagnostics.some((item) => diagnosticKey(item) === key)) return false;
  record.diagnostics.push(diagnostic);
  return true;
}

function hasErrors(record: ValidationRecord) {
  return record.diagnostics.some((diagnostic) => diagnostic.severity === 'error');
}

function finalize(record: ValidationRecord): PluginRegistration {
  const diagnostics = [...record.diagnostics];
  const errors = diagnostics.filter((diagnostic) => diagnostic.severity === 'error').map((diagnostic) => diagnostic.message);
  if (record.plugin && errors.length === 0) {
    return { source: record.source, plugin: record.plugin, status: 'ready', diagnostics, errors };
  }
  return { source: record.source, plugin: record.plugin, status: 'error', diagnostics, errors };
}

function sourceForInlinePlugin(value: unknown, index: number): PluginPackageMetadata {
  const manifest =
    typeof value === 'object' && value !== null && 'manifest' in value && typeof value.manifest === 'object' && value.manifest
      ? value.manifest
      : null;
  const id = manifest && 'id' in manifest && typeof manifest.id === 'string' && manifest.id.trim() ? manifest.id : String(index);
  const version = manifest && 'version' in manifest && typeof manifest.version === 'string' ? manifest.version : 'unknown';
  return { packageName: `inline:${id}`, packageVersion: version };
}

function parseCandidates(candidates: readonly LoadedCandidate[]) {
  return candidates.map<ValidationRecord>((candidate) => {
    const diagnostics = [...(candidate.diagnostics ?? [])];
    const parsed = pluginSchema.safeParse(candidate.value);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const path = issue.path.length > 0 ? issue.path.map(String).join('.') : 'plugin';
        diagnostics.push(createDiagnostic('PLUGIN_SCHEMA_INVALID', 'schema', `插件结构无效：${path} ${issue.message}`, path));
      }
      return { index: candidate.index, source: candidate.source, plugin: null, diagnostics };
    }
    return { index: candidate.index, source: candidate.source, plugin: parsed.data as WorkspacePlugin, diagnostics };
  });
}

function recordsByPluginId(records: readonly ValidationRecord[]) {
  const result = new Map<string, ValidationRecord[]>();
  for (const record of records) {
    if (!record.plugin) continue;
    const id = record.plugin.manifest.id;
    result.set(id, [...(result.get(id) ?? []), record]);
  }
  return result;
}

function markGlobalDuplicates(
  records: readonly ValidationRecord[],
  selectIds: (plugin: WorkspacePlugin) => readonly string[],
  code: string,
  message: (id: string) => string,
  path: string,
) {
  const owners = new Map<string, ValidationRecord[]>();
  for (const record of records) {
    if (!record.plugin) continue;
    for (const id of selectIds(record.plugin)) owners.set(id, [...(owners.get(id) ?? []), record]);
  }
  for (const [id, duplicateOwners] of owners) {
    if (duplicateOwners.length < 2) continue;
    for (const owner of duplicateOwners) addDiagnostic(owner, createDiagnostic(code, 'contribution', message(id), path));
  }
}

function validatePackageCompatibility(record: ValidationRecord) {
  const { plugin, source } = record;
  if (!plugin) return;
  const { manifest } = plugin;

  if (!manifest.id.trim())
    addDiagnostic(record, createDiagnostic('PLUGIN_ID_EMPTY', 'schema', '插件 ID 不能为空', 'manifest.id'));
  if (!manifest.name.trim())
    addDiagnostic(record, createDiagnostic('PLUGIN_NAME_EMPTY', 'schema', '插件名称不能为空', 'manifest.name'));
  if ((manifest.apiVersion as number) !== PLUGIN_API_VERSION) {
    addDiagnostic(
      record,
      createDiagnostic(
        'PLUGIN_API_VERSION_UNSUPPORTED',
        'compatibility',
        `不支持的 API 版本：${String(manifest.apiVersion)}`,
        'manifest.apiVersion',
      ),
    );
  }
  if (!valid(manifest.version)) {
    addDiagnostic(
      record,
      createDiagnostic(
        'PLUGIN_VERSION_INVALID',
        'compatibility',
        `插件版本不是有效 SemVer：${manifest.version}`,
        'manifest.version',
      ),
    );
  }
  if (typeof source.declaredPluginId === 'string' && source.declaredPluginId !== manifest.id) {
    addDiagnostic(
      record,
      createDiagnostic(
        'PACKAGE_PLUGIN_ID_MISMATCH',
        'compatibility',
        `包元数据插件 ID ${source.declaredPluginId} 与 manifest ID ${manifest.id} 不一致`,
        'manifest.id',
      ),
    );
  }
  if (typeof source.declaredApiVersion === 'number' && source.declaredApiVersion !== manifest.apiVersion) {
    addDiagnostic(
      record,
      createDiagnostic(
        'PACKAGE_API_VERSION_MISMATCH',
        'compatibility',
        `包元数据 API 版本 ${source.declaredApiVersion} 与 manifest API 版本 ${manifest.apiVersion} 不一致`,
        'manifest.apiVersion',
      ),
    );
  }
  if (valid(source.packageVersion) && source.packageVersion !== manifest.version) {
    addDiagnostic(
      record,
      createDiagnostic(
        'PACKAGE_VERSION_MISMATCH',
        'compatibility',
        `包版本 ${source.packageVersion} 与 manifest 版本 ${manifest.version} 不一致`,
        'manifest.version',
      ),
    );
  }
}

function validateRequirementList(record: ValidationRecord, requirements: readonly PluginVersionRequirement[], path: string) {
  const seen = new Set<string>();
  for (const [index, requirement] of requirements.entries()) {
    const itemPath = `${path}.${index}`;
    if (!requirement.id.trim()) {
      addDiagnostic(record, createDiagnostic('REQUIREMENT_ID_EMPTY', 'dependency', '依赖 ID 不能为空', `${itemPath}.id`));
    }
    if (seen.has(requirement.id)) {
      addDiagnostic(
        record,
        createDiagnostic('REQUIREMENT_DUPLICATE', 'dependency', `依赖重复：${requirement.id}`, `${itemPath}.id`),
      );
    }
    seen.add(requirement.id);
    if (!requirement.range.trim() || !validRange(requirement.range)) {
      addDiagnostic(
        record,
        createDiagnostic(
          'REQUIREMENT_RANGE_INVALID',
          'dependency',
          `依赖 ${requirement.id} 的版本范围无效：${requirement.range}`,
          `${itemPath}.range`,
        ),
      );
    }
  }
}

function validateManifestDependencies(record: ValidationRecord) {
  if (!record.plugin) return;
  const { manifest } = record.plugin;
  const pluginRequirements = manifest.requires?.plugins ?? [];
  const capabilityRequirements = manifest.requires?.capabilities ?? [];
  validateRequirementList(record, pluginRequirements, 'manifest.requires.plugins');
  validateRequirementList(record, capabilityRequirements, 'manifest.requires.capabilities');

  const seenCapabilities = new Set<string>();
  for (const [index, capability] of (manifest.provides?.capabilities ?? []).entries()) {
    const path = `manifest.provides.capabilities.${index}`;
    if (!capability.id.trim()) {
      addDiagnostic(record, createDiagnostic('CAPABILITY_ID_EMPTY', 'dependency', '能力 ID 不能为空', `${path}.id`));
    }
    if (seenCapabilities.has(capability.id)) {
      addDiagnostic(record, createDiagnostic('CAPABILITY_DUPLICATE', 'dependency', `能力重复：${capability.id}`, `${path}.id`));
    }
    seenCapabilities.add(capability.id);
    if (!valid(capability.version)) {
      addDiagnostic(
        record,
        createDiagnostic(
          'CAPABILITY_VERSION_INVALID',
          'dependency',
          `能力 ${capability.id} 的版本不是有效 SemVer：${capability.version}`,
          `${path}.version`,
        ),
      );
    }
  }
}

function validateContributionShapes(records: readonly ValidationRecord[], options: PluginValidationOptions) {
  const reservedPaths = new Set(options.reservedPaths);
  const pluginsById = recordsByPluginId(records);
  const routesByTarget = new Map<string, Array<{ record: ValidationRecord; route: PluginRouteContribution }>>();
  for (const record of records) {
    if (!record.plugin) continue;
    for (const route of record.plugin.routes ?? []) {
      const key = `${record.plugin.manifest.id}\0${route.id}`;
      routesByTarget.set(key, [...(routesByTarget.get(key) ?? []), { record, route }]);
    }
  }

  for (const record of records) {
    const plugin = record.plugin;
    if (!plugin) continue;
    const seenExtensionSlots = new Set<string>();
    for (const [index, slot] of (plugin.extensionSlots ?? []).entries()) {
      const path = `extensionSlots.${index}`;
      const key = `${slot.routeId}\0${slot.id}`;
      if (seenExtensionSlots.has(key)) {
        addDiagnostic(
          record,
          createDiagnostic('EXTENSION_SLOT_DUPLICATE', 'contribution', `扩展插槽重复：${slot.routeId}/${slot.id}`, path),
        );
      }
      seenExtensionSlots.add(key);
      if (!slot.id.trim()) {
        addDiagnostic(record, createDiagnostic('EXTENSION_SLOT_ID_EMPTY', 'contribution', '扩展插槽 ID 不能为空', `${path}.id`));
      }
      const ownsRoute = plugin.routes?.some((route) => route.id === slot.routeId);
      const usesHostRoute = Object.hasOwn(options.knownSlots, slot.routeId);
      if (!ownsRoute && !usesHostRoute) {
        addDiagnostic(
          record,
          createDiagnostic(
            'EXTENSION_SLOT_ROUTE_UNKNOWN',
            'contribution',
            `扩展插槽使用未知路由：${slot.routeId}/${slot.id}`,
            `${path}.routeId`,
          ),
        );
      }
      if (slot.ownerModuleId) {
        const ownerModule = plugin.modules?.find((module) => module.id === slot.ownerModuleId);
        if (!ownerModule) {
          addDiagnostic(
            record,
            createDiagnostic(
              'EXTENSION_SLOT_OWNER_MISSING',
              'contribution',
              `扩展插槽所属模块不存在：${slot.ownerModuleId}`,
              `${path}.ownerModuleId`,
            ),
          );
        } else if (ownerModule.routeId !== slot.routeId) {
          addDiagnostic(
            record,
            createDiagnostic(
              'EXTENSION_SLOT_OWNER_ROUTE_MISMATCH',
              'contribution',
              `扩展插槽与所属模块路由不一致：${slot.id}`,
              `${path}.routeId`,
            ),
          );
        }
      }
    }

    for (const [index, route] of (plugin.routes ?? []).entries()) {
      const path = `routes.${index}`;
      if (!route.id.trim())
        addDiagnostic(record, createDiagnostic('ROUTE_ID_EMPTY', 'contribution', '路由 ID 不能为空', `${path}.id`));
      if (!route.path.startsWith('/')) {
        addDiagnostic(
          record,
          createDiagnostic('ROUTE_PATH_NOT_ABSOLUTE', 'contribution', `路由必须使用绝对路径：${route.path}`, `${path}.path`),
        );
      }
      if (route.path === '/' || route.path.includes('?') || route.path.includes('#') || route.path.includes('//')) {
        addDiagnostic(
          record,
          createDiagnostic('ROUTE_PATH_INVALID', 'contribution', `路由路径格式无效：${route.path}`, `${path}.path`),
        );
      }
      if (reservedPaths.has(route.path)) {
        addDiagnostic(
          record,
          createDiagnostic('ROUTE_PATH_RESERVED', 'contribution', `路由为宿主保留路由：${route.path}`, `${path}.path`),
        );
      }
      if (!route.permission.trim()) {
        addDiagnostic(
          record,
          createDiagnostic('ROUTE_PERMISSION_EMPTY', 'contribution', `路由缺少权限码：${route.id}`, `${path}.permission`),
        );
      }
      if (!route.menu.label.trim()) {
        addDiagnostic(
          record,
          createDiagnostic('ROUTE_MENU_LABEL_EMPTY', 'contribution', `路由菜单文案不能为空：${route.id}`, `${path}.menu.label`),
        );
      }
    }

    for (const [index, routeLink] of (plugin.routeLinks ?? []).entries()) {
      const path = `routeLinks.${index}`;
      if (!routeLink.id.trim()) {
        addDiagnostic(record, createDiagnostic('ROUTE_LINK_ID_EMPTY', 'contribution', '路由入口 ID 不能为空', `${path}.id`));
      }
      const parentTargets = routesByTarget.get(`${routeLink.parentRoute.pluginId}\0${routeLink.parentRoute.routeId}`) ?? [];
      if (parentTargets.length !== 1) {
        addDiagnostic(
          record,
          createDiagnostic(
            'ROUTE_LINK_PARENT_INVALID',
            'contribution',
            `父路由不存在或不唯一：${routeLink.parentRoute.pluginId}/${routeLink.parentRoute.routeId}`,
            `${path}.parentRoute`,
          ),
        );
      }
      const targetRoutes = routesByTarget.get(`${routeLink.targetRoute.pluginId}\0${routeLink.targetRoute.routeId}`) ?? [];
      if (targetRoutes.length !== 1) {
        addDiagnostic(
          record,
          createDiagnostic(
            'ROUTE_LINK_TARGET_INVALID',
            'contribution',
            `跳转路由不存在或不唯一：${routeLink.targetRoute.pluginId}/${routeLink.targetRoute.routeId}`,
            `${path}.targetRoute`,
          ),
        );
      }
      if (routeLink.permission !== undefined && !routeLink.permission.trim()) {
        addDiagnostic(
          record,
          createDiagnostic(
            'ROUTE_LINK_PERMISSION_EMPTY',
            'contribution',
            `路由入口权限码不能为空：${routeLink.id}`,
            `${path}.permission`,
          ),
        );
      }
    }

    for (const [index, module] of (plugin.modules ?? []).entries()) {
      const path = `modules.${index}`;
      if (!module.id.trim())
        addDiagnostic(record, createDiagnostic('MODULE_ID_EMPTY', 'contribution', '模块 ID 不能为空', `${path}.id`));
      if (module.permission !== undefined && !module.permission.trim()) {
        addDiagnostic(
          record,
          createDiagnostic('MODULE_PERMISSION_EMPTY', 'contribution', `模块权限码不能为空：${module.id}`, `${path}.permission`),
        );
      }
      if (module.targetPluginId) {
        const targetPlugins = pluginsById.get(module.targetPluginId) ?? [];
        if (targetPlugins.length !== 1) {
          addDiagnostic(
            record,
            createDiagnostic(
              'MODULE_TARGET_PLUGIN_INVALID',
              'contribution',
              `目标插件不存在或不唯一：${module.targetPluginId}`,
              `${path}.targetPluginId`,
            ),
          );
        } else {
          const targetPlugin = targetPlugins[0]?.plugin;
          const targetSlot = targetPlugin?.extensionSlots?.some(
            (slot) => slot.routeId === module.routeId && slot.id === module.slotId,
          );
          if (!targetSlot) {
            addDiagnostic(
              record,
              createDiagnostic(
                'MODULE_TARGET_SLOT_MISSING',
                'contribution',
                `目标插件未开放插槽：${module.targetPluginId}/${module.routeId}/${module.slotId}`,
                `${path}.slotId`,
              ),
            );
          }
        }
      } else {
        const slots = options.knownSlots[module.routeId];
        if (!slots?.includes(module.slotId)) {
          addDiagnostic(
            record,
            createDiagnostic(
              'MODULE_HOST_SLOT_UNKNOWN',
              'contribution',
              `未知插槽：${module.routeId}/${module.slotId}`,
              `${path}.slotId`,
            ),
          );
        }
      }
    }
  }

  markGlobalDuplicates(
    records,
    (plugin) => [plugin.manifest.id],
    'PLUGIN_ID_DUPLICATE',
    (id) => `插件 ID 重复：${id}`,
    'manifest.id',
  );
  markGlobalDuplicates(
    records,
    (plugin) => plugin.routes?.map((route) => route.id) ?? [],
    'ROUTE_ID_DUPLICATE',
    (id) => `路由 ID 重复：${id}`,
    'routes',
  );
  markGlobalDuplicates(
    records,
    (plugin) => plugin.routes?.map((route) => route.path) ?? [],
    'ROUTE_PATH_DUPLICATE',
    (path) => `路由路径重复：${path}`,
    'routes',
  );
  markGlobalDuplicates(
    records,
    (plugin) => plugin.routeLinks?.map((routeLink) => routeLink.id) ?? [],
    'ROUTE_LINK_ID_DUPLICATE',
    (id) => `路由入口 ID 重复：${id}`,
    'routeLinks',
  );
  markGlobalDuplicates(
    records,
    (plugin) => plugin.modules?.map((module) => module.id) ?? [],
    'MODULE_ID_DUPLICATE',
    (id) => `模块 ID 重复：${id}`,
    'modules',
  );

  return { pluginsById, routesByTarget };
}

function markDependencyCycles(records: readonly ValidationRecord[], pluginsById: ReadonlyMap<string, ValidationRecord[]>) {
  const uniqueRecords = new Map(
    [...pluginsById].flatMap(([id, owners]) => (owners.length === 1 && owners[0] ? [[id, owners[0]] as const] : [])),
  );
  const state = new Map<string, 'visiting' | 'visited'>();
  const stack: string[] = [];

  function visit(id: string) {
    state.set(id, 'visiting');
    stack.push(id);
    const record = uniqueRecords.get(id);
    for (const requirement of record?.plugin?.manifest.requires?.plugins ?? []) {
      if (
        requirement.optional ||
        !requirement.range.trim() ||
        !validRange(requirement.range) ||
        requirement.id === id ||
        !uniqueRecords.has(requirement.id)
      )
        continue;
      if (state.get(requirement.id) === 'visiting') {
        const cycleStart = stack.indexOf(requirement.id);
        const cycle = [...stack.slice(cycleStart), requirement.id];
        for (const cycleId of new Set(cycle)) {
          const cycleRecord = uniqueRecords.get(cycleId);
          if (cycleRecord) {
            addDiagnostic(
              cycleRecord,
              createDiagnostic(
                'PLUGIN_DEPENDENCY_CYCLE',
                'dependency',
                `检测到必选插件依赖循环：${cycle.join(' -> ')}`,
                'manifest.requires.plugins',
              ),
            );
          }
        }
      } else if (!state.has(requirement.id)) {
        visit(requirement.id);
      }
    }
    stack.pop();
    state.set(id, 'visited');
  }

  for (const record of records) {
    const id = record.plugin?.manifest.id;
    if (id && !state.has(id) && uniqueRecords.has(id)) visit(id);
  }
}

function requirementDiagnostic(
  code: string,
  message: string,
  path: string,
  requirement: PluginVersionRequirement,
): PluginDiagnostic {
  return createDiagnostic(code, 'dependency', message, path, requirement.optional ? 'warning' : 'error');
}

function resolveDependencies(
  records: readonly ValidationRecord[],
  pluginsById: ReadonlyMap<string, ValidationRecord[]>,
  routesByTarget: ReadonlyMap<string, Array<{ record: ValidationRecord; route: PluginRouteContribution }>>,
) {
  markDependencyCycles(records, pluginsById);
  let changed = true;
  while (changed) {
    changed = false;
    for (const record of records) {
      const plugin = record.plugin;
      if (!plugin) continue;

      for (const [index, requirement] of (plugin.manifest.requires?.plugins ?? []).entries()) {
        const path = `manifest.requires.plugins.${index}`;
        if (requirement.id === plugin.manifest.id) {
          changed =
            addDiagnostic(
              record,
              requirementDiagnostic('PLUGIN_SELF_DEPENDENCY', `插件不能依赖自身：${requirement.id}`, `${path}.id`, requirement),
            ) || changed;
          continue;
        }
        if (!requirement.range.trim() || !validRange(requirement.range)) continue;
        const targets = pluginsById.get(requirement.id) ?? [];
        const target = targets.length === 1 ? targets[0] : undefined;
        const targetPlugin = target?.plugin;
        if (!target || !targetPlugin) {
          changed =
            addDiagnostic(
              record,
              requirementDiagnostic(
                'REQUIRED_PLUGIN_MISSING',
                `${requirement.optional ? '可选' : '必选'}插件不存在或不唯一：${requirement.id}`,
                `${path}.id`,
                requirement,
              ),
            ) || changed;
          continue;
        }
        if (!satisfies(targetPlugin.manifest.version, requirement.range, { includePrerelease: true })) {
          changed =
            addDiagnostic(
              record,
              requirementDiagnostic(
                'REQUIRED_PLUGIN_VERSION_UNSATISFIED',
                `插件 ${requirement.id}@${targetPlugin.manifest.version} 不满足版本范围 ${requirement.range}`,
                `${path}.range`,
                requirement,
              ),
            ) || changed;
        } else if (hasErrors(target)) {
          changed =
            addDiagnostic(
              record,
              requirementDiagnostic(
                'REQUIRED_PLUGIN_UNAVAILABLE',
                `${requirement.optional ? '可选' : '必选'}插件注册失败：${requirement.id}`,
                `${path}.id`,
                requirement,
              ),
            ) || changed;
        }
      }

      const capabilities = records.flatMap((provider) =>
        (provider.plugin?.manifest.provides?.capabilities ?? []).map((capability) => ({ provider, capability })),
      );
      for (const [index, requirement] of (plugin.manifest.requires?.capabilities ?? []).entries()) {
        if (!requirement.range.trim() || !validRange(requirement.range)) continue;
        const path = `manifest.requires.capabilities.${index}`;
        const matching = capabilities.filter(
          ({ capability }) =>
            capability.id === requirement.id &&
            Boolean(valid(capability.version)) &&
            satisfies(capability.version, requirement.range, { includePrerelease: true }),
        );
        if (!matching.some(({ provider }) => !hasErrors(provider))) {
          changed =
            addDiagnostic(
              record,
              requirementDiagnostic(
                matching.length > 0 ? 'REQUIRED_CAPABILITY_UNAVAILABLE' : 'REQUIRED_CAPABILITY_MISSING',
                `${requirement.optional ? '可选' : '必选'}能力不可用：${requirement.id}@${requirement.range}`,
                `${path}.id`,
                requirement,
              ),
            ) || changed;
        }
      }

      for (const [index, routeLink] of (plugin.routeLinks ?? []).entries()) {
        const references = [
          { label: '父路由', reference: routeLink.parentRoute, path: `routeLinks.${index}.parentRoute` },
          { label: '跳转路由', reference: routeLink.targetRoute, path: `routeLinks.${index}.targetRoute` },
        ];
        for (const reference of references) {
          const targets = routesByTarget.get(`${reference.reference.pluginId}\0${reference.reference.routeId}`) ?? [];
          if (targets.length === 1 && targets[0] && hasErrors(targets[0].record)) {
            changed =
              addDiagnostic(
                record,
                createDiagnostic(
                  'ROUTE_LINK_PLUGIN_UNAVAILABLE',
                  'dependency',
                  `${reference.label}所属插件注册失败：${reference.reference.pluginId}`,
                  reference.path,
                ),
              ) || changed;
          }
        }
      }

      for (const [index, module] of (plugin.modules ?? []).entries()) {
        if (!module.targetPluginId) continue;
        const targets = pluginsById.get(module.targetPluginId) ?? [];
        if (targets.length === 1 && targets[0] && hasErrors(targets[0])) {
          changed =
            addDiagnostic(
              record,
              createDiagnostic(
                'MODULE_TARGET_PLUGIN_UNAVAILABLE',
                'dependency',
                `模块目标插件注册失败：${module.targetPluginId}`,
                `modules.${index}.targetPluginId`,
              ),
            ) || changed;
        }
      }
    }
  }
}

function validateLoadedCandidates(candidates: readonly LoadedCandidate[], options: PluginValidationOptions) {
  const records = parseCandidates(candidates);
  for (const record of records) {
    validatePackageCompatibility(record);
    validateManifestDependencies(record);
  }
  const indexes = validateContributionShapes(records, options);
  resolveDependencies(records, indexes.pluginsById, indexes.routesByTarget);
  return records.sort((left, right) => left.index - right.index).map(finalize);
}

function validateDescriptorMetadata(descriptor: PluginPackageDescriptor) {
  const diagnostics = [...(descriptor.diagnostics ?? [])];
  const { metadata } = descriptor;
  if (!metadata.packageName.trim()) {
    diagnostics.push(createDiagnostic('PACKAGE_NAME_EMPTY', 'discovery', '插件包名不能为空', 'packageName'));
  }
  if (!valid(metadata.packageVersion)) {
    diagnostics.push(
      createDiagnostic(
        'PACKAGE_VERSION_INVALID',
        'compatibility',
        `包版本不是有效 SemVer：${metadata.packageVersion}`,
        'packageVersion',
      ),
    );
  }
  if (typeof metadata.declaredPluginId !== 'string' || !metadata.declaredPluginId.trim()) {
    diagnostics.push(createDiagnostic('PACKAGE_PLUGIN_ID_INVALID', 'discovery', 'fmsPlugin.id 必须是非空字符串', 'fmsPlugin.id'));
  }
  if (typeof metadata.declaredApiVersion !== 'number' || !Number.isInteger(metadata.declaredApiVersion)) {
    diagnostics.push(
      createDiagnostic('PACKAGE_API_VERSION_INVALID', 'discovery', 'fmsPlugin.apiVersion 必须是整数', 'fmsPlugin.apiVersion'),
    );
  } else if (metadata.declaredApiVersion !== PLUGIN_API_VERSION) {
    diagnostics.push(
      createDiagnostic(
        'PACKAGE_API_VERSION_UNSUPPORTED',
        'compatibility',
        `插件包声明了不受支持的 API 版本：${metadata.declaredApiVersion}`,
        'fmsPlugin.apiVersion',
      ),
    );
  }
  return diagnostics;
}

/** 安全校验任意运行时插件输入；畸形对象只产生注册诊断，不会抛出异常。 */
export function validatePlugins(plugins: readonly unknown[], options: PluginValidationOptions): PluginRegistration[] {
  return validateLoadedCandidates(
    plugins.map((value, index) => ({ index, source: sourceForInlinePlugin(value, index), value })),
    options,
  );
}

/** 并行隔离加载所有已发现插件，并按描述符顺序返回完整注册诊断。 */
export async function loadPluginRegistrations(
  descriptors: readonly PluginPackageDescriptor[],
  options: PluginValidationOptions,
): Promise<PluginRegistration[]> {
  const descriptorDiagnostics = descriptors.map(validateDescriptorMetadata);
  const settled = await Promise.allSettled(
    descriptors.map((descriptor, index) =>
      descriptorDiagnostics[index]?.some((diagnostic) => diagnostic.severity === 'error')
        ? Promise.resolve(undefined)
        : Promise.resolve().then(() => descriptor.load()),
    ),
  );
  const loaded: LoadedCandidate[] = [];
  const preflightResults = new Map<number, PluginRegistration>();

  for (const [index, descriptor] of descriptors.entries()) {
    const diagnostics = descriptorDiagnostics[index] ?? [];
    if (diagnostics.some((diagnostic) => diagnostic.severity === 'error')) {
      preflightResults.set(index, finalize({ index, source: descriptor.metadata, plugin: null, diagnostics }));
      continue;
    }
    const result = settled[index];
    if (!result || result.status === 'rejected') {
      const reason = result?.status === 'rejected' ? result.reason : new Error('插件加载没有返回结果');
      const message = reason instanceof Error ? reason.message : String(reason);
      preflightResults.set(
        index,
        finalize({
          index,
          source: descriptor.metadata,
          plugin: null,
          diagnostics: [...diagnostics, createDiagnostic('PLUGIN_LOAD_FAILED', 'load', `插件包加载失败：${message}`)],
        }),
      );
      continue;
    }
    loaded.push({ index, source: descriptor.metadata, value: result.value, diagnostics });
  }

  const validated = validateLoadedCandidates(loaded, options);
  const validatedByIndex = new Map(loaded.map((candidate, index) => [candidate.index, validated[index]]));
  return descriptors.map((_, index) => {
    const registration = preflightResults.get(index) ?? validatedByIndex.get(index);
    if (!registration) throw new Error(`插件注册结果缺失：${index}`);
    return registration;
  });
}
