import { OrbitWorld } from '@/components/orbit-world';
import { OrbitAdapt } from '@/components/orbit-adapt';
import { ARROW_DESTINATIONS } from '@/lib/arrow-map';
import { StartupSequence } from '@/components/startup-sequence';
import { ArrowAuthGate } from '@/components/arrow-auth-gate';

export default function Home() {
  const destinationCount = ARROW_DESTINATIONS.length;
  const liveRouteCount = ARROW_DESTINATIONS.filter(destination => destination.href).length;

  return (
    <ArrowAuthGate>
      <StartupSequence />
      <OrbitAdapt destinationCount={destinationCount} liveRouteCount={liveRouteCount}>
        <OrbitWorld />
      </OrbitAdapt>
    </ArrowAuthGate>
  );
}
