import { OrbitWorld } from '@/components/orbit-world';
import { StartupSequence } from '@/components/startup-sequence';

export default function Home() {
  return (
    <>
      <StartupSequence />
      <main className="orbit-app">
        <header className="orbit-header">
          <div className="suite-lockup" aria-label="ARROW Orbit">
            <span className="arrow-mark" aria-hidden="true">
              <span />
            </span>
            <span className="suite-name">ARROW</span>
            <span className="suite-divider" />
            <span className="product-name">Orbit</span>
          </div>

          <div className="header-meta">
            <span className="system-status"><span className="status-dot" /> system map</span>
            <button className="profile-orb" type="button" aria-label="Account">
              <span className="profile-dot" aria-hidden="true" />
            </button>
          </div>
        </header>

        <section className="orbit-stage" aria-label="Orbit dashboard">
          <div className="orbit-readout" aria-label="ARROW world status">
            <span><strong>04</strong> destinations</span>
            <span><strong>01</strong> live route</span>
            <span><i /> world online</span>
          </div>

          <div className="stage-copy">
            <p className="eyebrow">CENTRAL WORLD</p>
            <h1>Everything starts here.</h1>
            <p className="stage-description">
              Move through ARROW as one connected system. The sphere is the map; each signal is a destination.
            </p>
          </div>

          <OrbitWorld />

          <div className="stage-footer">
            <p><span className="footer-key">drag</span> to rotate the world</p>
            <p><span className="footer-key">⌘K</span> to navigate</p>
          </div>
        </section>
      </main>
    </>
  );
}
