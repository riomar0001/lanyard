import { describe, expect, it, vi } from 'vitest';
import { buildHostsMenu, type HostsMenuActions, type MenuItemSpec } from '../src/shared/tray-hosts-menu';
import type { AccountView, HostEntry, KeyInfo, ProviderOverview } from '../src/shared/types';

const host = (alias: string, extra: Partial<HostEntry> = {}): HostEntry => ({
  index: 0,
  managed: false,
  kind: 'Host',
  patterns: alias,
  alias,
  aliases: alias.split(' '),
  isPattern: false,
  hostName: '',
  user: '',
  port: '',
  identityFile: '',
  options: [],
  comment: '',
  gitProvider: null,
  ...extra,
});
const account = (provider: string, name: string, alias: string, active = false): AccountView => ({
  id: `${provider}:${name}`,
  provider,
  name,
  keyPath: `~/.ssh/${name}`,
  gitName: '',
  gitEmail: '',
  setGitIdentity: false,
  createdAt: '',
  alias,
  active,
  keyExists: true,
  keyEncrypted: false,
});
const provider = (id: string, name: string, accounts: AccountView[]): ProviderOverview => ({
  id,
  name,
  hosts: [`${id}.com`],
  user: 'git',
  color: '#000',
  keysUrl: '',
  accounts,
  active: accounts.find((a) => a.active)?.name ?? null,
  conflicts: [],
});
const key = (name: string): KeyInfo => ({
  name,
  path: `/k/${name}`,
  tildePath: `~/.ssh/${name}`,
  publicPath: null,
  hasPrivate: true,
  type: 'ED25519',
  algorithm: 'ssh-ed25519',
  fingerprint: '',
  comment: '',
  encrypted: false,
  modifiedAt: '',
});

const actions = (): HostsMenuActions => ({ connect: vi.fn(), test: vi.fn(), setKey: vi.fn(), useAccount: vi.fn(), addServer: vi.fn() });
const labels = (items: MenuItemSpec[]) => items.map((i) => (i.type === 'separator' ? '---' : i.label));
const sub = (item: MenuItemSpec) => item.submenu as MenuItemSpec[];

// The user's setup: GitHub Work (active) + Personal, Hugging Face Thesis, their own github.com and huggingface.co blocks.
const github = provider('github', 'GitHub', [
  account('github', 'Personal', 'github.com-Personal'),
  account('github', 'Work', 'github.com-Work', true),
]);
const hf = provider('huggingface', 'Hugging Face', [account('huggingface', 'Thesis', 'hf.co-Thesis', true)]);
const hosts = [
  host('github.com', { managed: true, gitProvider: 'github' }),
  host('github.com-Personal', { managed: true, gitProvider: 'github' }),
  host('github.com', { gitProvider: 'github', identityFile: '~/.ssh/riomar_id_ed25519' }),
  host('huggingface.co', { gitProvider: 'huggingface' }),
];
const keys = [key('riomar_id_ed25519'), key('924group_id_ed25519')];
const data = { hosts, keys, providers: [github, hf], isKeyAt: (k: KeyInfo, f: string) => f.endsWith(k.name) };

describe('tray Hosts submenu', () => {
  it('lists git hosts even when there are no servers', () => {
    const items = buildHostsMenu(data, actions());
    expect(labels(items)).toEqual([
      'Servers',
      'Add server…',
      '---',
      'Git hosts',
      'github.com-Personal',
      'github.com-Work  ·  active',
      'hf.co-Thesis  ·  active',
      'github.com  ·  overridden',
      'huggingface.co',
    ]);
  });

  it('keeps account order stable and offers Use only for inactive accounts', () => {
    const a = actions();
    const items = buildHostsMenu(data, a);
    const personal = sub(items[4]);
    expect(labels(personal)).toEqual(['Test (ssh -T)', 'Use Personal']);
    personal[1].click!({}, undefined, {});
    expect(a.useAccount).toHaveBeenCalledWith(github, 'Personal');
    expect(sub(items[5])[1]).toMatchObject({ label: 'Active GitHub account', enabled: false });
  });

  it('lets the user switch the key of their own git block', () => {
    const a = actions();
    const own = sub(buildHostsMenu(data, a)[7]);
    const riomar = own.find((i) => i.label === 'riomar_id_ed25519')!;
    expect(riomar.checked).toBe(true);
    own.find((i) => i.label === '924group_id_ed25519')!.click!({}, undefined, {});
    expect(a.setKey).toHaveBeenCalledWith('github.com', keys[1]);
  });

  it('shows servers with connect, test and key switching', () => {
    const a = actions();
    const items = buildHostsMenu({ ...data, hosts: [host('prod', { hostName: '203.0.113.10' })], providers: [] }, a);
    expect(labels(items)).toEqual(['Servers', 'prod  →  203.0.113.10']);
    const menu = sub(items[1]);
    menu[0].click!({}, undefined, {});
    expect(a.connect).toHaveBeenCalledWith('prod');
    expect(menu.find((i) => i.label === 'SSH default keys')?.checked).toBe(true);
  });
});
