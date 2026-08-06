# @tt-plug/plugin-contracts

Shared host routes, slots, channels, and data contracts for the plugin material management system.

## Install

```sh
pnpm add @tt-plug/plugin-contracts @tt-plug/plugin-sdk
```

Keep the contracts and SDK versions compatible with the host application.

## Usage

```ts
import { twoContract, workspaceContract } from '@tt-plug/plugin-contracts';

const pluginRoute = twoContract.routes.page;
const publicChannel = workspaceContract.channels.publicMessage;
```

The package only ships contracts for plugins that live under the host repository's `plugins/` directory; the export barrel is generated from that directory. A plugin developed in its own repository declares its contract locally instead — see `plugin-development.md` in the host repository.
