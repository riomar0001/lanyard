/**
 * The contract between the app's backend (the Tauri shell and its Node sidecar)
 * and the renderer.
 *
 * The sidecar implements `LanyardApi`; the renderer gets a typed client for
 * it. Calls travel over a single channel as (namespace, method, args) and the
 * reply is an `IpcResponse` envelope so error codes survive the trip.
 */

import type {
  AccountTestResult,
  AccountView,
  AddAccountInput,
  AddAccountResult,
  AgentStatus,
  BackupInfo,
  BackupKind,
  ConfigValidation,
  CustomProviderInput,
  GenerateKeyInput,
  GitIdentity,
  HostEntry,
  HostInput,
  HostOption,
  KeyInfo,
  KeyNameCheck,
  KnownHostEntry,
  ProviderInfo,
  ProviderOverview,
  RepoRewriteResult,
  ScannedHostKey,
  Settings,
  LanyardPaths,
  TestResult,
  TrashResult,
  UpdateAccountInput,
  UseResult,
} from './types';

export const IPC_CHANNELS = {
  invoke: 'lanyard:invoke',
  /** main -> renderer: files on disk changed (config, known_hosts, state). */
  changed: 'lanyard:changed',
  /** main -> renderer: the tray asked to show a page. */
  navigate: 'lanyard:navigate',
  /** main -> renderer: an app-menu action the renderer performs (palette, history). */
  command: 'lanyard:command',
} as const;

/** Open a page, optionally with a one-shot intent such as 'add-host'. */
export interface NavigateRequest {
  page: string;
  intent?: string;
}

export type AppCommand = 'palette' | 'back' | 'forward';

export type ChangeTopic = 'config' | 'knownHosts' | 'state' | 'keys';

export interface AppInfo {
  version: string;
  platform: 'win32' | 'darwin' | 'linux' | (string & {});
  paths: LanyardPaths;
  terminalChoices: string[];
  /** Command that runs the CLI from this installation. */
  cliHint: string;
}

/** Settings > About: what this build is and what it runs on. */
export interface AboutInfo {
  name: string;
  version: string;
  description: string;
  license: string;
  runtime: { node: string; webview: string | null };
  os: string;
  tools: { ssh: string | null; git: string | null };
  packaged: boolean;
}

export interface CliInstallStatus {
  /** `lanyard` / `lny` launchers exist in binDir. */
  installed: boolean;
  /** binDir is on the (user) PATH. */
  onPath: boolean;
  binDir: string;
  commands: string[];
  /** Shell line to add binDir to PATH when it is missing (macOS / Linux). */
  pathHint?: string;
  /** Installed app (the installer manages the commands) vs. a source checkout. */
  packaged: boolean;
  /** Command that (re-)registers the commands, e.g. `"C:\...\Lanyard.exe" --install-cli`. */
  installCommand?: string;
}

