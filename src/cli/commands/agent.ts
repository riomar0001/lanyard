/** ssh-agent: list, add, rm, clear. */

import * as out from '../utils/output';
import { interactive } from '../utils/system';
import type { CommandModule } from '../types';

const { c } = out;

export const register: CommandModule = (program, core) => {
  const agent = program.command('agent').description('manage identities loaded in ssh-agent');

  agent
    .command('list', { isDefault: true })
    .description('list loaded identities')
    .action(
      out.action(async () => {
        const s = await core.agent.status();
        out.emit(s, () => {
          if (!s.running) return out.warn(s.command ? `${s.message} ${s.command}` : s.message);
          out.table(s.identities, [
            { key: 'type', label: 'Type' },
            { key: 'fingerprint', label: 'Fingerprint', format: (v) => c.dim(v) },
            { key: 'comment', label: 'Comment' },
          ]);
        });
      }),
    );

  agent
    .command('add <key>')
    .description('load a key (prompts for its passphrase if it has one)')
    .action(
      out.action((key: string) => {
        const { cmd, args } = core.agent.interactiveAddCommand(key);
        process.exitCode = interactive(cmd, args);
      }),
    );

  agent
    .command('rm <key>')
    .description('unload a key')
    .action(
      out.action(async (key: string) => {
        const r = await core.agent.remove(key);
        out.ok(`Removed ${r.removed} from the agent`);
      }),
    );

  agent
    .command('clear')
    .description('unload all keys')
    .action(
      out.action(async () => {
        await core.agent.clear();
        out.ok('All identities removed from the agent');
      }),
    );
};
