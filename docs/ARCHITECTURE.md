# Architecture

Lanyard is a [Tauri](https://tauri.app) desktop app (window and tray) plus the `lanyard` CLI. The SSH and git logic is one TypeScript core that both run: the CLI directly, the app through a Node.js sidecar that its Rust shell talks to.

```
src-tauri/        Rust shell (Tauri 2)
│  ├─ src/lib.rs     App setup: window, app menu, single instance, autostart, the api_invoke command
│  ├─ src/router.rs  Which api_invoke calls Rust answers itself and which go to the sidecar
│  ├─ src/native.rs  Desktop concerns in Rust: dialogs, clipboard, opening links, window controls
│  ├─ src/sidecar.rs Runs the Node sidecar; JSON lines over its stdin/stdout
│  ├─ src/tray.rs    Tray icon and menu (the menu's contents come from the sidecar)
│  ├─ binaries/      The Node runtime bundled with the app (fetched, not committed)
│  └─ tauri.conf.json
src/
├─ shared/        Types and the typed API contract (no runtime dependencies)
│  ├─ types.ts      Domain types used by every layer
│  ├─ ipc.ts        LanyardApi interface, channels, bridge type
│  └─ tray-hosts-menu.ts, zoom.ts, validation.ts
├─ core/          Pure Node domain layer, shared by the sidecar and the CLI
│  ├─ ssh-config/   Lossless parser, structured editor, managed section, repository
│  ├─ providers/    Provider registry and `ssh -T` result interpretation
│  ├─ services/     accounts (switching), hosts (CRUD + key switching), settings
│  ├─ api-domain.ts The LanyardApi implementation (everything but desktop concerns)
│  ├─ state/watch.ts Watches ~/.ssh and ~/.lanyard for changes
│  ├─ keys/ known-hosts/ agent/ git/ backups/ terminal/ config/ cli/ utils/
│  └─ index.ts      Facade: the only entry point the sidecar and the CLI use
├─ sidecar/       Node process the Rust shell starts: dispatches requests to the core
├─ cli/           Commander program, one module per command group
└─ renderer/      React UI
   └─ src/
      ├─ app/         Shell, top bar, sidebar, navigation, workspace data
      ├─ components/  ui/ primitives, feedback/ (toasts, confirm), domain/
      ├─ features/    overview, accounts, hosts, keys, agent, known-hosts, backups, settings, palette
      ├─ hooks/       useResource (reloads on file changes), useTask
      ├─ lib/         Typed API client, the Tauri bridge, formatting
      └─ styles/      Design tokens and component styles
```

## Layers

- **`shared`** has no runtime dependencies and is imported by every other layer.
- **`core`** is plain Node.js: no Tauri, no React. It shells out to OpenSSH (`ssh`, `ssh-keygen`, `ssh-add`, `ssh-keyscan`) and git, always without a shell and with argument arrays. Everything goes through `core/index.ts`.
- **`sidecar`** and **`cli`** both depend on `core`, never on each other.
- **`renderer`** never touches Node or the filesystem. It calls the backend through the typed `LanyardApi` client in `lib/api.ts`; `lib/tauri-bridge.ts` carries those calls over Tauri.
- **`src-tauri`** owns the window, the tray, the app menu and other desktop concerns, and forwards everything else to the sidecar.

## Data flow

1. A React component calls `api.accounts.use('github', 'work')`.
2. The Tauri bridge sends it as the `api_invoke` command with `(namespace, method, args)`.
3. `router.rs` decides who answers. Desktop calls (`app.copy`, `app.pickFile`, window controls, ...) are handled in Rust by `native.rs`; everything else goes to the sidecar.
4. `sidecar.rs` writes the request as one JSON line to the sidecar's stdin. The sidecar (`src/sidecar/index.ts`) calls `core.accounts.use`, which rewrites the managed section of `~/.ssh/config` (after a backup) and saves `~/.lanyard/state.json`, then answers with a JSON line carrying the same id.
5. The core's file watcher sees the change; the sidecar emits a `changed` event line, which the shell re-emits to the window and uses to refresh the tray.

The CLI calls the same `core` functions directly, so a change made from the terminal shows up in an open window through step 5.

## The ssh_config editor

`core/ssh-config` parses `~/.ssh/config` into a model that keeps every line's original text: comments, blank lines, indentation and line endings (LF or CRLF). Edits replace only the lines they touch, and serialising an unedited model gives back the file byte for byte. The managed section (between the `lanyard managed section` markers) is regenerated from state on every change; everything else is edited structurally.

## Security model

The window loads only the bundled renderer, under the content security policy in `tauri.conf.json`, and has no Node or filesystem access of its own: besides setting its own zoom level, it can only call the `api_invoke` command. The sidecar only answers the API's own namespaces and methods. Details: [SECURITY.md](../SECURITY.md).

## Build

- **Vite** (`vite.renderer.config.ts`) builds the renderer into `out/renderer`.
- **esbuild** bundles the sidecar into `out/sidecar/index.js` and the CLI into `out/main/cli.js`.
- **`scripts/fetch-node.mjs`** downloads the Node.js runtime for the build target into `src-tauri/binaries`, checked against Node's published checksums.
- **Tauri** compiles the Rust shell and bundles it with the renderer, the sidecar (a resource) and Node (`externalBin`): NSIS on Windows, DMG on macOS, AppImage on Linux. The shell runs the sidecar with that bundled Node, so the app needs no Node install.
- **The npm package `lanyard-ssh`** ships only `bin/` and `out/main/`, so the CLI runs on plain Node.js. The desktop app doesn't include the CLI.
