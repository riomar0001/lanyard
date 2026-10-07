# Security

Lanyard edits `~/.ssh/config`, generates and moves private keys, edits
`known_hosts`, sets global git config and, on Windows, writes the user `PATH`.
A bug here can lock you out of servers or expose a key, so this file records
the threat model, the audit behind the current code, and what is left open.

## Reporting a vulnerability

Please report security problems privately via a
[GitHub security advisory](https://docs.github.com/en/code-security/security-advisories/guidance-on-reporting-and-writing-information-about-vulnerabilities/privately-reporting-a-security-vulnerability)
on this repository, not as a public issue. Include steps to reproduce and the
Lanyard version (Settings → About, or `lanyard --version`).

## Code signing policy

Free code signing provided by [SignPath.io](https://about.signpath.io), certificate by [SignPath Foundation](https://signpath.org).

> **Status:** not yet approved by SignPath Foundation. Until then, Windows releases are not code-signed.

- **What is signed:** the Windows app (`lanyard.exe`) and its installer, only from release builds made by [`release.yml`](.github/workflows/release.yml) on GitHub-hosted runners from this repository's source. The bundled Node.js runtime (`node.exe`) is an upstream binary, signed by its own publisher, and is not signed with this certificate.
- **Committers and reviewers:** [riomar0001](https://github.com/riomar0001). Changes from anyone else arrive as pull requests and are reviewed before merging.
- **Approvers:** [riomar0001](https://github.com/riomar0001) approves every signing request in SignPath.
- **macOS** builds are not notarized yet, so macOS asks for confirmation on first launch.

**Privacy policy:** This program will not transfer any information to other networked systems unless specifically requested by the user or the person installing or operating it. Lanyard connects only to the SSH servers and git hosts you ask it to (to connect, test a login or scan host keys) and runs no telemetry or update checks.

### Verifying a download

Whether or not a file is code-signed, every release file has a signed **build attestation** proving it was built from this repository by its release workflow:

```bash
gh attestation verify Lanyard-Setup-1.2.0-x64.exe --repo riomar0001/lanyard
```

Each release also lists every file's SHA-256 in `SHA256SUMS.txt`. When it is GPG-signed (`SHA256SUMS.txt.asc`), check it with the public key in [`KEYS`](KEYS):

```bash
gpg --import KEYS
gpg --verify SHA256SUMS.txt.asc SHA256SUMS.txt
sha256sum --check --ignore-missing SHA256SUMS.txt
```

## Threat model

- **Trusted:** the local user running Lanyard and the code bundled with the
  app. Lanyard deliberately gives that user full control of their own SSH
  setup: the raw config editor can write any directive, including
  `ProxyCommand`, and Settings can set git's `core.sshCommand`.
- **Not trusted:** anything that is not our bundled renderer page (remote web
  content, other local users, values that end up as arguments to `ssh`,
  `ssh-keygen`, `git`, `reg` or a terminal), and the environment of a packaged
  build.
- **Boundary:** the window loads only the bundled renderer, under the content
  security policy in `src-tauri/tauri.conf.json`, and has no Node or
  filesystem access of its own. Besides setting its zoom level, it can only
  call one Tauri command, `api_invoke`. The Rust shell answers desktop
  requests itself (dialogs, clipboard, opening https links, window controls)
  and passes everything else, as JSON lines over stdio, to the Node sidecar,
  which only calls the API's own namespaces and methods.

## Since the move to Tauri (1.0.0-beta.1)

The app moved from Electron to Tauri in 1.0.0-beta.1. The audit below was done
on the Electron app. Its findings about Lanyard's own logic (input
validation, passphrases, key handling, ssh_config editing, terminals) live in
`src/core` and still apply unchanged. The Electron-specific items (1, 8, 9,
10 and the CLI installer) no longer exist in that form:

- The renderer is no longer loaded from a URL an environment variable can
  change: Tauri serves the bundled files, and `devUrl` is used only by
  `tauri dev`.
- The content security policy is set in `tauri.conf.json` (`csp` for
  release builds, `devCsp` for development).
- The sidecar runs with the Node.js runtime bundled with the app, so a
  packaged app never executes a different `node` from the user's PATH.
- The desktop app no longer installs the CLI or edits the user's PATH; the CLI
  comes from npm.
- `npm audit` reports no vulnerabilities in any dependency, build tools
  included.

## Audit: 2026-10-07 (Electron app)

Scope: Electron configuration and IPC, every place user input reaches a child
process, the filesystem or ssh_config, secrets handling, the Windows CLI
installer, and dependencies. Every finding below is fixed, and the fixes are
covered by `test/security.test.ts` or were verified against a packaged build.

| #   | Severity | Finding                                                                                                                                                                                                                                                             | Fix                                                                                                                                                                                                                                                                                                                                                                                  |
| --- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | High     | The packaged app honoured `ELECTRON_RENDERER_URL`: anyone able to set that variable could make Lanyard load a remote page, and the IPC check trusted the same variable, so the page would get the full API (generate keys, rewrite the SSH config, open terminals). | The dev-server URL is used only when the app is not packaged (`src/main/security.ts`). IPC now accepts only the top frame of the exact renderer page, instead of any `file://` URL.                                                                                                                                                                                                  |
| 2   | Medium   | Key passphrases were passed to `ssh-keygen` as `-N` / `-P` arguments. Process arguments are visible to other local users on Linux and macOS (`ps`, `/proc/*/cmdline`).                                                                                              | On Linux and macOS, passphrases are typed into ssh-keygen's prompts through stdin, with the process started without a controlling terminal so it reads them from there. Verified with OpenSSH 10.2. Windows OpenSSH reads prompts only from the console, never stdin, so there they stay in `-P` / `-N`: Windows lets only the process owner and administrators read a command line. |
| 3   | Medium   | The Windows CLI installer read the user `PATH` with `reg query /v Path` and treated any failure as "empty". A failed read would then have overwritten the user's whole `PATH` with Lanyard's folder.                                                                | The installer reads the whole `HKCU\Environment` key; any failure aborts the install instead of writing a guessed value.                                                                                                                                                                                                                                                             |
| 4   | Medium   | `keys.remove` and `keys.fixPermissions` accepted any absolute path, so a bad reference could move any file to Lanyard's trash or run `icacls` on it.                                                                                                                | Both now refuse anything that is not an SSH key (a private-key file, or a file with a valid `.pub` beside it).                                                                                                                                                                                                                                                                       |
| 5   | Low      | Host aliases and `known_hosts` hosts could start with `-`, so `ssh`, `ssh-keygen` and `ssh-keyscan` would read them as options (`-oProxyCommand=…`).                                                                                                                | The validators reject a leading `-`.                                                                                                                                                                                                                                                                                                                                                 |
| 6   | Low      | Host option values from the structured editor were not checked for newlines, so a value like `x\nProxyCommand …` was written as an extra directive the form never showed.                                                                                           | Option names must be single words and values single lines.                                                                                                                                                                                                                                                                                                                           |
| 7   | Low      | The "open in terminal" guard allowed typographic quotes (`’`), which PowerShell treats as quotes, and did not check the window title passed to Windows Terminal.                                                                                                    | Both are now covered by the metacharacter check.                                                                                                                                                                                                                                                                                                                                     |
| 8   | Low      | The production CSP still allowed the dev server's websocket and `'unsafe-inline'` styles, and set no `object-src` / `base-uri` / `form-action`.                                                                                                                     | Production builds ship `default-src 'self'` with no inline styles, no websocket, `object-src 'none'`, `base-uri 'none'` and `form-action 'none'`.                                                                                                                                                                                                                                    |
| 9   | Low      | No defence in depth beyond the main window: permission requests were not denied, and `<webview>` and navigation were not blocked for other web contents.                                                                                                            | All permission requests and checks are denied, `<webview>` is blocked, and every web contents can only navigate to the renderer page, with new windows denied.                                                                                                                                                                                                                       |
| 10  | Low      | Electron fuses were at their defaults.                                                                                                                                                                                                                              | Packaged builds disable `NODE_OPTIONS` and `--inspect`, enable asar integrity validation and asar-only loading, and keep cookie encryption on (`electron-builder.yml`).                                                                                                                                                                                                              |

### Checked and found sound

- Every child process is spawned without a shell, with an argument array.
- `openExternal` only opens `https:` links; window-open requests are denied.
- IPC dispatch only calls the API object's own methods (`Object.hasOwn`), so `__proto__` and friends are unreachable.
- Account, provider, key-file, backup and alias names are validated against strict patterns before they touch paths or config.
- New files under `~/.ssh` are created `0600` and Lanyard's data directory `0700`. Existing files are written in place so their permissions and Windows ACLs survive.
- Removed keys go to `~/.lanyard/trash`, never straight to deletion. Every config write is backed up first.
- No secrets are stored: passphrases are never written to disk or to `state.json`.
- The CLI shims and `PATH` entry are per-user, and only files carrying Lanyard's marker are ever overwritten or removed.

### Accepted risks

- **A bundled Node.js runtime.** The app ships `node` next to its binary to run the sidecar. Like any Node install it can run arbitrary scripts, but only as the invoking user, so it crosses no privilege boundary.
- **Trusted-user features.** The raw config editor, custom host options and git's `core.sshCommand` setting can all run commands by design (for example via `ProxyCommand`). They are the user's own configuration, and the protections above keep anyone else from driving them.
- **Dependencies.** `npm audit` reports 0 vulnerabilities. CI fails if a runtime dependency gains one.
