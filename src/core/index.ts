/**
 * Public facade of the core. The app's Node sidecar and the CLI both talk
 * to SSH exclusively through this module; nothing outside src/core touches
 * ~/.ssh directly.
 */

import { migrateLegacyData } from './state/migrate';

export { paths, describePaths } from './config/paths';
export * as providers from './providers';
export * as accounts from './services/accounts.service';
export * as hosts from './services/hosts.service';
export * as settings from './services/settings.service';
export * as keys from './keys/keys.service';
export * as knownHosts from './known-hosts/known-hosts.service';
export * as agent from './agent/agent.service';
export * as backups from './backups/backup.service';
export * as git from './git/git.service';
export * as terminal from './terminal/terminal';
export { watch } from './state/watch';
export { LanyardError } from './utils/exec';

// Move ~/.sshm (pre-rename) to ~/.lanyard before anything reads state.
migrateLegacyData();
