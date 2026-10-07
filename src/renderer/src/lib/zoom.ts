/**
 * Renderer-side zoom (replaces the Electron main-process zoom handler).
 * Listens for the zoom shortcuts, applies them via Tauri's webview zoom, and
 * persists the level across restarts in localStorage.
 */

import { getCurrentWebview } from '@tauri-apps/api/webview';
import { nextZoomLevel, zoomActionFor, zoomLevelToScale, type ZoomAction } from '../../../shared/zoom';
import type { AppCommand } from '../../../shared/ipc';
import { read as readStored, write as writeStored } from './appearance';

const STORAGE_KEY = 'lanyard:zoom-level';

export function storedZoomLevel(): number {
  const raw = readStored(STORAGE_KEY);
  const n = raw === null ? 0 : Number(raw);
  return Number.isFinite(n) ? n : 0;
}

const MENU_COMMANDS: Partial<Record<AppCommand, ZoomAction>> = { 'zoom-in': 'in', 'zoom-out': 'out', 'zoom-reset': 'reset' };

/** Zoom from the keyboard shortcuts and from View → Zoom In / Zoom Out / Actual Size. */
export function installZoom(): void {
  let level = storedZoomLevel();
  const webview = getCurrentWebview();
  if (level !== 0) void webview.setZoom(zoomLevelToScale(level));

  const apply = (action: ZoomAction) => {
    level = nextZoomLevel(level, action);
    writeStored(STORAGE_KEY, String(level));
    void webview.setZoom(zoomLevelToScale(level));
  };

  window.addEventListener('keydown', (e) => {
    const action = zoomActionFor(
      { type: 'keyDown', key: e.key, code: e.code, control: e.ctrlKey, meta: e.metaKey, alt: e.altKey },
      navigator.userAgent.includes('Mac'),
    );
    if (!action) return;
    e.preventDefault();
    apply(action);
  });

  window.lanyard.onCommand((command) => {
    const action = MENU_COMMANDS[command];
    if (action) apply(action);
  });
}
