/** ssh-agent access through ssh-add. */

import { run, LanyardError } from '../utils/exec';
import { isWin } from '../utils/fs-safe';
import * as keys from '../keys/keys.service';
import type { AgentIdentity, AgentStatus } from '../../shared/types';

const NOT_RUNNING = isWin
  ? {
      message: 'The OpenSSH Authentication Agent service is not running. In an elevated PowerShell run:',
      command: 'Get-Service ssh-agent | Set-Service -StartupType Automatic; Start-Service ssh-agent',
    }
  : { message: 'No agent found. Start one with:', command: 'eval "$(ssh-agent -s)"' };

export async function status(): Promise<AgentStatus> {
  let r;
  try {
    r = await run('ssh-add', ['-l']);
  } catch (err) {
    return { running: false, identities: [], message: (err as Error).message };
  }
  // ssh-add -l exits 0 with keys, 1 when the agent is empty, 2 when unreachable.
  if (r.code === 2 || /could not open a connection|error connecting to agent/i.test(r.stderr)) {
    return { running: false, identities: [], ...NOT_RUNNING };
  }
  const identities: AgentIdentity[] = [];
  for (const line of r.stdout.split(/\r?\n/)) {
    const m = line.match(/^(\d+)\s+(\S+)\s+(.*?)\s+\(([^)]+)\)\s*$/);
    if (m) identities.push({ bits: Number(m[1]), fingerprint: m[2], comment: m[3], type: m[4] });
  }
  return { running: true, identities, message: identities.length ? '' : 'The agent has no identities.' };
}

function privatePath(ref: string): string {
  const key = keys.get(ref);
  if (!key.path) throw new Error('Only the public half of this key exists.');
  return key.path;
}

/**
 * Command that adds a key with an interactive passphrase prompt. The CLI runs
 * it with an inherited TTY; the desktop app opens it in a terminal window.
 */
export function interactiveAddCommand(ref: string): { cmd: string; args: string[] } {
  return { cmd: 'ssh-add', args: [privatePath(ref)] };
}

/** Add an unencrypted key non-interactively. */
export async function add(ref: string): Promise<{ added: string }> {
  const key = keys.get(ref);
  const file = privatePath(ref);
  if (key.encrypted) {
    throw new LanyardError('This key is passphrase-protected; it must be added from a terminal.', 'NEEDS_PASSPHRASE');
  }
  const r = await run('ssh-add', [file], { timeout: 15000 });
  if (r.code !== 0) throw new Error((r.stderr || r.stdout).trim() || 'ssh-add failed');
  return { added: key.name };
}

export async function remove(ref: string): Promise<{ removed: string }> {
  const key = keys.get(ref);
  const r = await run('ssh-add', ['-d', key.publicPath ?? key.path!]);
  if (r.code !== 0) throw new Error((r.stderr || r.stdout).trim() || 'ssh-add -d failed');
  return { removed: key.name };
}

export async function clear(): Promise<{ cleared: true }> {
  const r = await run('ssh-add', ['-D']);
  if (r.code !== 0) throw new Error((r.stderr || r.stdout).trim() || 'ssh-add -D failed');
  return { cleared: true };
}
