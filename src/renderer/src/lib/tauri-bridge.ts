/**
 * Tauri replacement for the old Electron preload bridge. Installs the same
 * `window.lanyard` surface the renderer was written against, so no React code
 * changes. Domain calls travel as one `api_invoke` Tauri command; shell-side
 * pushes arrive as Tauri events on the legacy channel names.
 */

import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import {
  IPC_CHANNELS,
  type AppCommand,
  type ChangeTopic,
  type IpcResponse,
  type NavigateRequest,
  type PreloadBridge,
} from '../../../shared/ipc';

function subscribe<T>(channel: string, listener: (payload: T) => void): () => void {
  let unlisten: (() => void) | undefined;
  let cancelled = false;
  listen<T>(channel, (e) => listener(e.payload)).then(
    (u) => {
      // Unsubscribed before Tauri confirmed: drop the listener right away.
      if (cancelled) u();
      else unlisten = u;
    },
    // Fails loudly instead of silently: without a capability allowing
    // core:event:allow-listen (src-tauri/capabilities), no event arrives.
    (err: unknown) => console.error(`Could not listen to ${channel}:`, err),
  );
  return () => {
    cancelled = true;
    unlisten?.();
  };
}

export function installBridge(): void {
  const bridge: PreloadBridge = {
    invoke: (namespace, method, args) => invoke<IpcResponse>('api_invoke', { namespace, method, args }),
    onChanged: (listener) => subscribe<ChangeTopic[]>(IPC_CHANNELS.changed, listener),
    onNavigate: (listener) => subscribe<NavigateRequest>(IPC_CHANNELS.navigate, listener),
    onCommand: (listener) => subscribe<AppCommand>(IPC_CHANNELS.command, listener),
  };
  (window as unknown as { lanyard: PreloadBridge }).lanyard = bridge;
}
