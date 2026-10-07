import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { renderShims, SHIM_MARKER, type ShimTarget } from '../src/core/cli/shims';

const root = path.resolve(__dirname, '..');
const built = fs.existsSync(path.join(root, 'out', 'main', 'cli.js'));
const { version } = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')) as { version: string };

/** Write the shims to a folder with a space in its name and run `lanyard --version` through cmd.exe. */
function runShim(target: ShimTarget): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lanyard shim '));
  try {
    const [shim] = renderShims(target, 'win32');
    const file = path.join(dir, shim.fileName);
    fs.writeFileSync(file, shim.content);
    return execFileSync('cmd.exe', ['/d', '/c', file, '--version'], { encoding: 'utf8' }).trim();
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

describe.skipIf(process.platform !== 'win32' || !built)('Windows shims actually run', () => {
  const script = path.join(root, 'bin', 'lanyard.js');

  it('with node', () => {
    expect(runShim({ exe: 'node', script })).toBe(version);
  });
});

describe('CLI launcher shims', () => {
  it('targets the bundled Node runtime on Windows', () => {
    const [lanyard, lny] = renderShims(
      {
        exe: 'C:\\Program Files\\Lanyard\\node.exe',
        script: 'C:\\Program Files\\Lanyard\\resources\\cli\\lanyard.js',
      },
      'win32',
    );
    expect(lanyard.fileName).toBe('lanyard.cmd');
    expect(lny.fileName).toBe('lny.cmd');
    expect(lanyard.content).toContain(SHIM_MARKER);
    expect(lanyard.content).toContain('"C:\\Program Files\\Lanyard\\node.exe" "C:\\Program Files\\Lanyard\\resources\\cli\\lanyard.js" %*');
    expect(lanyard.content).toMatch(/\r\n$/);
    expect(lanyard.content).not.toContain('ELECTRON_RUN_AS_NODE');
  });

  it('uses node for a source checkout and quotes POSIX paths safely', () => {
    const [shim] = renderShims({ exe: 'node', script: "/home/o'neil/lanyard/bin/lanyard.js" }, 'linux');
    expect(shim.fileName).toBe('lanyard');
    expect(shim.content.startsWith('#!/bin/sh\n')).toBe(true);
    expect(shim.content).toContain(`exec 'node' '/home/o'\\''neil/lanyard/bin/lanyard.js' "$@"`);
    expect(shim.content).not.toContain('ELECTRON_RUN_AS_NODE');
  });
});
