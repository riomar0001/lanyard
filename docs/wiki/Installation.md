# Installation

Lanyard needs the OpenSSH client tools (`ssh`, `ssh-keygen`, `ssh-add`). Windows 10 and 11, macOS and most Linux distributions include them. Check with:

```bash
ssh -V
```

If that prints a version, you are ready.

## Desktop app

Download from the [latest release](https://github.com/riomar0001/lanyard/releases). Each release lists the files and their SHA-256 checksums (`SHA256SUMS.txt`).

### Windows 10 / 11

1. Download `Lanyard-Setup-<version>-x64.exe`.
2. Run it. If SmartScreen says "Windows protected your PC", click **More info → Run anyway**. The builds are not code-signed yet.
3. Choose where to install, then finish the installer.

For the `lanyard` command, see [CLI only](#cli-only): the app doesn't install it.

### macOS (Apple Silicon or Intel)

1. Download `Lanyard-<version>-arm64.dmg` for Apple Silicon (M1 and later) or `Lanyard-<version>-x64.dmg` for Intel Macs.
2. Open the `.dmg` and drag **Lanyard** to **Applications**.
3. The first time, right-click **Lanyard** in Applications and choose **Open**, then **Open** again. macOS asks because the app is not notarized yet.

If macOS says the app "is damaged", remove the download quarantine flag and open it again:

```bash
xattr -dr com.apple.quarantine /Applications/Lanyard.app
```

For the `lanyard` command, see [CLI only](#cli-only): the app doesn't install it.

### Linux

1. Download `Lanyard-<version>-x86_64.AppImage`.
2. Make it executable and run it:

```bash
chmod +x Lanyard-*.AppImage
./Lanyard-*.AppImage
```

Some distributions need FUSE 2 for AppImages (`sudo apt install libfuse2` on Ubuntu 22.04 and later). For the `lanyard` command, see [CLI only](#cli-only).

## CLI only

If you only want the command line, install it from npm. This needs Node.js 20 or later.

```bash
npm install -g lanyard-ssh
```

Or run it without installing anything:

```bash
npx lanyard-ssh status
```

Each release also attaches the npm package as `lanyard-ssh-<version>.tgz`; install it with `npm install -g ./lanyard-ssh-<version>.tgz`.

## From source

See [CONTRIBUTING.md](https://github.com/riomar0001/lanyard/blob/main/CONTRIBUTING.md#set-up).

## Updating

Download the new release and install it over the old one. Your accounts, settings and backups live in `~/.lanyard` and are kept.

## Uninstalling

- **Windows:** Settings → Apps → Lanyard → Uninstall.
- **macOS:** drag Lanyard from Applications to the Trash.
- **Linux:** delete the AppImage.
- **The CLI:** `npm uninstall -g lanyard-ssh`.

Uninstalling leaves your SSH files exactly as they are, including the [managed section](How-It-Works.md) of `~/.ssh/config`. To remove Lanyard's data as well, delete the `~/.lanyard` folder.
