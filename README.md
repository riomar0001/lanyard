<p align="center">
  <img src="resources/icon.png" width="96" height="96" alt="Lanyard logo">
</p>

<h1 align="center">Lanyard</h1>

<p align="center">
  <strong>Wear the right identity everywhere.</strong><br>
  Switch between your GitHub, GitLab, Bitbucket and Hugging Face accounts in one click,<br>
  and manage every remote server you SSH into: hosts, keys, jump hosts, ssh-agent and known_hosts.
</p>

<p align="center">
  <a href="https://github.com/riomar0001/lanyard/releases"><img alt="Latest release" src="https://img.shields.io/github/v/release/riomar0001/lanyard?include_prereleases&label=release"></a>
  <a href="https://github.com/riomar0001/lanyard/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/riomar0001/lanyard/actions/workflows/ci.yml/badge.svg"></a>
  <a href="LICENSE"><img alt="MIT license" src="https://img.shields.io/github/license/riomar0001/lanyard"></a>
  <img alt="Windows, macOS, Linux" src="https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-informational">
</p>

<p align="center">
  <a href="https://lanyard.riomar.dev/"><strong>Website</strong></a> ·
  <a href="https://lanyard.riomar.dev/download/"><strong>Download</strong></a> ·
  <a href="https://lanyard.riomar.dev/docs/"><strong>User guide</strong></a> ·
  <a href="https://lanyard.riomar.dev/docs/cli-reference/"><strong>CLI reference</strong></a>
</p>

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/images/overview.png">
  <img alt="Lanyard's Overview page: the active account on GitHub, GitLab and Hugging Face, and every server in the SSH config" src="docs/images/overview-light.png">
</picture>

## Why Lanyard

You have a work GitHub account and a personal one. Both want to be `git@github.com`, so SSH sends whichever key it finds first, and you end up pushing to the wrong account. The usual fix is a hand-edited `~/.ssh/config` full of `Host github.com-work` aliases, plus remembering to change `git config user.email` every time.

Lanyard does that bookkeeping for you:

- **One click to switch.** Pick an account and plain `git@github.com:…` URLs use its key, with its name and email on your commits.
- **Several accounts side by side.** Every account also gets its own alias (`github.com-work`), so one repository can use one account and the next repository another.
- **Your config stays yours.** Lanyard edits one clearly marked block of `~/.ssh/config` and leaves every other line, comment and blank line untouched. Every change is backed up first.

The same goes for your servers. Instead of scrolling through `~/.ssh/config` to remember which key `prod` uses or how to reach the database behind the bastion, you get one list of every machine you SSH into, and a click to connect.

## Remote SSH management

![The Hosts page: every server in the SSH config with its target and key, plus the git hosts](docs/images/hosts.png)

- **Every server in one list.** All the `Host` entries in `~/.ssh/config`, with their user, address, port and key, searchable.
- **Connect in one click.** Open `ssh prod-web` in your terminal from the app, the tray, the command palette or `lanyard connect prod-web`.
- **Switch a server's key** from a dropdown. Lanyard sets `IdentityFile` and `IdentitiesOnly` so SSH offers only that key.
- **Edit without breaking anything.** A form for HostName, User, Port, IdentityFile, ProxyJump (jump hosts), ForwardAgent and any other option; or a raw editor that OpenSSH validates before saving. Comments and formatting are kept.
- **Trust servers safely.** Scan a server's host keys, compare fingerprints, then trust them; forget a host after it is reinstalled.
- **Check before you rely on it.** Test a login non-interactively, or see the effective settings SSH will use (`ssh -G`).

