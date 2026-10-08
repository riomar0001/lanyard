/**
 * Domain types shared by the core, the CLI, the app's sidecar and the
 * React renderer. Keep this file free of runtime code and Node/DOM imports.
 */

// ------------------------------------------------------------- ssh config

export interface HostOption {
  key: string;
  value: string;
}

export interface HostEntry {
  /** Position among user blocks (or among managed blocks when `managed`). */
  index: number;
  managed: boolean;
  kind: 'Host' | 'Match';
  patterns: string;
  alias: string;
  aliases: string[];
  isPattern: boolean;
  hostName: string;
  user: string;
  port: string;
  identityFile: string;
  options: HostOption[];
  comment: string;
  /**
   * Id of the git provider this host points at (github.com, an account alias,
   * HostName hf.co, ...). Git hosts accept `ssh -T` but refuse shells, so they
   * are tested rather than connected to.
   */
  gitProvider?: string | null;
}

export interface HostInput {
  /** Omit (or null) to create a new host. */
  index?: number | null;
  /** The patterns the block had when it was loaded; guards against stale edits. */
  originalPatterns?: string;
  patterns: string;
  options: HostOption[];
  comment?: string;
}

export interface ConfigValidation {
  ok: boolean;
  error?: string;
  skipped?: boolean;
}

// ------------------------------------------------------------- providers

export interface ProviderInfo {
  id: string;
  name: string;
  /** Host names matched by the active-account block; the first is primary. */
  hosts: string[];
  hostname?: string;
  port?: string;
  user: string;
  color: string;
  keysUrl: string;
  keyHint?: string;
  custom?: boolean;
}

export interface CustomProviderInput {
  id: string;
  name?: string;
  hostname: string;
  port?: string | number;
  user?: string;
  keysUrl?: string;
}

// ------------------------------------------------------------- accounts

export interface LastTest {
  ok: boolean;
  message: string;
  username: string;
  at: string;
}

export interface Account {
  id: string;
  provider: string;
  name: string;
  keyPath: string;
  gitName: string;
  gitEmail: string;
  setGitIdentity: boolean;
  createdAt: string;
  lastTest?: LastTest;
}

export interface AccountView extends Account {
  alias: string;
  active: boolean;
  keyExists: boolean;
  keyEncrypted: boolean;
  providerName?: string;
}

export interface ProviderOverview extends ProviderInfo {
  accounts: AccountView[];
  active: string | null;
  conflicts: string[];
}

export type KeyType = 'ed25519' | 'rsa' | 'ecdsa';

export interface AddAccountInput {
  provider: string;
  name: string;
  keyPath?: string;
  generate?: { type?: KeyType; passphrase?: string; comment?: string; fileName?: string } | null;
  gitName?: string;
  gitEmail?: string;
  setGitIdentity?: boolean;
  activate?: boolean;
}

export interface AddAccountResult {
  account: AccountView;
  publicKey: string | null;
  keysUrl: string;
  keyHint: string;
}

export interface UpdateAccountInput {
  name?: string;
  keyPath?: string;
  gitName?: string;
  gitEmail?: string;
  setGitIdentity?: boolean;
}

export interface UseResult {
  provider: string;
  active: string | null;
  gitIdentityApplied: boolean;
  account?: AccountView;
}

export interface TestResult {
  ok: boolean;
  message: string;
  output: string;
  username?: string;
  hint?: string;
}

export interface AccountTestResult extends TestResult {
  account: string;
  target: string;
}

export interface RepoRewriteResult {
  remote: string;
  from: string;
  to: string;
}

// ------------------------------------------------------------- keys

export interface KeyInfo {
  name: string;
  path: string | null;
  tildePath: string;
  publicPath: string | null;
  hasPrivate: boolean;
  type: string;
  algorithm: string;
  fingerprint: string;
  comment: string;
  encrypted: boolean;
  modifiedAt: string;
}

export interface GenerateKeyInput {
  name: string;
  type?: KeyType;
  bits?: number | string;
  comment?: string;
  passphrase?: string;
}

export interface KeyNameCheck {
  valid: boolean;
  exists: boolean;
  /** A free alternative when the name is taken, e.g. "id_ed25519_2". */
  suggestion?: string;
  message?: string;
}

export interface TrashResult {
  trashDir: string;
  moved: string[];
}

// ------------------------------------------------------------- known_hosts

export interface KnownHostEntry {
  line: number;
  marker: string;
  hashed: boolean;
  hosts: string[];
  hostsField: string;
  type: string;
  fingerprint: string;
  comment: string;
}

export interface ScannedHostKey extends KnownHostEntry {
  raw: string;
}

// ------------------------------------------------------------- agent

export interface AgentIdentity {
  bits: number;
  fingerprint: string;
  comment: string;
  type: string;
}

export interface AgentStatus {
  running: boolean;
  identities: AgentIdentity[];
  message: string;
  /** Command that starts the agent, shown after `message` when it is not reachable. */
  command?: string;
}

// ------------------------------------------------------------- misc

export type BackupKind = 'config' | 'known_hosts';

export interface BackupInfo {
  id: string;
  kind: BackupKind | 'unknown';
  createdAt: string;
  reason: string;
  size: number;
}

export interface GitIdentity {
  name: string;
  email: string;
  sshCommand: string;
}

export interface Settings {
  closeToTray: boolean;
  startHidden: boolean;
  launchAtLogin: boolean;
  terminal: string;
  backupLimit: number;
}

export interface LanyardPaths {
  sshDir: string;
  config: string;
  knownHosts: string;
  dataDir: string;
  backups: string;
}
