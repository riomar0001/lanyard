/**
 * Tray menu as data. The Tauri shell renders this spec natively and sends
 * item ids back via `menu.act`; all domain logic stays in TypeScript. Ids
 * prefixed `app:` are handled by the shell itself (open window, quit,
 * autostart toggle) and never reach act().
 *
 * Id grammar:
 *   use:<providerId>:<name|''>   switch active account ('' = none)
 *   connect:<alias>              open a terminal with ssh <alias>
 *   test:<alias>                 ssh -T test, result emitted as lanyard:changed
 *   setkey:<alias>:<keyRef|''>   set a host's IdentityFile ('' = ssh default)
 *   nav:<page>[:<intent>]        show the window on a page
 *   test-active                  test the active account of every provider
 */

import * as core from '../core';
import type { HostEntry, KeyInfo, ProviderOverview } from '../shared/types';
import { openInTerminal } from '../core/api-domain';
import { IPC_CHANNELS, type ChangeTopic } from '../shared/ipc';

export interface TrayMenuItem {
  id?: string;
  label?: string;
  type?: 'separator' | 'radio' | 'checkbox';
  checked?: boolean;
  enabled?: boolean;
  submenu?: TrayMenuItem[];
}

export interface TraySpec {
  tooltip: string;
  items: TrayMenuItem[];
}

export type MenuEmit = (event: string, payload: unknown) => void;

export function traySpec(): TraySpec {
  let providers: ProviderOverview[] = [];
  try {
    providers = core.accounts.overview().filter((p) => p.accounts.length);
  } catch {
    // leave empty; the menu still opens
  }

  const items: TrayMenuItem[] = [
    { id: 'app:open', label: 'Open Lanyard' },
    { type: 'separator' },
    ...providers.map((p): TrayMenuItem => ({
      label: `${p.name}  ·  ${p.active ?? 'none'}`,
      submenu: [
        ...p.accounts.map((a): TrayMenuItem => ({
          id: `use:${p.id}:${a.name}`,
          label: a.name + (a.lastTest?.username ? `  (${a.lastTest.username})` : ''),
          type: 'radio',
          checked: a.active,
        })),
        { id: `use:${p.id}:`, label: 'None (use default SSH keys)', type: 'radio', checked: !p.active },
      ],
    })),
    ...(providers.length ? [] : [{ label: 'No git accounts yet', enabled: false } as TrayMenuItem]),
    { id: 'test-active', label: 'Test active accounts', enabled: providers.some((p) => p.active) },
    { type: 'separator' },
    { label: 'Hosts', submenu: hostsMenu(providers) },
    { type: 'separator' },
    { id: 'nav:hosts', label: 'Manage hosts…' },
    { id: 'nav:keys', label: 'Manage keys…' },
    { id: 'nav:agent', label: 'ssh-agent…' },
    { type: 'separator' },
    { id: 'app:toggle-login', label: 'Start at login', type: 'checkbox', checked: safeLaunchAtLogin() },
    { id: 'app:quit', label: 'Quit Lanyard' },
  ];

  const active = providers.filter((p) => p.active).map((p) => `${p.name}: ${p.active}`);
  return { tooltip: ['Lanyard', ...active].join('\n'), items };
}

function safeLaunchAtLogin(): boolean {
  try {
    return core.settings.get().launchAtLogin;
  } catch {
    return false;
  }
}

function hostsMenu(providers: ProviderOverview[]): TrayMenuItem[] {
  let hosts: HostEntry[];
  let keys: KeyInfo[];
  try {
    hosts = core.hosts.list();
    keys = core.keys.list().filter((k) => k.hasPrivate);
  } catch {
    return [{ label: 'Could not read ~/.ssh/config', enabled: false }];
  }
  return buildHostsSpec(hosts, keys, providers);
}

/**
 * Mirrors the structure of shared/tray-hosts-menu.ts's buildHostsMenu (kept in
 * sync by that module's tests), but stamps each item with an action id
 * instead of a click callback.
 */