More: [Hosts](https://github.com/riomar0001/lanyard/wiki/Hosts) and [Known hosts](https://github.com/riomar0001/lanyard/wiki/Known-Hosts) in the user guide.

## What it does

| Area               | What you can do                                                                                                                                     |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Git accounts**   | Add accounts on GitHub, GitLab, Bitbucket, Hugging Face, Azure DevOps, Codeberg, Gitea, SourceHut or your own server; switch, test, clone with one. |
| **Remote servers** | Keep every server in `~/.ssh/config` in one list: connect in one click, switch each server's key, jump hosts, a form or a validated raw editor.     |
| **Keys**           | Generate Ed25519, RSA or ECDSA keys, copy public keys, change passphrases, fix permissions, see which accounts and servers use each key.            |
| **ssh-agent**      | See loaded keys, load and unload them.                                                                                                              |
| **known_hosts**    | Scan a server's host keys, compare fingerprints, trust them, forget a host after it is reinstalled.                                                 |
| **Backups**        | A snapshot before every change to your SSH config or known_hosts; restore any of them.                                                              |
| **Everywhere**     | Lives in the system tray after you close the window; a command palette (<kbd>Ctrl</kbd>/<kbd>⌘</kbd>+<kbd>K</kbd>); a full `lanyard` CLI.           |

## Install

Download the file for your system from the [latest release](https://github.com/riomar0001/lanyard/releases):

| System                | File                                | Notes                                                                   |
| --------------------- | ----------------------------------- | ----------------------------------------------------------------------- |
| Windows 10 / 11       | `Lanyard-Setup-<version>-x64.exe`   | SmartScreen may warn about an unsigned app: **More info → Run anyway**. |
| macOS (Apple Silicon) | `Lanyard-<version>-arm64.dmg`       | First launch: right-click the app → **Open**.                           |
| macOS (Intel)         | `Lanyard-<version>-x64.dmg`         | Same as above.                                                          |
| Linux                 | `Lanyard-<version>-x86_64.AppImage` | `chmod +x` the file, then run it.                                       |
| CLI only              | `npm install -g lanyard-cli`        | Needs Node.js 20+. Or run once with `npx lanyard-cli status`.           |

Lanyard uses the OpenSSH tools already on your machine (`ssh`, `ssh-keygen`, `ssh-add`). Windows 10 and 11 include them. The app bundles everything else it needs; there is nothing more to install. The `lanyard` command comes separately from npm (`npm install -g lanyard-cli`).

Full instructions: [Installation](https://github.com/riomar0001/lanyard/wiki/Installation).

## Quick start

1. Open Lanyard and click **Add account**.
2. Pick the provider (for example GitHub), name the account (`work`), keep **Generate a new key**, and fill in the name and email for your commits.
3. Copy the public key Lanyard shows and add it to your account's SSH key settings (Lanyard links straight to that page).
4. Click **Test**. You should see `Authenticated as <your username>`.
5. Clone as usual: `git clone git@github.com:acme/app.git`.

Add a second account the same way, then switch between them from the Overview page, the tray icon, the command palette, or the CLI:

```bash
lanyard use github personal
```

For your servers: open **Hosts → Add host**, enter the alias (`prod-web`), address, user and key, then use **⋯ → Connect**. Hosts already in your `~/.ssh/config` show up on their own.

Step-by-step with screenshots: [Getting started](https://github.com/riomar0001/lanyard/wiki/Getting-Started).

## Command line

Everything in the app is also a command. Install it with `npm install -g lanyard-cli` (Node.js 20+). `lanyard` (or the short alias `lny`) with no arguments opens the desktop app if it is installed.

```bash
lanyard status                                   # who you are on each git host
lanyard use github personal                      # switch accounts
lanyard test                                     # check every active account works
git clone $(lanyard url github work https://github.com/acme/app)   # clone as a specific account
lanyard repo github work ./my-repo               # point an existing repository at an account
lanyard hosts key prod id_ed25519_servers        # switch the key a server uses
lanyard connect prod                             # open an SSH session
```

Add `--json` to any command for scripting. Every command: [CLI reference](https://github.com/riomar0001/lanyard/wiki/CLI-Reference).

## How it works

Lanyard keeps one marked section at the top of `~/.ssh/config`:

```sshconfig
# >>> lanyard managed section >>>
# GitHub - active account: work
Host github.com
    User git
    IdentityFile ~/.ssh/id_ed25519_github_work
    IdentitiesOnly yes

# GitHub - account: personal
Host github.com-personal
    HostName github.com
    IdentityFile ~/.ssh/id_ed25519_github_personal
    ...
Host *
# <<< lanyard managed section <<<

# ...the rest of your config, untouched...
```

Switching accounts rewrites the `Host github.com` block. Nothing outside the markers changes. Details, including every file Lanyard reads and writes: [How it works](https://github.com/riomar0001/lanyard/wiki/How-It-Works).

## Documentation

- **[User guide (wiki)](https://github.com/riomar0001/lanyard/wiki)**: every page of the app, with screenshots.
- **[Troubleshooting](https://github.com/riomar0001/lanyard/wiki/Troubleshooting)**: `Permission denied (publickey)`, agent not running, host key changed, and more.
- **[CHANGELOG.md](CHANGELOG.md)**: what changed in each release.
- **[CONTRIBUTING.md](CONTRIBUTING.md)**: build from source, run the tests, cut a release.
- **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)**: how the code is organized.
- **[SECURITY.md](SECURITY.md)**: threat model, the latest audit, and how to report a vulnerability.

## Code signing policy

Windows releases are signed with free code signing provided by [SignPath.io](https://about.signpath.io), certificate by [SignPath Foundation](https://signpath.org), once the project is approved. Every release file also carries a signed build attestation. Roles, privacy policy and how to verify a download: [Code signing policy](SECURITY.md#code-signing-policy).

## License

[MIT](LICENSE) © riomar
