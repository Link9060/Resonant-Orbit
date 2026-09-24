import { OrbitWorld } from '@/components/orbit-world';
import { ArrowMarkIcon } from '@/components/orbit-icons';
import { ARROW_DESTINATIONS } from '@/lib/arrow-map';
import { StartupSequence } from '@/components/startup-sequence';
import { ArrowSystemIsland } from '@/components/arrow-system-island';

export default function Home() {
  const destinationCount = ARROW_DESTINATIONS.length;
  const liveRouteCount = ARROW_DESTINATIONS.filter(destination => destination.href).length;

  return (
    <>
      <StartupSequence />
      <main className="orbit-app">
        <header className="orbit-header">
          <div className="suite-lockup" aria-label="ARROW Orbit">
            <span className="arrow-mark" aria-hidden="true">
              <ArrowMarkIcon size={18} />
            </span>
            <span className="suite-name">ARROW</span>
            <span className="suite-divider" />
            <span className="product-name">Orbit</span>
          </div>

          <div className="orbit-header-right">
            <div className="header-meta" aria-label="Orbit route summary">
              <span>{destinationCount} nodes</span>
              <span>{liveRouteCount} connected</span>
            </div>
            <ArrowSystemIsland />
          </div>
        </header>

        <section className="orbit-stage" aria-label="Orbit dashboard">
          <OrbitWorld />
        </section>
      </main>
    </>
  );
}
