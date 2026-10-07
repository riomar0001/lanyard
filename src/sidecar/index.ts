/**
 * Sidecar host: runs the domain API outside any browser process. The Tauri
 * Rust backend spawns this and talks to it over newline-delimited JSON on
 * stdio:
 *   request : { id, namespace, method, args }
 *   response: { id, ok: true, data } | { id, ok: false, error, code? }
 *   event   : { event: string, payload }   (unsolicited, no id)
 * Domain errors keep their message and code, mirroring the old IPC envelope.
 */

import { createInterface } from 'node:readline';
import fs from 'node:fs';
import path from 'node:path';
import { createDomainApi } from '../core/api-domain';
import * as menu from './menu';
import * as core from '../core';
import { IPC_CHANNELS } from '../shared/ipc';
import pkg from '../../package.json';

/// The domain API with the tray menu namespace attached below.
type SidecarApi = ReturnType<typeof createDomainApi> & {
  menu: { traySpec(): Promise<unknown>; act(id: string): Promise<void> };
};

// stdout is the protocol channel; stray logs must not corrupt it.
const stderr = (...args: unknown[]) => process.stderr.write(args.map(String).join(' ') + '\n');
console.log = stderr;
console.info = stderr;
console.warn = stderr;

interface Request {
  id: number;
  namespace: string;
  method: string;
  args: unknown[];
}

function cliHint(): string {
  const here = path.dirname(process.argv[1] ?? __filename);
  // Packaged: sidecar lives in resources/sidecar, CLI shims in resources/cli.
  const shim = process.platform === 'win32' ? 'lanyard.cmd' : 'lanyard';
  const packagedShim = path.join(here, '..', 'cli', shim);
  if (fs.existsSync(packagedShim)) return `"${packagedShim}"`;
  return `node "${path.join(process.cwd(), 'bin', 'lanyard.js')}"`;
}

const api = createDomainApi({
  version: pkg.version,
  packaged: !!(process as unknown as { pkg?: unknown }).pkg || process.env.LANYARD_PACKAGED === '1',
  cliHint: cliHint(),
  onSettingsChanged: () => send({ event: IPC_CHANNELS.changed, payload: ['state'] }),
}) as SidecarApi;

function send(msg: unknown): void {
  process.stdout.write(JSON.stringify(msg) + '\n');
}

// Tray menu namespace: the shell renders menu.traySpec() natively and feeds
// item ids back to menu.act().
api.menu = {
  traySpec: async () => menu.traySpec(),
  act: (id: string) => menu.act(id, (event, payload) => send({ event, payload })),
};

// File-change events: ~/.ssh and ~/.lanyard edits surface as change topics.
core.watch((topics) => send({ event: IPC_CHANNELS.changed, payload: topics }));

const rl = createInterface({ input: process.stdin });
rl.on('line', (line) => {
  void (async () => {
    let req: Request;
    try {
      req = JSON.parse(line) as Request;
    } catch {
      return;
    }
    // Only the API's own namespaces and methods: never inherited properties
    // such as __proto__ or constructor.
    const groups = api as unknown as Record<string, Record<string, unknown>>;
    const group = typeof req.namespace === 'string' && Object.hasOwn(groups, req.namespace) ? groups[req.namespace] : undefined;
    const fn = group && typeof req.method === 'string' && Object.hasOwn(group, req.method) ? group[req.method] : undefined;
    if (typeof fn !== 'function') {
      send({ id: req.id, ok: false, error: `Unknown method ${req.namespace}.${req.method}` });
      return;
    }
    try {
      const data = await (fn as (...a: unknown[]) => Promise<unknown>)(...(Array.isArray(req.args) ? req.args : []));
      send({ id: req.id, ok: true, data: data ?? null });
    } catch (err) {
      const e = err as Error & { code?: string };
      send({ id: req.id, ok: false, error: e.message, code: e.code });
    }
  })();
});
