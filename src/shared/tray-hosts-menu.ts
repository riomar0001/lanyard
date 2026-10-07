/**
 * The tray's Hosts submenu, as a pure function of the data so it can be
 * unit-tested (native menus can't be inspected or screenshotted). Mirrors the
 * Hosts page: servers, then git hosts - one entry per account plus the user's
 * own git blocks - in a stable order.
 */

import type { HostEntry, KeyInfo, ProviderOverview } from './types';

/**
 * Shell-neutral menu description. The Rust tray builder maps this 1:1 onto
 * tauri menu items; tests assert on it directly.
 */
export interface MenuItemSpec {
  label?: string;
  type?: 'normal' | 'separator' | 'radio';
  checked?: boolean;
  enabled?: boolean;
  submenu?: MenuItemSpec[];
  click?: (...args: unknown[]) => void;
}

export interface HostsMenuData {
  hosts: HostEntry[];
  keys: KeyInfo[];
  /** Providers that have accounts, in display order. */
  providers: ProviderOverview[];
  /** Does an IdentityFile value point at this key? (path spellings differ) */
  isKeyAt: (key: KeyInfo, identityFile: string) => boolean;
}

export interface HostsMenuActions {
  connect: (alias: string) => void;
  test: (alias: string) => void;
  setKey: (alias: string, key: KeyInfo | null) => void;
  useAccount: (provider: ProviderOverview, account: string) => void;
  addServer: () => void;
}

function keyRadios(h: HostEntry, data: HostsMenuData, actions: HostsMenuActions): MenuItemSpec[] {
  const current = data.keys.find((k) => data.isKeyAt(k, h.identityFile));
  const missing = h.identityFile && !current ? h.identityFile.split(/[\\/]/).pop() : null;
  return [
    { label: 'SSH key', enabled: false },
    ...data.keys.slice(0, 25).map((k): MenuItemSpec => ({
      label: `${k.name}${k.encrypted ? '  🔒' : ''}`,
      type: 'radio',
      checked: k === current,
      click: () => actions.setKey(h.alias, k),
    })),
    ...(missing ? [{ label: `${missing} (not in ~/.ssh)`, type: 'radio', checked: true, enabled: false } as MenuItemSpec] : []),
    { label: 'SSH default keys', type: 'radio', checked: !h.identityFile, click: () => actions.setKey(h.alias, null) },
  ];
}

export function buildHostsMenu(data: HostsMenuData, actions: HostsMenuActions): MenuItemSpec[] {
  const { hosts, providers } = data;
  const servers = hosts.filter((h) => !h.managed && !h.isPattern && !h.gitProvider);
  const ownGitBlocks = hosts.filter((h) => !h.managed && !h.isPattern && h.gitProvider);
  const managedAliases = new Set(hosts.filter((h) => h.managed).flatMap((h) => h.aliases));

  const items: MenuItemSpec[] = [{ label: 'Servers', enabled: false }];
  if (servers.length) {
    items.push(
      ...servers.slice(0, 30).map((h): MenuItemSpec => ({
        label: h.hostName ? `${h.alias}  →  ${h.hostName}` : h.alias,
        submenu: [
          { label: `Connect to ${h.hostName || h.alias}`, click: () => actions.connect(h.alias) },
          { label: 'Test login', click: () => actions.test(h.alias) },
          { type: 'separator' },
          ...keyRadios(h, data, actions),
        ],
      })),
    );
  } else {
    items.push({ label: 'Add server…', click: actions.addServer });
  }

  // Provider order, then the order accounts were added: switching never reorders entries.
  const accountItems = providers.flatMap((p) =>
    p.accounts.map((a): MenuItemSpec => ({
      label: `${a.alias}${a.active ? '  ·  active' : ''}`,
      submenu: [
        { label: 'Test (ssh -T)', click: () => actions.test(a.alias) },
        a.active
          ? { label: `Active ${p.name} account`, enabled: false }
          : { label: `Use ${a.name}`, click: () => actions.useAccount(p, a.name) },
      ],
    })),
  );
  const ownItems = ownGitBlocks.map((h): MenuItemSpec => ({
    label: `${h.alias}${h.aliases.some((x) => managedAliases.has(x)) ? '  ·  overridden' : ''}`,
    submenu: [{ label: 'Test (ssh -T)', click: () => actions.test(h.alias) }, { type: 'separator' }, ...keyRadios(h, data, actions)],
  }));
  if (accountItems.length || ownItems.length) {
    items.push({ type: 'separator' }, { label: 'Git hosts', enabled: false }, ...accountItems, ...ownItems);
  }
  return items;
}
