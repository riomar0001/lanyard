# CLI reference

The command is `lanyard`, with the short alias `lny`. Via npm without installing, it is `npx lanyard-cli`. See [Installation](Installation.md) for how to get it.

- `lanyard` with no arguments opens the desktop app.
- `lanyard <command> --help` shows every option of a command.
- `--json` on any command prints machine-readable output.

Key arguments (`<key>`) accept a file name in `~/.ssh` (`id_ed25519_work`), a `~/…` path, or an absolute path.

## Accounts

| Command                                     | What it does                                                                               |
| ------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `lanyard status`                            | The active account for every provider that has accounts, and the global git identity.      |
| `lanyard accounts list [provider]`          | List accounts.                                                                             |
| `lanyard accounts add <provider> <name> …`  | Add an account (options below).                                                            |
| `lanyard accounts edit <provider> <name> …` | `--rename`, `--key`, `--git-name`, `--git-email`, `--[no-]set-git-identity`.               |
| `lanyard accounts rm <provider> <name>`     | Remove an account. `--delete-key` also moves its key to the trash if nothing else uses it. |
| `lanyard use <provider> [name]`             | Switch the active account. `--off` deactivates.                                            |
| `lanyard test [provider] [name]`            | `ssh -T` the active accounts. `--all` tests every account.                                 |
| `lanyard url <provider> <name> <repoUrl>`   | Print a clone URL that uses the account's alias host.                                      |
| `lanyard repo <provider> <name> [dir]`      | Point a repository at the account. `-r <remote>` (default `origin`), `--no-identity`.      |

`accounts add` options:

| Option                      | Meaning                                                           |
| --------------------------- | ----------------------------------------------------------------- |
| `-g, --generate`            | Generate a new key for the account.                               |
| `-t, --type <type>`         | Key type for `--generate`: `ed25519` (default), `rsa`, `ecdsa`.   |
| `-N, --passphrase <phrase>` | Passphrase for `--generate`.                                      |
| `-k, --key <key>`           | Use an existing key instead.                                      |
| `--git-name <name>`         | **Required.** `user.name` for commits made as this account.       |
| `--git-email <email>`       | **Required.** `user.email` for commits; also the key comment.     |
| `--set-git-identity`        | Set the global git identity whenever this account becomes active. |
| `--activate`                | Make it the active account now.                                   |

Examples:

```bash
lanyard accounts add github work --generate --git-name "Jane Doe" --git-email jane@acme.example --set-git-identity
lanyard accounts add github personal --key ~/.ssh/id_ed25519 --git-name "Jane Doe" --git-email jane@example.com
lanyard use github personal
git clone $(lanyard url github work https://github.com/acme/app)
```

## Providers

| Command                        | What it does                                                                            |
| ------------------------------ | --------------------------------------------------------------------------------------- |
| `lanyard providers list`       | Built-in and custom providers.                                                          |
| `lanyard providers add <id> …` | Add a custom provider: `--host` (required), `--name`, `--port`, `--user`, `--keys-url`. |
| `lanyard providers rm <id>`    | Remove a custom provider (remove its accounts first).                                   |

## Hosts

| Command                               | What it does                                                                     |
| ------------------------------------- | -------------------------------------------------------------------------------- |
| `lanyard hosts list`                  | Every `Host` entry.                                                              |
| `lanyard hosts show <alias>`          | Print one host block.                                                            |
| `lanyard hosts add <alias> …`         | Add a host (options below).                                                      |
| `lanyard hosts edit <alias> …`        | Change only the given options; `--unset <Key…>` removes options.                 |
| `lanyard hosts rm <alias>`            | Remove a host.                                                                   |
| `lanyard hosts key <alias> [key]`     | Show or switch the key a host uses. `--default` goes back to SSH's default keys. |
| `lanyard hosts test <alias>`          | Try a non-interactive login.                                                     |
| `lanyard hosts resolve <alias>`       | The effective settings SSH will use (`ssh -G`).                                  |
| `lanyard connect <alias> [ssh args…]` | Open an SSH session (alias `c`).                                                 |

`hosts add` / `hosts edit` options: `-H, --hostname`, `-u, --user`, `-p, --port`, `-k, --key`, `-J, --proxy-jump`, `--forward-agent yes|no`, `-o, --option Key=Value` (repeatable), `--comment`.

## Keys

| Command                        | What it does                                                          |
| ------------------------------ | --------------------------------------------------------------------- |
| `lanyard keys list`            | Key pairs in `~/.ssh`.                                                |
| `lanyard keys gen <name>`      | Generate a key: `-t`, `-b <bits>`, `-C <comment>`, `-N <passphrase>`. |
| `lanyard keys pub <key>`       | Print the public key.                                                 |
| `lanyard keys passwd <key>`    | Change the passphrase (asks interactively).                           |
| `lanyard keys rm <key>`        | Move the key pair to `~/.lanyard/trash`.                              |
| `lanyard keys fix-perms <key>` | Make the private key readable only by you.                            |

## ssh-agent

| Command                   | What it does                                        |
| ------------------------- | --------------------------------------------------- |
| `lanyard agent list`      | Loaded keys.                                        |
| `lanyard agent add <key>` | Load a key (asks for its passphrase if it has one). |
| `lanyard agent rm <key>`  | Unload a key.                                       |
| `lanyard agent clear`     | Unload every key.                                   |

## Known hosts

| Command                             | What it does                                                                          |
| ----------------------------------- | ------------------------------------------------------------------------------------- |
| `lanyard known-hosts list [search]` | Entries, optionally filtered (alias `kh`).                                            |
| `lanyard known-hosts scan <host>`   | Fetch a server's host keys and show fingerprints. `-p <port>`, `--trust` to add them. |
| `lanyard known-hosts rm <host>`     | Forget every key of a host, including hashed entries.                                 |

## Backups and config

| Command                        | What it does                                             |
| ------------------------------ | -------------------------------------------------------- |
| `lanyard backups list`         | Backups, newest first.                                   |
| `lanyard backups show <id>`    | Print a backup.                                          |
| `lanyard backups restore <id>` | Restore it (the current file is backed up first).        |
| `lanyard config path`          | Every path Lanyard uses.                                 |
| `lanyard config validate`      | Ask OpenSSH whether `~/.ssh/config` parses.              |
| `lanyard config sync`          | Regenerate the managed section from your saved accounts. |
| `lanyard gui`                  | Open the desktop app (alias `open`).                     |

## Environment variables

| Variable          | Effect                                                                 |
| ----------------- | ---------------------------------------------------------------------- |
| `LANYARD_SSH_DIR` | Use this folder instead of `~/.ssh` (handy for experiments and tests). |
| `LANYARD_HOME`    | Use this folder instead of `~/.lanyard`.                               |
| `NO_COLOR`        | Turn off coloured output.                                              |