export function buildHostsSpec(hosts: HostEntry[], keys: KeyInfo[], providers: ProviderOverview[]): TrayMenuItem[] {
  const servers = hosts.filter((h) => !h.managed && !h.isPattern && !h.gitProvider);
  const ownGitBlocks = hosts.filter((h) => !h.managed && !h.isPattern && h.gitProvider);
  const managedAliases = new Set(hosts.filter((h) => h.managed).flatMap((h) => h.aliases));

  const keyRadios = (h: HostEntry): TrayMenuItem[] => {
    const current = keys.find((k) => core.keys.isKeyAt(k, h.identityFile));
    const missing = h.identityFile && !current ? (h.identityFile.split(/[\\/]/).pop() ?? null) : null;
    return [
      { label: 'SSH key', enabled: false },
      ...keys.slice(0, 25).map((k): TrayMenuItem => ({
        id: `setkey:${h.alias}:${k.path ?? k.name}`,
        label: `${k.name}${k.encrypted ? '  🔒' : ''}`,
        type: 'radio',
        checked: k === current,
      })),
      ...(missing ? [{ label: `${missing} (not in ~/.ssh)`, type: 'radio' as const, checked: true, enabled: false }] : []),
      { id: `setkey:${h.alias}:`, label: 'SSH default keys', type: 'radio', checked: !h.identityFile },
    ];
  };

  const items: TrayMenuItem[] = [{ label: 'Servers', enabled: false }];
  if (servers.length) {
    items.push(
      ...servers.slice(0, 30).map((h): TrayMenuItem => ({
        label: h.hostName ? `${h.alias}  →  ${h.hostName}` : h.alias,
        submenu: [
          { id: `connect:${h.alias}`, label: `Connect to ${h.hostName || h.alias}` },
          { id: `test:${h.alias}`, label: 'Test login' },
          { type: 'separator' },
          ...keyRadios(h),
        ],
      })),
    );
  } else {
    items.push({ id: 'nav:hosts:add-host', label: 'Add server…' });
  }

  const accountItems = providers.flatMap((p) =>
    p.accounts.map((a): TrayMenuItem => ({
      label: `${a.alias}${a.active ? '  ·  active' : ''}`,
      submenu: [
        { id: `test:${a.alias}`, label: 'Test (ssh -T)' },
        a.active ? { label: `Active ${p.name} account`, enabled: false } : { id: `use:${p.id}:${a.name}`, label: `Use ${a.name}` },
      ],
    })),
  );
  const ownItems = ownGitBlocks.map((h): TrayMenuItem => ({
    label: `${h.alias}${h.aliases.some((x) => managedAliases.has(x)) ? '  ·  overridden' : ''}`,
    submenu: [{ id: `test:${h.alias}`, label: 'Test (ssh -T)' }, { type: 'separator' }, ...keyRadios(h)],
  }));
  if (accountItems.length || ownItems.length) {
    items.push({ type: 'separator' }, { label: 'Git hosts', enabled: false }, ...accountItems, ...ownItems);
  }
  return items;
}

/** Execute a non-`app:` menu action, then tell the shell to refresh. */
export async function act(id: string, emit: MenuEmit): Promise<void> {
  const topics: ChangeTopic[] = ['state', 'config'];
  try {
    if (id === 'test-active') {
      const active = core.accounts.overview().filter((p) => p.active);
      await Promise.all(
        active.map((p) =>
          core.accounts.test(p.id).catch((err) => ({
            error: (err as Error)?.message ?? String(err),
          })),
        ),
      );
    } else if (id.startsWith('use:')) {
      const rest = id.slice(4);
      const sep = rest.indexOf(':');
      const providerId = sep < 0 ? rest : rest.slice(0, sep);
      const name = sep < 0 ? '' : rest.slice(sep + 1);
      await core.accounts.use(providerId, name === '' ? null : name);
    } else if (id.startsWith('connect:')) {
      const alias = id.slice(8);
      openInTerminal('ssh', [alias], `ssh ${alias}`);
    } else if (id.startsWith('test:')) {
      await core.hosts.test(id.slice(5));
    } else if (id.startsWith('setkey:')) {
      const rest = id.slice(7);
      const sep = rest.indexOf(':');
      const alias = sep < 0 ? rest : rest.slice(0, sep);
      const keyRef = sep < 0 ? '' : rest.slice(sep + 1);
      core.hosts.setKey(core.hosts.assertAlias(alias), keyRef === '' ? null : keyRef);
    } else if (id.startsWith('nav:')) {
      const parts = id.slice(4).split(':');
      emit(IPC_CHANNELS.navigate, { page: parts[0], intent: parts[1] });
      return;
    }
  } finally {
    emit(IPC_CHANNELS.changed, topics);
  }
}
