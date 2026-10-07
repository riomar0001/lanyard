# Troubleshooting

Start with **Test** on the account (Git accounts page) or **Test login** on the server (Hosts page). The message tells you which section below applies.

## Git and accounts

### Permission denied (publickey)

The server didn't accept any key Lanyard's config offered. Check, in order:

1. **The public key is registered with this account.** Account's **⋯** → **Copy public key**, and compare it with the keys in the provider's settings. A key added to your _work_ account won't log you in as _personal_.
2. **The right account is active**, or the remote uses the account's alias. Run `git remote -v`: `git@github.com:` uses the active account, `git@github.com-personal:` always uses _personal_.
3. **A passphrase-protected key is loaded.** Keys with a passphrase must be in the [ssh-agent](SSH-Agent.md), or SSH has to prompt for the passphrase, which Test can't do.
4. **The key file's permissions.** See [Bad permissions](#unprotected-private-key-file--bad-permissions) below.

To see exactly what SSH tries, run `ssh -vT git@github.com`.

### "Connected, but the server did not recognise this key"

The server accepted the connection but doesn't know the key. Hugging Face answers this way (`Hi anonymous`). Add the public key to the account's SSH key settings, then test again.

### Pushes or commits show up as the wrong person

Two separate things decide who you are:

- **Who pushes** is the SSH key, chosen by the active account or the alias in the remote URL.
- **Who authored a commit** is `git config user.name` / `user.email`, chosen when the commit is made.

Turn on **Set the global git identity when this account becomes active** for the account (⋯ → **Edit**), or point the repository at the account with **Clone / switch a repository**, which also sets the repository's own name and email. Commits you already made keep their old author.

### "PTY allocation request failed" when connecting to a git host

Git hosts accept git commands but give you no shell, so **Connect** doesn't apply to them. Lanyard shows **Test (ssh -T)** for git hosts instead.

## SSH

### ssh-agent is not reachable

On Windows the agent is a service that is disabled by default. In PowerShell **as Administrator**:

```powershell
Get-Service ssh-agent | Set-Service -StartupType Automatic
Start-Service ssh-agent
```

macOS and Linux: see [ssh-agent](SSH-Agent.md#when-the-agent-is-not-running).

### Asked for my passphrase on every push

Load the key into the agent once: Keys page → key's **⋯** → **Add to ssh-agent**.

### Host key verification failed / REMOTE HOST IDENTIFICATION HAS CHANGED

The server's key doesn't match `~/.ssh/known_hosts`. If you know why (a reinstall, or an announced key rotation), forget the host and trust it again: [Known hosts](Known-Hosts.md#remote-host-identification-has-changed). If you don't know why, don't connect.

### UNPROTECTED PRIVATE KEY FILE / bad permissions

OpenSSH refuses private keys other users can read. Keys page → key's **⋯** → **Restrict permissions to you** (or `lanyard keys fix-perms <key>`).

### My edits inside the managed section disappeared

The block between the `lanyard managed section` markers is regenerated from your accounts on every change. Put your own settings outside the markers, or change the account in Lanyard. See [How it works](How-It-Works.md).

### OpenSSH rejects my config

Use **Raw config → Validate** on the Hosts page to see the error. To roll back a change, open [Backups](Backups.md) and restore the previous version.

## Installing and running

### Windows: "Windows protected your PC"

The installer isn't code-signed yet. Click **More info → Run anyway**. Compare the file with `SHA256SUMS.txt` from the release if you want to check it first:

```powershell
Get-FileHash .\Lanyard-Setup-*.exe -Algorithm SHA256
```

### macOS: "Lanyard is damaged" or "can't be opened"

The app isn't notarized yet. Right-click it in Applications → **Open**. If macOS still refuses:

```bash
xattr -dr com.apple.quarantine /Applications/Lanyard.app
```

### `lanyard: command not found`

- The desktop app doesn't install the command. Install it with npm (Node.js 20+): `npm install -g lanyard-cli`.
- After installing, open a **new** terminal; terminals opened earlier keep the old PATH.
- Without installing anything: `npx lanyard-cli status`.

### Lanyard keeps running after I close it

That's the tray. Right-click the tray icon → **Quit Lanyard**, or turn off **Keep running in the tray when closed** in [Settings](Settings.md).

## Still stuck?

[Open an issue](https://github.com/riomar0001/lanyard/issues/new/choose) with the Lanyard version (Settings → About), your OS, and the output of `ssh -vT <host>`. Remove anything private from the output first.
