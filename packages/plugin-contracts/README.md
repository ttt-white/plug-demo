# @tt-plug/plugin-contracts

Shared host routes, slots, channels, and data contracts for the FMS workspace.

## Install

```sh
pnpm add @tt-plug/plugin-contracts @tt-plug/plugin-sdk
```

Keep the contracts and SDK versions compatible with the host application.

## Usage

```ts
import { threeContract, workspaceContract } from '@tt-plug/plugin-contracts';

const pluginRoute = threeContract.routes.page;
const publicChannel = workspaceContract.channels.publicMessage;
```
