import type { AssetKey } from '../lib/assets';
import { useOs, useRelease } from '../lib/hooks';
import { CopyButton } from './controls';
import { Icon } from './icons';
import { GITHUB } from '../lib/site';

/** Platform cards with direct links to the newest release's files. */
export function DownloadCards() {
  const release = useRelease();
  const os = useOs();
  const href = (key: AssetKey) => release.assets[key] ?? release.url;
  const card = (key: 'windows' | 'mac' | 'linux') => `dl-card${os === key ? ' is-yours' : ''}`;

  return (
    <>
      <div className="dl-grid">
        <article className={card('windows')}>
          <div className="dl-card-title">
            <h3>Windows</h3>
            <span className="yours">Your system</span>
          </div>
          <p>
            Installer, 64-bit · <span className="mono">.exe</span>
          </p>
          <div className="dl-actions">
            <a className="dl-btn is-main" href={href('windows')}>
              Download .exe
            </a>
          </div>
        </article>
        <article className={card('mac')}>
          <div className="dl-card-title">
            <h3>macOS</h3>
            <span className="yours">Your system</span>
          </div>
          <p>
            Disk image · <span className="mono">.dmg</span>
          </p>
          <div className="dl-actions two">
            <a className="dl-btn is-main" href={href('macArm')}>
              Apple Silicon
            </a>
            <a className="dl-btn" href={href('macIntel')}>
              Intel
            </a>
          </div>
        </article>
        <article className={card('linux')}>
          <div className="dl-card-title">
            <h3>Linux</h3>
            <span className="yours">Your system</span>
          </div>
          <p>
            Portable · <span className="mono">.AppImage</span>
          </p>
          <div className="dl-actions">
            <a className="dl-btn is-main" href={href('linux')}>
              Download .AppImage
            </a>
          </div>
        </article>
        <article className="dl-card">
          <div className="dl-card-title">
            <h3>CLI only</h3>
          </div>
          <p>Any platform with Node.js 20+</p>
          <div className="npm-box">
            <code>npm i -g lanyard-cli</code>
            <CopyButton text="npm install -g lanyard-cli" label="Copy" icon={false} aria="Copy npm install command" />
          </div>
        </article>
      </div>
      <div role="note" className="note">
        <Icon name="info" />
        <div>
          <p>Builds are not code-signed yet, so your OS will warn on first launch.</p>
          <p>
            <strong>Windows:</strong> in the SmartScreen dialog, choose More info → Run anyway.
          </p>
          <p>
            <strong>macOS:</strong> right-click Lanyard in Applications and choose Open.
          </p>
          <p>
            Every file has a signed build attestation and a published checksum. See the{' '}
            <a href={`${GITHUB}/blob/main/SECURITY.md#code-signing-policy`}>code signing policy</a> to verify a download.
          </p>
        </div>
      </div>
    </>
  );
}
