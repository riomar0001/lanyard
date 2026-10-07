# Contributing to Lanyard

Thanks for helping. This page covers building from source, the checks a change has to pass, and how releases are made.

- **Bug or idea:** [open an issue](https://github.com/riomar0001/lanyard/issues/new/choose).
- **Security problem:** report it privately, as described in [SECURITY.md](SECURITY.md). Don't open a public issue.

## Set up

You need:

- **Node.js 24** (CI uses 24; the published CLI runs on 20+) and git.
- **Rust** (stable, via [rustup](https://rustup.rs)) and the [Tauri prerequisites](https://tauri.app/start/prerequisites/) for your OS: the Microsoft C++ Build Tools and WebView2 on Windows, Xcode Command Line Tools on macOS, and `libwebkit2gtk-4.1-dev` and friends on Linux.
- The OpenSSH client tools (`ssh -V` should work).

```bash
git clone https://github.com/riomar0001/lanyard.git
cd lanyard
npm ci
npm run tauri:dev
```

`npm run tauri:dev` downloads the Node runtime the app bundles (once), builds the sidecar and starts the app with a hot-reloading renderer. To keep experiments away from your real `~/.ssh`, point the app and the CLI at a sandbox:

```bash
LANYARD_SSH_DIR=/tmp/lny/.ssh LANYARD_HOME=/tmp/lny/.lanyard npm run tauri:dev
```

On Windows PowerShell: `$env:LANYARD_SSH_DIR = "$env:TEMP\lny\.ssh"` (and `LANYARD_HOME` the same way), then `npm run tauri:dev`.

The TypeScript side (core, CLI, tests) needs no Rust: `npm ci`, `npm run build` and `npm test` work on their own.

## Scripts

| Script                 | What it does                                                                               |
| ---------------------- | ------------------------------------------------------------------------------------------ |
| `npm run tauri:dev`    | The app with a hot-reloading renderer.                                                     |
| `npm run tauri:build`  | Build the app and its installer for the current OS into `src-tauri/target/release/bundle`. |
| `npm run build`        | Build the renderer, the sidecar and the CLI into `out/`.                                   |
| `npm run fetch:node`   | Download the Node runtime the app bundles into `src-tauri/binaries` (checksum-verified).   |
| `npm run lanyard -- …` | Run the CLI from `out/` (build first), e.g. `npm run lanyard -- status`.                   |
| `npm test`             | Vitest. Tests run against a throwaway `~/.ssh` and use the real `ssh` / `ssh-keygen`.      |
| `npm run typecheck`    | TypeScript (tsgo) for the Node and the web projects.                                       |
| `npm run lint`         | ESLint with type-aware rules. `npm run lint:fix` applies the safe fixes.                   |
| `npm run format`       | Prettier. `npm run format:check` only reports.                                             |
| `npm run check`        | Everything CI checks on the TypeScript side: format, lint, typecheck, tests.               |
| `npm run icons`        | Regenerate the app and tray icons in `resources/`.                                         |

For the Rust shell, CI also runs `cargo fmt --check`, `cargo clippy` and `cargo test` in `src-tauri`.

## Making a change

1. Branch from `main`.
2. Make the change. Read [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) first if you're new to the code: domain logic belongs in `src/core` so the app and the CLI both get it.
3. Add or update tests in `test/` for anything in `src/core`.
4. Run `npm run check`.
5. If users will notice the change, add a line under **Unreleased** in [CHANGELOG.md](CHANGELOG.md). If it changes how the app is used, update the matching page in [`docs/wiki`](docs/wiki).
6. Open a pull request. CI runs the same checks on Windows, macOS and Linux.

### Conventions

- **Formatting** is Prettier's job; don't hand-format.
- **Commits:** one logical change per commit, with an imperative subject line ("Add host search", not "Added…"), and a body explaining why when it isn't obvious.
- **Shelling out:** always use `run()` from `src/core/utils/exec.ts` with an argument array, never a shell string. Validate anything user-supplied that becomes an argument (see the validators in `src/core`).
- **Never touch the real `~/.ssh` in tests.** Set `LANYARD_SSH_DIR` and `LANYARD_HOME` before importing the core, as the existing tests do.

## Documentation

- The user guide lives in [`docs/wiki`](docs/wiki) and is published to the [GitHub wiki](https://github.com/riomar0001/lanyard/wiki) by `.github/workflows/wiki.yml` on every push to `main`. Link pages as `Page.md` and images as `../images/x.png`; the workflow rewrites both for the wiki.
- Screenshots live in [`docs/images`](docs/images), 1280×800. Take them from a sandboxed instance with demo data, never from a real setup.
- The same pages also appear on the [website](https://lanyard.riomar.dev/docs/), so one edit updates both.

## Website

The site in [`website/`](website) is a Vite + React app. Each page is pre-rendered to static HTML at build time and hydrated in the browser. It shows the landing page, the downloads, the user guide (rendered from `docs/wiki`) and the changelog (from `CHANGELOG.md`).

```bash
cd website
npm ci
npm run dev        # http://localhost:5173/lanyard/
npm run build      # static site in website/dist
npm run preview    # serve the build
```

- **Download buttons** link straight to the newest release's files. The build reads them from the GitHub API, and the page refreshes them in the browser, so they follow new releases even before the site is rebuilt.
- **Deploys:** [`pages.yml`](.github/workflows/pages.yml) publishes to GitHub Pages on every push to `main` that touches the site or the docs, and after every release. It needs a one-time setting: **Settings → Pages → Source: GitHub Actions**.
- **Custom domain:** point the domain at `riomar0001.github.io` (a CNAME record, set to DNS only on Cloudflare), and add it under **Settings → Pages → Custom domain**. Each deploy asks GitHub Pages for the site's address, so after changing the domain, run the **Website** workflow once to rebuild for it. The site is live at [lanyard.riomar.dev](https://lanyard.riomar.dev); old `github.io` links redirect there.

## Releases

Releases are built by GitHub Actions from branches named `build-v<version>`:

```bash
git push origin main:build-v1.2.0
```

[`release.yml`](.github/workflows/release.yml) then:

1. reads the version from the branch name (it must be valid semver);
2. runs CI;
3. sets that version in the app;
4. builds the Tauri app for each platform with its bundled Node runtime: the Windows installer (NSIS), the macOS DMGs (Apple Silicon and Intel) and the Linux AppImage, checks that the bundled runtime starts the sidecar, and builds and checks the npm tarball;
5. publishes the GitHub release `v1.2.0` with the files, `SHA256SUMS.txt` and generated notes;
6. publishes `lanyard-ssh@1.2.0` to npm (once set up, see below) and rebuilds the website.

A version with a suffix (`1.2.0-beta.1`) is published as a prerelease. Pushing to the same branch again rebuilds that version, moves its tag and replaces its files.

### Code signing

The policy users see is in [SECURITY.md](SECURITY.md#code-signing-policy). Three parts, each turned on separately:

**Build attestations (on, nothing to set up).** The release job signs a provenance attestation for every file with GitHub's Sigstore integration. Anyone can check a file with `gh attestation verify <file> --repo riomar0001/lanyard`.

**Windows: SignPath Foundation (free for open source).**

1. Apply at [signpath.org/apply](https://signpath.org/apply). Turn on two-factor authentication for GitHub and SignPath first; the Foundation requires it.
2. Once accepted, in SignPath create a project with the slug `lanyard`, using the predefined trusted build system **GitHub.com**.
3. Add two artifact configurations, pasting the files from [`.signpath/artifact-configurations`](.signpath/artifact-configurations): slug `app` from `app.xml` and slug `installer` from `installer.xml`.
4. Use the signing policy `release-signing`, with yourself as approver.
5. Create a CI user with an API token. On GitHub, save it as the secret `SIGNPATH_API_TOKEN`, and save your SignPath organization ID as the repository variable `SIGNPATH_ORGANIZATION_ID`. If your slugs differ, set the variables `SIGNPATH_PROJECT_SLUG` and `SIGNPATH_SIGNING_POLICY_SLUG`.
6. Remove the "not yet approved" status line from the policy in SECURITY.md.

The next release then builds the Windows app, has SignPath sign `lanyard.exe`, builds the installer from the signed app, has SignPath sign the installer, and checks both signatures. Each signing request waits for your approval in SignPath, for up to an hour. Signing only removes the SmartScreen warning once the certificate has built up reputation.

**GPG signature over the checksums (free).**

1. Create a signing key: `gpg --quick-generate-key "Lanyard releases <you@example.com>" ed25519 sign 2y`
2. Save the private key (`gpg --armor --export-secret-keys <KEY-ID>`) as the secret `GPG_PRIVATE_KEY`, and its passphrase as `GPG_PASSPHRASE`.
3. Commit the public key as `KEYS` at the repository root: `gpg --armor --export <KEY-ID> > KEYS`

Releases then include `SHA256SUMS.txt.asc`, and their notes say how to verify it.

### npm

Stable versions are published to npm as `latest`. Prereleases get a tag named after their label (`1.2.0-beta.1` → `beta`), so `npm install -g lanyard-ssh` keeps installing the stable version and testers use `npm install -g lanyard-ssh@beta`. npm never accepts the same version twice, so rebuilding a release skips npm.

Publishing is off until it is set up. Pick one way to authenticate:

- **Trusted publishing (recommended, no token to leak or rotate):** on npmjs.com, open `lanyard-ssh` → **Settings → Trusted publishing**, add GitHub Actions with repository `riomar0001/lanyard` and workflow `release.yml`.
- **Or a token:** create a granular access token on npmjs.com with read and write access to `lanyard-ssh`, and save it as the repository secret `NPM_TOKEN`.

Then turn it on: **Settings → Secrets and variables → Actions → Variables**, add `NPM_PUBLISH` = `true`.

Version history starts at `1.1.0-beta.1`. npm never lets a version number be reused, including unpublished test versions such as `1.0.0`, so always release a new number. While only prereleases exist, the job also points `latest` at the newest one so a plain install works.

Before releasing, move the **Unreleased** entries in [CHANGELOG.md](CHANGELOG.md) under the new version.
