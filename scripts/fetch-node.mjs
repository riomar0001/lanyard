// Download the Node.js runtime the desktop app bundles for its sidecar
// (tauri.conf.json `externalBin`: src-tauri/binaries/node-<target-triple>).
//
//   node scripts/fetch-node.mjs [--target <rust-target-triple>]
//
// The target defaults to the Rust host (rustc -vV). The download is checked
// against Node's published SHA-256 sums, and skipped when the right version is
// already in place.
import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const NODE_VERSION = '24.21.0';

// Rust target triple -> Node.js release platform.
const PLATFORMS = {
  'x86_64-pc-windows-msvc': { dist: 'win-x64', ext: 'zip', binary: 'node.exe' },
  'aarch64-pc-windows-msvc': { dist: 'win-arm64', ext: 'zip', binary: 'node.exe' },
  'aarch64-apple-darwin': { dist: 'darwin-arm64', ext: 'tar.gz', binary: 'bin/node' },
  'x86_64-apple-darwin': { dist: 'darwin-x64', ext: 'tar.gz', binary: 'bin/node' },
  'x86_64-unknown-linux-gnu': { dist: 'linux-x64', ext: 'tar.xz', binary: 'bin/node' },
  'aarch64-unknown-linux-gnu': { dist: 'linux-arm64', ext: 'tar.xz', binary: 'bin/node' },
};

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'src-tauri', 'binaries');

function hostTriple() {
  try {
    const m = execFileSync('rustc', ['-vV'], { encoding: 'utf8' }).match(/^host: (\S+)$/m);
    if (m) return m[1];
  } catch {
    // no Rust on PATH: derive it from the running Node
  }
  const arch = { x64: 'x86_64', arm64: 'aarch64' }[process.arch];
  const rest = { win32: 'pc-windows-msvc', darwin: 'apple-darwin', linux: 'unknown-linux-gnu' }[process.platform];
  return `${arch}-${rest}`;
}

async function download(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

const arg = process.argv.indexOf('--target');
const target = arg > 0 ? process.argv[arg + 1] : process.env.TAURI_TARGET || hostTriple();
const platform = PLATFORMS[target];
if (!platform) {
  console.error(`fetch-node: no Node.js build for target ${target}`);
  process.exit(1);
}

const dest = path.join(outDir, `node-${target}${target.includes('windows') ? '.exe' : ''}`);
const marker = `${dest}.version`;
if (fs.existsSync(dest) && fs.existsSync(marker) && fs.readFileSync(marker, 'utf8').trim() === NODE_VERSION) {
  console.log(`fetch-node: ${path.relative(root, dest)} is already Node ${NODE_VERSION}`);
  process.exit(0);
}

const base = `https://nodejs.org/dist/v${NODE_VERSION}`;
const archive = `node-v${NODE_VERSION}-${platform.dist}.${platform.ext}`;
console.log(`fetch-node: downloading ${archive}`);
const [data, sums] = await Promise.all([download(`${base}/${archive}`), download(`${base}/SHASUMS256.txt`)]);

const expected = sums
  .toString('utf8')
  .split('\n')
  .find((line) => line.endsWith(`  ${archive}`))
  ?.split(/\s+/)[0];
const actual = crypto.createHash('sha256').update(data).digest('hex');
if (!expected || expected !== actual) {
  console.error(`fetch-node: checksum mismatch for ${archive} (expected ${expected}, got ${actual})`);
  process.exit(1);
}

// tar handles zip on Windows (bsdtar) and .tar.xz/.tar.gz everywhere.
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'lanyard-node-'));
try {
  const file = path.join(work, archive);
  fs.writeFileSync(file, data);
  // On Windows use the system bsdtar: a GNU tar from Git Bash or MSYS earlier on
  // the PATH can't read zip files and takes "C:" for a remote host.
  const tar = process.platform === 'win32' ? path.join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'tar.exe') : 'tar';
  execFileSync(tar, ['-xf', archive], { cwd: work, stdio: 'inherit' });
  const binary = path.join(work, archive.replace(/\.(zip|tar\.gz|tar\.xz)$/, ''), platform.binary);
  fs.mkdirSync(outDir, { recursive: true });
  fs.copyFileSync(binary, dest);
  fs.chmodSync(dest, 0o755);
  fs.writeFileSync(marker, `${NODE_VERSION}\n`);
  console.log(`fetch-node: wrote ${path.relative(root, dest)} (Node ${NODE_VERSION}, sha256 verified)`);
} finally {
  fs.rmSync(work, { recursive: true, force: true });
}
