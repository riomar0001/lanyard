import { Link } from 'react-router';
import { CopyButton } from '../components/controls';
import { DownloadCards } from '../components/DownloadCards';
import { useRelease } from '../lib/hooks';
import { withBase } from '../lib/site';

const STEPS = [
  {
    os: 'Windows 10 / 11',
    steps: [
      'Run Lanyard-Setup-<version>-x64.exe.',
      'If SmartScreen appears, choose More info → Run anyway.',
      'For the lanyard command, install the CLI with npm: npm install -g lanyard-cli',
    ],
  },
  {
    os: 'macOS',
    steps: [
      'Open the .dmg and drag Lanyard to Applications.',
      'The first time, right-click Lanyard in Applications and choose Open.',
      'For the lanyard command, install the CLI with npm: npm install -g lanyard-cli',
    ],
  },
  {
    os: 'Linux',
    steps: [
      'Make the AppImage executable: chmod +x Lanyard-*.AppImage',
      'Run it. Some distributions need FUSE 2 (libfuse2).',
      'For the lanyard command, install the CLI with npm: npm install -g lanyard-cli',
    ],
  },
];

export function DownloadPage() {
  const release = useRelease();
  return (
    <>
      <section className="hero" style={{ paddingBottom: 'clamp(56px,7vw,96px)' }}>
        <div
          className="deco deco-grid"
          aria-hidden="true"
          style={{
            inset: 0,
            backgroundPosition: 'center top',
            WebkitMaskImage: 'radial-gradient(ellipse 60% 55% at 50% 0%,#000 20%,transparent 75%)',
            maskImage: 'radial-gradient(ellipse 60% 55% at 50% 0%,#000 20%,transparent 75%)',
          }}
        />
        <div className="container" style={{ paddingTop: 'clamp(48px,6vw,80px)' }}>
          <div className="dl-head">
            <img src={withBase('/icon.png')} alt="" width={80} height={80} />
            <h1>Download Lanyard</h1>
            <p>
              <span className="mono" style={{ color: 'var(--text)' }}>
                v{release.version}
              </span>{' '}
              · Free for Windows, macOS and Linux · <a href={release.url}>Release notes</a>
            </p>
          </div>
          <DownloadCards />
        </div>
      </section>

      <section
        className="section is-surface"
        aria-labelledby="install-h"
        style={{ paddingTop: 'clamp(56px,7vw,96px)', paddingBottom: 'clamp(56px,7vw,96px)' }}
      >
        <div className="container">
          <h2 id="install-h" className="h2" style={{ fontSize: 'clamp(28px,3.2vw,40px)' }}>
            After downloading
          </h2>
          <div className="cards" style={{ marginTop: 32, gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,300px),1fr))' }}>
            {STEPS.map((s) => (
              <div className="card" key={s.os}>
                <h3 style={{ marginTop: 0 }}>{s.os}</h3>
                <ol className="steps">
                  {s.steps.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
          <div className="cards" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,300px),1fr))' }}>
            <div className="card">
              <h3 style={{ marginTop: 0 }}>Check the download</h3>
              <p>
                Every release lists the SHA-256 of each file in <code className="inline-code">SHA256SUMS.txt</code>. Compare it with:
              </p>
              <div className="install-box" style={{ marginTop: 12 }}>
                <code>sha256sum Lanyard-*</code>
                <CopyButton text="sha256sum Lanyard-*" label="Copy" />
              </div>
            </div>
            <div className="card">
              <h3 style={{ marginTop: 0 }}>Need help?</h3>
              <p>
                The <Link to="/docs/installation/">installation guide</Link> covers every platform, updating and uninstalling, and{' '}
                <Link to="/docs/troubleshooting/">troubleshooting</Link> covers the common first-run problems.
              </p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
