/**
 * Launcher scripts that put `lanyard` and `lny` on the PATH. Each one runs
 * bin/lanyard.js with Node: either the runtime bundled next to the desktop
 * app (LANYARD_APP_EXE points at it when the shim is installed from the app)
 * or the system `node` for a source checkout / npm install.
 */

export const SHIM_MARKER = 'Installed by Lanyard';
export const COMMAND_NAMES = ['lanyard', 'lny'] as const;

export interface ShimTarget {
  /** Node runtime to use: the bundled runtime's path (packaged) or 'node' (source). */
  exe: string;
  /** Absolute path of bin/lanyard.js. */
  script: string;
}

export interface Shim {
  fileName: string;
  content: string;
}

const shQuote = (s: string) => `'${s.replace(/'/g, `'\\''`)}'`;

function windowsShim(t: ShimTarget): string {
  return (
    [
      '@echo off',
      `rem ${SHIM_MARKER} (Settings > Command line). Safe to delete.`,
      `"${t.exe}" "${t.script}" %*`,
      'exit /b %ERRORLEVEL%',
    ].join('\r\n') + '\r\n'
  );
}

function posixShim(t: ShimTarget): string {
  return [
    '#!/bin/sh',
    `# ${SHIM_MARKER} (Settings > Command line). Safe to delete.`,
    `exec ${shQuote(t.exe)} ${shQuote(t.script)} "$@"`,
    '',
  ].join('\n');
}

export function renderShims(target: ShimTarget, platform: NodeJS.Platform = process.platform): Shim[] {
  const win = platform === 'win32';
  return COMMAND_NAMES.map((name) => ({
    fileName: win ? `${name}.cmd` : name,
    content: win ? windowsShim(target) : posixShim(target),
  }));
}