export interface LanyardApi {
  accounts: {
    overview(): Promise<ProviderOverview[]>;
    add(input: AddAccountInput): Promise<AddAccountResult>;
    update(provider: string, name: string, patch: UpdateAccountInput): Promise<AccountView>;
    remove(provider: string, name: string, options?: { deleteKey?: boolean }): Promise<{ removed: string; trashed: TrashResult | null }>;
    use(provider: string, name: string | null): Promise<UseResult>;
    test(provider: string, name?: string): Promise<AccountTestResult>;
    cloneUrl(provider: string, name: string, repoUrl: string): Promise<string>;
    applyToRepo(
      provider: string,
      name: string,
      dir: string,
      options?: { remote?: string; setIdentity?: boolean },
    ): Promise<RepoRewriteResult>;
    addProvider(input: CustomProviderInput): Promise<ProviderInfo>;
    removeProvider(id: string): Promise<{ removed: string }>;
  };
  hosts: {
    list(): Promise<HostEntry[]>;
    save(host: HostInput): Promise<HostEntry[]>;
    remove(index: number, patterns: string): Promise<HostEntry[]>;
    /** Switch the IdentityFile of a host; null returns to ssh's default keys. */
    setKey(alias: string, keyRef: string | null): Promise<HostEntry>;
    getRaw(): Promise<string>;
    validate(text: string): Promise<ConfigValidation>;
    saveRaw(text: string, options?: { force?: boolean }): Promise<{ saved: boolean }>;
    test(alias: string): Promise<TestResult>;
    resolve(alias: string): Promise<HostOption[]>;
  };
  keys: {
    list(): Promise<KeyInfo[]>;
    generate(input: GenerateKeyInput): Promise<KeyInfo>;
    /** Is this file name free in ~/.ssh? Suggests an alternative when it is taken. */
    checkName(name: string): Promise<KeyNameCheck>;
    publicKey(ref: string): Promise<string>;
    changePassphrase(ref: string, oldPassphrase: string, newPassphrase: string): Promise<KeyInfo>;
    remove(ref: string): Promise<TrashResult>;
    fixPermissions(ref: string): Promise<{ message: string }>;
  };
  knownHosts: {
    list(): Promise<KnownHostEntry[]>;
    removeLine(line: number, fingerprint: string): Promise<void>;
    removeHost(host: string, port?: string): Promise<{ removed: boolean }>;
    scan(host: string, port?: string): Promise<ScannedHostKey[]>;
    trust(lines: string[]): Promise<{ added: number }>;
  };
  agent: {
    status(): Promise<AgentStatus>;
    add(ref: string): Promise<{ added: string }>;
    remove(ref: string): Promise<{ removed: string }>;
    clear(): Promise<{ cleared: true }>;
  };
  backups: {
    list(kind?: BackupKind): Promise<BackupInfo[]>;
    read(id: string): Promise<string>;
    restore(id: string): Promise<BackupKind>;
  };
  git: {
    identity(): Promise<GitIdentity>;
    setSshCommand(command: string): Promise<void>;
  };
  settings: {
    get(): Promise<Settings>;
    update(patch: Partial<Settings>): Promise<Settings>;
  };
  app: {
    info(): Promise<AppInfo>;
    /** Versions and environment for Settings > About (slower: runs ssh -V / git --version). */
    about(): Promise<AboutInfo>;
    openExternal(url: string): Promise<void>;
    copy(text: string): Promise<void>;
    pickDirectory(): Promise<string | null>;
    pickFile(): Promise<string | null>;
    /** Open a terminal running `ssh <alias>`. */
    connect(alias: string): Promise<void>;
    /** Open a terminal running `ssh-add <key>` so the passphrase can be typed. */
    addKeyInTerminal(ref: string): Promise<void>;
    revealPath(path: string): Promise<void>;
    /** Match native window chrome to the renderer theme. */
    setTheme(mode: 'system' | 'light' | 'dark'): Promise<void>;
    /** Are the `lanyard` / `lny` commands on the PATH? (The installer manages them.) */
    cliStatus(): Promise<CliInstallStatus>;
    /** Pop up the application menu (File, Edit, View, ...) at a point in the window. */
    showAppMenu(x: number, y: number): Promise<void>;
    isMaximized(): Promise<boolean>;
    minimizeWindow(): Promise<void>;
    toggleMaximize(): Promise<boolean>;
    closeWindow(): Promise<void>;
    /** Colour the native window buttons drawn over the custom title bar. */
    setTitleBarColors(color: string, symbolColor: string): Promise<void>;
  };
}

export type ApiNamespace = keyof LanyardApi;

export type IpcResponse<T = unknown> = { ok: true; data: T } | { ok: false; error: string; code?: string };

/** What the preload script exposes on `window.lanyard`. */
export interface PreloadBridge {
  invoke(namespace: string, method: string, args: unknown[]): Promise<IpcResponse>;
  onChanged(listener: (topics: ChangeTopic[]) => void): () => void;
  onNavigate(listener: (request: NavigateRequest) => void): () => void;
  onCommand(listener: (command: AppCommand) => void): () => void;
}
