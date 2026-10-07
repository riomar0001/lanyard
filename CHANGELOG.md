# Changelog

All notable changes to Lanyard are listed here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [1.0.0-beta.2] - 2026-10-07

### Fixed

- The Windows installer and uninstaller show the Lanyard icon instead of the generic installer icon.
- Lanyard's background helper (`node.exe`) now exits when the app quits. It used to keep running, which made upgrades fail with "Error opening file for writing: …\Lanyard\node.exe".
- The Windows installer stops a background helper left running by an older version before it copies files, so upgrading from 1.0.0-beta.1 works.
- Windows: the "Start at login" entry left by the old Electron build pointed to a file that no longer exists, so it showed no icon in Task Manager's Startup apps and did nothing at login. Lanyard now removes it and, if it was enabled, turns on its own entry instead.

## [1.0.0-beta.1] - 2026-10-07

The first public build.

### Website and docs

- The [Lanyard website](https://lanyard.riomar.dev) with direct downloads that follow each new release, in light and dark mode.
- A user guide with screenshots, on the website and in the [GitHub wiki](https://github.com/riomar0001/lanyard/wiki), both from `docs/wiki`.
- README, CONTRIBUTING.md, docs/ARCHITECTURE.md, a security policy with a code signing policy, and issue and pull request templates.

### Git accounts

- Several accounts per provider on GitHub, GitLab, Bitbucket, Hugging Face, Azure DevOps, Codeberg, Gitea and SourceHut, plus custom and self-hosted providers.
- One-click switching of the account plain `git@host:` URLs use, with an alias host per account for using several side by side.
- Generate a key for a new account or use an existing one; register it with a link straight to the provider's key settings; test it with `ssh -T`.
- A required git name and email per account, optionally applied to the global git config when the account becomes active.
- Point a repository at an account (remote URL and local identity), or rewrite a clone URL with `lanyard url`.

### Remote SSH management

- Every `Host` in `~/.ssh/config` in one searchable list, with a form editor (including ProxyJump and any other option) and a raw editor validated by OpenSSH. Comments and formatting are kept.
- Switch the key each server uses, connect in a terminal, test a login, and view the effective config (`ssh -G`).
- Scan, compare and trust host keys; forget a host after it is reinstalled.

### Keys, agent and backups

- Generate Ed25519, RSA and ECDSA keys; show and copy public keys; set, change or remove passphrases; restrict file permissions; delete to a trash folder. See which accounts and servers use each key.
- Load and unload keys in ssh-agent.
- A backup before every change to `~/.ssh/config` or `known_hosts`, with one-click restore.

### App

- Lives in the system tray, with account switching, per-server key switching, connect and test in the tray menu.
- Command palette (<kbd>Ctrl</kbd>/<kbd>⌘</kbd>+<kbd>K</kbd>), keyboard shortcuts, back and forward history, and a Slack-style title bar.
- Light and dark themes and eight accent colours.
- `lanyard` / `lny` CLI covering everything in the app, with `--json` output, on npm as `lanyard-ssh`.
- Built with Tauri: a small native shell with the SSH logic in a bundled Node.js sidecar, so the app needs no Node install.

### Security

- The window has no Node or filesystem access, runs under a strict content security policy, and can only call Lanyard's own API.
- Passphrases are kept off the command line on Linux and macOS.
- See [SECURITY.md](SECURITY.md) for the full audit.

[Unreleased]: https://github.com/riomar0001/lanyard/compare/v1.0.0-beta.2...HEAD
[1.0.0-beta.2]: https://github.com/riomar0001/lanyard/compare/v1.0.0-beta.1...v1.0.0-beta.2
[1.0.0-beta.1]: https://github.com/riomar0001/lanyard/releases/tag/v1.0.0-beta.1
