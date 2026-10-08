import { useState } from 'react';
import { Copy, RefreshCw, ShieldCheck, ShieldOff, ShieldPlus, Trash2 } from 'lucide-react';
import { api, ApiError, errorMessage } from '../../lib/api';
import { useResource } from '../../hooks/useResource';
import { useTask } from '../../hooks/useTask';
import { useConfirm } from '../../components/feedback/ConfirmProvider';
import { useToast } from '../../components/feedback/ToastProvider';
import { Button } from '../../components/ui/Button';
import { Select } from '../../components/ui/Field';
import { Badge, Callout, CodeBlock, EmptyState, PageHeader } from '../../components/ui/Feedback';

export function AgentPage() {
  const status = useResource(() => api.agent.status());
  const keys = useResource(() => api.keys.list(), ['keys']);
  const { run, isBusy } = useTask();
  const confirm = useConfirm();
  const toast = useToast();
  const [selected, setSelected] = useState('');

  const agent = status.data;
  const privateKeys = (keys.data ?? []).filter((k) => k.hasPrivate);
  const keyByFingerprint = new Map((keys.data ?? []).map((k) => [k.fingerprint, k]));

  const add = async () => {
    const key = privateKeys.find((k) => k.tildePath === selected);
    if (!key) return;
    try {
      await api.agent.add(key.tildePath);
      toast.success(`${key.name} added`);
      await status.reload();
    } catch (err) {
      if (err instanceof ApiError && err.code === 'NEEDS_PASSPHRASE') {
        await run('term', () => api.app.addKeyInTerminal(key.tildePath), 'Enter the passphrase in the terminal window, then refresh');
      } else {
        toast.error(errorMessage(err));
      }
    }
  };

  const clear = async () => {
    if (
      await confirm({
        title: 'Remove all identities?',
        message: 'Every key is unloaded from ssh-agent. Key files are not touched.',
        confirmLabel: 'Remove all',
        danger: true,
      })
    ) {
      await run('clear', () => api.agent.clear(), 'Agent cleared');
      await status.reload();
    }
  };

  return (
    <>
      <PageHeader
        title="ssh-agent"
        description="Keys loaded into the agent are used without asking for their passphrase again."
        actions={
          <>
            <Button icon={<RefreshCw size={15} />} loading={status.loading} onClick={() => void status.reload()}>
              Refresh
            </Button>
            {agent?.running && !!agent.identities.length && (
              <Button icon={<ShieldOff size={15} />} loading={isBusy('clear')} onClick={() => void clear()}>
                Remove all
              </Button>
            )}
          </>
        }
      />

      {status.error && <Callout tone="danger">{status.error}</Callout>}

      {agent && !agent.running && (
        <EmptyState
          icon={<ShieldOff size={30} />}
          title="ssh-agent is not reachable"
          action={
            agent.command && (
              <div className="command-block">
                <CodeBlock>{agent.command}</CodeBlock>
                <Button
                  size="sm"
                  variant="ghost"
                  iconOnly
                  title="Copy command"
                  icon={<Copy size={14} />}
                  loading={isBusy('copy')}
                  onClick={() => void run('copy', () => api.app.copy(agent.command!), 'Command copied')}
                />
              </div>
            )
          }
        >
          <span className="selectable">{agent.message}</span>
        </EmptyState>
      )}

      {agent?.running && (
        <div className="stack">
          <div className="card">
            <div className="card-body row">
              <ShieldCheck size={18} style={{ color: 'var(--success)' }} />
              <span>
                <b>Agent running</b>{' '}
                <span className="muted">
                  · {agent.identities.length} identit{agent.identities.length === 1 ? 'y' : 'ies'} loaded
                </span>
              </span>
              <span className="spacer" />
              <Select value={selected} onChange={(e) => setSelected(e.target.value)} style={{ width: 280 }}>
                <option value="">Choose a key to add…</option>
                {privateKeys.map((k) => (
                  <option key={k.tildePath} value={k.tildePath}>
                    {k.name}
                    {k.encrypted ? ' (passphrase)' : ''}
                  </option>
                ))}
              </Select>
              <Button
                variant="primary"
                icon={<ShieldPlus size={15} />}
                disabled={!selected}
                loading={isBusy('term')}
                onClick={() => void add()}
              >
                Add
              </Button>
            </div>
          </div>

          {agent.identities.length ? (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Identity</th>
                    <th>Type</th>
                    <th>Fingerprint</th>
                    <th className="actions" />
                  </tr>
                </thead>
                <tbody>
                  {agent.identities.map((id) => {
                    const file = keyByFingerprint.get(id.fingerprint);
                    return (
                      <tr key={id.fingerprint}>
                        <td>
                          <div style={{ fontWeight: 600 }}>{file?.name ?? id.comment}</div>
                          {file && <div className="faint">{id.comment}</div>}
                        </td>
                        <td>
                          <Badge>
                            {id.type} {id.bits}
                          </Badge>
                        </td>
                        <td className="mono faint selectable">{id.fingerprint}</td>
                        <td className="actions">
                          <Button
                            size="sm"
                            variant="ghost"
                            iconOnly
                            danger
                            title={file ? 'Remove from agent' : 'Key file not found in ~/.ssh'}
                            disabled={!file}
                            icon={<Trash2 size={14} />}
                            onClick={() =>
                              file &&
                              void run(`rm:${id.fingerprint}`, () => api.agent.remove(file.tildePath), `${file.name} removed`).then(() =>
                                status.reload(),
                              )
                            }
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState icon={<ShieldCheck size={30} />} title="No identities loaded">
              Add a key above to use it without retyping its passphrase.
            </EmptyState>
          )}
        </div>
      )}
    </>
  );
}
