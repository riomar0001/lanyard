/** Backups, config file utilities and launching the desktop app. */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import * as out from '../utils/output';
import { detached } from '../utils/system';
import type { CommandModule } from '../types';

const { c } = out;

const NO_DESKTOP_APP =
  "Couldn't find the Lanyard desktop app. Install it from https://lanyard.riomar.dev/download/ " +
  '(or set LANYARD_APP_EXE to its path) - every feature is also available as a command: `lanyard --help`.';

/**
 * Where the desktop app is usually installed, most likely first. On macOS the
 * entries are .app bundles (opened with `open`); elsewhere executables.
 */
export function desktopAppCandidates(
  platform: NodeJS.Platform = process.platform,
  env: NodeJS.ProcessEnv = process.env,
  home: string = os.homedir(),
): string[] {
  const explicit = env.LANYARD_APP_EXE ? [env.LANYARD_APP_EXE] : [];
  if (platform === 'win32') {
    // The installer's per-user location, then a per-machine install.
    const roots = [env.LOCALAPPDATA ?? path.join(home, 'AppData', 'Local'), env.ProgramFiles ?? 'C:\\Program Files'];
    return [...explicit, ...roots.flatMap((root) => ['lanyard.exe', 'Lanyard.exe'].map((exe) => path.win32.join(root, 'Lanyard', exe)))];
  }
  if (platform === 'darwin') return [...explicit, '/Applications/Lanyard.app', path.posix.join(home, 'Applications', 'Lanyard.app')];
  // Linux: the AppImage wherever people usually keep one.
  const dirs = [path.posix.join(home, 'Applications'), path.posix.join(home, '.local', 'bin'), '/opt'];
  const appImages = dirs.flatMap((dir) => {
    try {
      return fs
        .readdirSync(dir)
        .filter((f) => /^lanyard.*\.appimage$/i.test(f))
        .sort()
        .reverse() // newest version first
        .map((f) => path.posix.join(dir, f));
    } catch {
      return [];
    }
  });
  return [...explicit, ...appImages];
}

/** Open the desktop app, wherever it was installed. */
export function launchGui(): void {
  const app = desktopAppCandidates().find((p) => fs.existsSync(p));
  if (!app) throw new Error(NO_DESKTOP_APP);
  if (process.platform === 'darwin' && app.endsWith('.app')) detached('open', ['-a', app]);
  else detached(app, []);
}

export const register: CommandModule = (program, core) => {
  const backups = program.command('backups').description('list and restore config / known_hosts backups');
  backups
    .command('list', { isDefault: true })
    .description('list backups (newest first)')
    .action(
      out.action(() => {
        const list = core.backups.list();
        out.emit(list, () =>
          out.table(list, [
            { key: 'id', label: 'Id', format: (v) => c.bold(v) },
            { key: 'kind', label: 'File' },
            { key: 'createdAt', label: 'Created', format: (v: string) => new Date(v).toLocaleString() },
            { key: 'reason', label: 'Reason' },
          ]),
        );
      }),
    );
  backups
    .command('show <id>')
    .description('print a backup')
    .action(out.action((id: string) => out.print(core.backups.read(id))));
  backups
    .command('restore <id>')
    .description('restore a backup (the current file is backed up first)')
    .action(
      out.action((id: string) => {
        const kind = core.backups.restore(id);
        out.ok(`Restored ${kind} from ${id}`);
      }),
    );

  const config = program.command('config').description('ssh config file utilities');
  config
    .command('path')
    .description('print the paths Lanyard uses')
    .action(
      out.action(() => {
        const data = core.describePaths();
        out.emit(data, () => Object.entries(data).forEach(([k, v]) => out.print(`${c.dim(k.padEnd(11))} ${v}`)));
      }),
    );
  config
    .command('sync')
    .description('regenerate the managed section from saved accounts')
    .action(
      out.action(() => {
        const changed = core.accounts.sync(undefined, 'manual-sync');
        out.ok(changed ? 'Managed section rewritten' : 'Already in sync');
      }),
    );
  config
    .command('validate')
    .description('ask OpenSSH whether ~/.ssh/config parses')
    .action(
      out.action(async () => {
        const r = await core.hosts.validate();
        if (r.ok) return out.ok(r.skipped ? 'ssh not found; validation skipped' : 'Config is valid');
        out.print(`${c.red('✖')} ${r.error}`);
        process.exitCode = 1;
      }),
    );

  program
    .command('gui')
    .alias('open')
    .description('open the desktop app')
    .action(
      out.action(() => {
        launchGui();
        out.ok('Launching Lanyard…');
      }),
    );
};
