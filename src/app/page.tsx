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
            <button className="profile-orb" type="button" aria-label="Profile">L</button>
          </div>
        </header>

        <section className="orbit-stage" aria-label="Orbit dashboard">
          <div className="stage-copy">
            <p className="eyebrow">CENTRAL WORLD</p>
            <h1>Everything starts here.</h1>
            <p className="stage-description">
              Move through ARROW as one connected system. The sphere is the map; each signal is a destination.
            </p>
          </div>

          <OrbitWorld />

          <div className="stage-footer">
            <p><span className="footer-key">move</span> to disturb the field</p>
            <p><span className="footer-key">select</span> a destination to focus it</p>
          </div>
        </section>
      </main>
    </>
  );
}
