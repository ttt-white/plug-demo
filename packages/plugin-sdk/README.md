# @tt-plug/plugin-sdk

Runtime APIs and TypeScript contracts for plugins running in the FMS workspace.

## Install

```sh
pnpm add @tt-plug/plugin-sdk
```

The package expects React 19 to be provided by the host application.

## Usage

```ts
import { PLUGIN_API_VERSION, type WorkspacePlugin } from '@tt-plug/plugin-sdk';

const plugin: WorkspacePlugin = {
  manifest: {
    id: 'example',
    name: 'Example plugin',
    version: '1.0.0',
    apiVersion: PLUGIN_API_VERSION,
  },
};
```
