// Start the sidecar the way the app does, send it one request against a
// throwaway ~/.ssh, and check the answer. Used by the release workflow.
//
//   node scripts/smoke-sidecar.mjs <node-binary> <sidecar/index.js>
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const [nodeBin, script] = process.argv.slice(2);
if (!nodeBin || !script) {
  console.error('usage: smoke-sidecar.mjs <node-binary> <sidecar/index.js>');
  process.exit(2);
}

const home = fs.mkdtempSync(path.join(os.tmpdir(), 'lanyard-smoke-'));
fs.mkdirSync(path.join(home, '.ssh'));
fs.writeFileSync(path.join(home, '.ssh', 'config'), 'Host smoke\n  HostName 192.0.2.1\n');

const child = spawn(nodeBin, [script], {
  env: { ...process.env, LANYARD_SSH_DIR: path.join(home, '.ssh'), LANYARD_HOME: path.join(home, '.lanyard') },
  stdio: ['pipe', 'pipe', 'inherit'],
});

const finish = (ok, message) => {
  console.log(`${ok ? 'ok' : 'FAILED'}: ${message}`);
  child.kill();
  fs.rmSync(home, { recursive: true, force: true });
  process.exit(ok ? 0 : 1);
};

const timer = setTimeout(() => finish(false, 'no reply from the sidecar within 30 s'), 30_000);
let buffer = '';
child.stdout.on('data', (chunk) => {
  buffer += chunk;
  for (const line of buffer.split('\n').slice(0, -1)) {
    let msg;
    try {
      msg = JSON.parse(line);
    } catch {
      continue;
    }
    if (msg.id !== 1) continue; // events
    clearTimeout(timer);
    const aliases = Array.isArray(msg.data) ? msg.data.map((h) => h.alias) : [];
    if (msg.ok && aliases.includes('smoke')) finish(true, `sidecar listed hosts ${JSON.stringify(aliases)}`);
    else finish(false, `unexpected reply ${line.slice(0, 200)}`);
  }
  buffer = buffer.slice(buffer.lastIndexOf('\n') + 1);
});
child.on('exit', (code) => finish(false, `sidecar exited early (code ${code})`));
child.stdin.write(`${JSON.stringify({ id: 1, namespace: 'hosts', method: 'list', args: [] })}\n`);
