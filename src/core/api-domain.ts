/**
 * Domain-only implementation of the LanyardApi contract: every namespace that
 * is pure core delegation lives here, with no desktop-shell imports. The
 * Tauri sidecar (src/sidecar) serves this object; desktop concerns (dialogs,
 * clipboard, theme, native menus) are answered natively by the Rust backend.
 *
 * Extracted from the old Electron main-process src/main/ipc/api.ts.
 */

import os from 'node:os';
import * as core from './index';
import { toolVersions } from './utils/tool-versions';
import pkg from '../../package.json';
import type { AboutInfo, AppInfo, LanyardApi } from '../shared/ipc';

export interface DomainApiOptions {
  /** App version string (from the shell; Tauri knows it, sidecar gets it injected). */
  version: string;
  /** Whether the app is running from an installed bundle. */
  packaged: boolean;
  /** Command that runs the CLI from this installation. */
  cliHint: string;
  /** Called after settings change so the shell can follow (tray, autostart). */
  onSettingsChanged?: () => void;
}

export function openInTerminal(cmd: string, args: string[], title: string): void {
  core.terminal.openTerminal(cmd, args, { preference: core.settings.get().terminal, title });
}

type DomainApi = Omit<LanyardApi, 'app'> & {
  app: Pick<LanyardApi['app'], 'info' | 'about' | 'connect' | 'addKeyInTerminal'>;
};

export function createDomainApi(opts: DomainApiOptions): DomainApi {
  const onSettingsChanged = opts.onSettingsChanged ?? (() => {});

  return {
    accounts: {
      overview: async () => core.accounts.overview(),
      add: (input) => core.accounts.add(input),
      update: (provider, name, patch) => core.accounts.update(provider, name, patch),
      remove: (provider, name, options) => core.accounts.remove(provider, name, options),
      use: (provider, name) => core.accounts.use(provider, name),
      test: (provider, name) => core.accounts.test(provider, name),
      cloneUrl: async (provider, name, repoUrl) => core.accounts.cloneUrl(provider, name, repoUrl),
      applyToRepo: (provider, name, dir, options) => core.accounts.applyToRepo(provider, name, dir, options),
      addProvider: async (input) => core.accounts.addProvider(input),
      removeProvider: async (id) => core.accounts.removeProvider(id),
    },
    hosts: {
      list: async () => core.hosts.list(),
      save: async (host) => core.hosts.save(host),
      remove: async (index, patterns) => core.hosts.remove(index, patterns),
      setKey: async (alias, keyRef) => core.hosts.setKey(alias, keyRef),
      getRaw: async () => core.hosts.getRaw(),
      validate: (text) => core.hosts.validate(text),
      saveRaw: (text, options) => core.hosts.saveRaw(text, options),
      test: (alias) => core.hosts.test(alias),
      resolve: (alias) => core.hosts.resolve(alias),
    },
    keys: {
      list: async () => core.keys.list(),
      generate: (input) => core.keys.generate(input),
      checkName: async (name) => core.keys.checkName(name),
      publicKey: (ref) => core.keys.publicKey(ref),
      changePassphrase: (ref, oldP, newP) => core.keys.changePassphrase(ref, oldP, newP),
      remove: async (ref) => core.keys.remove(ref),
      fixPermissions: (ref) => core.keys.fixPermissions(ref),
    },
    knownHosts: {
      list: async () => core.knownHosts.list(),
      removeLine: async (line, fingerprint) => core.knownHosts.removeLine(line, fingerprint),
      removeHost: (host, port) => core.knownHosts.removeHost(host, port),
      scan: (host, port) => core.knownHosts.scan(host, port),
      trust: async (lines) => core.knownHosts.trust(lines),
    },
    agent: {
      status: () => core.agent.status(),
      add: (ref) => core.agent.add(ref),
      remove: (ref) => core.agent.remove(ref),
      clear: () => core.agent.clear(),
    },
    backups: {
      list: async (kind) => core.backups.list(kind),
      read: async (id) => core.backups.read(id),
      restore: async (id) => core.backups.restore(id),
    },
    git: {
      identity: () => core.git.getGlobalIdentity(),
      setSshCommand: (command) => core.git.setSshCommand(command),
    },
    settings: {
      get: async () => core.settings.get(),
      update: async (patch) => {
        const next = core.settings.update(patch);
        onSettingsChanged();
        return next;
      },
    },
    app: {
      info: async (): Promise<AppInfo> => ({
        version: opts.version,
        platform: process.platform,
        paths: core.describePaths(),
        terminalChoices: core.terminal.TERMINAL_CHOICES[process.platform] ?? ['auto'],
        cliHint: opts.cliHint,
      }),
      connect: async (alias) => {
        const provider = core.hosts.gitProviderFor(core.hosts.assertAlias(alias));
        if (provider)
          throw new core.LanyardError(
            `${alias} is a ${provider} git host: it accepts git over SSH but has no shell. Use Test instead.`,
            'GIT_HOST',
          );
        openInTerminal('ssh', [alias], `ssh ${alias}`);
      },
      addKeyInTerminal: async (ref) => {
        const { cmd, args } = core.agent.interactiveAddCommand(ref);
        openInTerminal(cmd, args, 'ssh-add');
      },
      about: async (): Promise<AboutInfo> => ({
        name: pkg.productName,
        version: opts.version,
        description: pkg.description,
        license: pkg.license,
        runtime: { node: process.versions.node, webview: null },
        os: `${os.type()} ${os.release()} (${os.arch()})`,
        tools: await toolVersions(),
        packaged: opts.packaged,
      }),
    },
  };
}
