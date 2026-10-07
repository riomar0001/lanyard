import { describe, expect, it } from 'vitest';
import { desktopAppCandidates } from '../src/cli/commands/maintenance';

describe('finding the desktop app', () => {
  it('looks in the Windows install folders, after LANYARD_APP_EXE', () => {
    const env = {
      LANYARD_APP_EXE: 'D:\\Apps\\Lanyard.exe',
      LOCALAPPDATA: 'C:\\Users\\jane\\AppData\\Local',
      ProgramFiles: 'C:\\Program Files',
    };
    const list = desktopAppCandidates('win32', env, 'C:\\Users\\jane');
    expect(list[0]).toBe('D:\\Apps\\Lanyard.exe');
    expect(list).toContain('C:\\Users\\jane\\AppData\\Local\\Lanyard\\lanyard.exe');
    expect(list).toContain('C:\\Program Files\\Lanyard\\Lanyard.exe');
  });

  it('opens the .app bundle on macOS', () => {
    expect(desktopAppCandidates('darwin', {}, '/Users/jane')).toEqual([
      '/Applications/Lanyard.app',
      '/Users/jane/Applications/Lanyard.app',
    ]);
  });

  it('only offers AppImages that exist on Linux', () => {
    const list = desktopAppCandidates('linux', {}, '/nonexistent-home');
    expect(list.some((p) => p.startsWith('/nonexistent-home'))).toBe(false);
  });
});
