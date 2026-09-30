'use client';

import type { ArrowDestinationId } from '@/lib/arrow-map';
import {
  ArrowLeftIcon,
  ArrowUpRightIcon,
  CommandIcon,
  CompassIcon,
  CoreIcon,
  PulseIcon,
  RadioTowerIcon,
  SearchIcon,
  TargetIcon,
  WaypointIcon,
} from '@/components/orbit-icons';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from 'react';

type CommandView = 'home' | 'profile' | 'system' | 'connections' | 'settings';
type Presence = 'available' | 'focus' | 'school' | 'away';

type ShellApi = {
  openPanel?: (name: string, module?: string, anchor?: HTMLElement | null) => void;
};

type OrbitCommandPanelProps = {
  statuses: Record<ArrowDestinationId, string>;
  relayOnlyAccess: boolean;
  onOpenNavigator: (query?: string) => void;
  onFocusDestination: (id: ArrowDestinationId) => void;
  onOpenModule: (id: ArrowDestinationId, params?: Record<string, string>) => void;
  onQuickCapture: (text?: string) => void;
  onReplayIntro: () => void;
};

const PROFILE_STORAGE_KEY = 'orbit-command-profile-v1';
const VIEW_EVENT = 'orbit:command-view';

const moduleRows: Array<{
  id: ArrowDestinationId;
  name: string;
  code: string;
}> = [
  { id: 'atlas', name: 'Atlas', code: 'DATA' },
  { id: 'ravin', name: 'RAVIN', code: 'INTELLIGENCE' },
  { id: 'relay', name: 'Relay', code: 'COMMUNICATION' },
  { id: 'waypoint', name: 'Waypoint', code: 'DIRECTION' },
];

function ModuleIcon({ id }: { id: ArrowDestinationId }) {
  if (id === 'atlas') return <CompassIcon size={15} />;
  if (id === 'ravin') return <CoreIcon size={15} />;
  if (id === 'relay') return <RadioTowerIcon size={15} />;
  return <WaypointIcon size={15} />;
}

function shellApi() {
  return (window as Window & { ArrowOS?: ShellApi }).ArrowOS;
}

function prettyPresence(value: Presence) {
  if (value === 'focus') return 'Focus';
  if (value === 'school') return 'School';
  if (value === 'away') return 'Away';
  return 'Available';
}

export function OrbitCommandPanel({
  statuses,
  relayOnlyAccess,
  onOpenNavigator,
  onFocusDestination,
  onOpenModule,
  onQuickCapture,
  onReplayIntro,
}: OrbitCommandPanelProps) {
  const [view, setView] = useState<CommandView>('home');
  const [command, setCommand] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [presence, setPresence] = useState<Presence>('available');
  const [profileReady, setProfileReady] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const noticeTimerRef = useRef<number | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(PROFILE_STORAGE_KEY);
      if (raw) {
        const profile = JSON.parse(raw) as {
          displayName?: string;
          presence?: Presence;
        };
        if (typeof profile.displayName === 'string') setDisplayName(profile.displayName);
        if (['available', 'focus', 'school', 'away'].includes(profile.presence ?? '')) {
          setPresence(profile.presence as Presence);
        }
      }
    } catch {}
    setProfileReady(true);
  }, []);

  useEffect(() => {
    if (!profileReady) return;
    try {
      localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify({ displayName, presence }));
      window.dispatchEvent(new CustomEvent('arrow:profilechange', {
        detail: { displayName, presence },
      }));
    } catch {}
  }, [displayName, presence, profileReady]);

  useEffect(() => {
    const handleView = (event: Event) => {
      const next = (event as CustomEvent<{ view?: CommandView }>).detail?.view;
      if (next && ['home', 'profile', 'system', 'connections', 'settings'].includes(next)) {
        setView(next);
      }
    };
    window.addEventListener(VIEW_EVENT, handleView as EventListener);
    return () => window.removeEventListener(VIEW_EVENT, handleView as EventListener);
  }, []);

  useEffect(() => () => {
    if (noticeTimerRef.current) window.clearTimeout(noticeTimerRef.current);
  }, []);

  const notify = (message: string) => {
    setNotice(message);
    if (noticeTimerRef.current) window.clearTimeout(noticeTimerRef.current);
    noticeTimerRef.current = window.setTimeout(() => setNotice(null), 2400);
  };

  const openSystemPanel = (name: string) => {
    const api = shellApi();
    if (!api?.openPanel) {
      notify('ARROW system controls are still loading.');
      return;
    }
    api.openPanel(name, 'orbit');
  };

  const allowedModules = useMemo(
    () => moduleRows.filter(row => !relayOnlyAccess || row.id === 'relay'),
    [relayOnlyAccess],
  );

  const statusSummary = useMemo(() => {
    const active = allowedModules.length;
    const details = allowedModules
      .map(row => statuses[row.id])
      .filter(Boolean);
    return {
      active,
      details,
    };
  }, [allowedModules, statuses]);

  const openCommandView = (next: CommandView) => {
    setView(next);
    setCommand('');
  };

  const submitCommand = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const raw = command.trim();
    if (!raw) {
      onOpenNavigator();
      return;
    }

    const lower = raw.toLowerCase();

    if (/\b(profile|account|me)\b/.test(lower)) {
      openCommandView('profile');
      return;
    }
    if (/\b(connection|connections|integrations|sync)\b/.test(lower)) {
      openCommandView('connections');
      return;
    }
    if (/\b(system|status|modules|centers)\b/.test(lower)) {
      openCommandView('system');
      return;
    }
    if (/\b(settings|preferences|privacy)\b/.test(lower)) {
      openCommandView('settings');
      return;
    }
    if (/\b(appearance|theme|motion)\b/.test(lower)) {
      openSystemPanel('appearance');
      setCommand('');
      return;
    }
    if (/\b(focus timer|focus session|start focus)\b/.test(lower)) {
      openSystemPanel('focus');
      setCommand('');
      return;
    }

    const captureMatch = raw.match(/^(?:capture|dump|remember|add task|task)\s*[:\-]?\s*(.*)$/i);
    if (captureMatch) {
      onQuickCapture(captureMatch[1]?.trim() || undefined);
      setCommand('');
      return;
    }

    const ravinMatch = raw.match(/^(?:ask\s+ravin|ravin|ask)\s*[:\-]?\s*(.*)$/i);
    if (ravinMatch && !relayOnlyAccess) {
      const prompt = ravinMatch[1]?.trim();
      onOpenModule('ravin', prompt ? { prompt } : undefined);
      return;
    }

    const atlasMatch = raw.match(/^(?:search\s+atlas|atlas|find)\s*[:\-]?\s*(.*)$/i);
    if (atlasMatch && !relayOnlyAccess) {
      const query = atlasMatch[1]?.trim();
      onOpenModule('atlas', query ? { q: query } : undefined);
      return;
    }

    for (const row of allowedModules) {
      if (lower === row.name.toLowerCase() || lower.includes(`open ${row.name.toLowerCase()}`) || lower.includes(`go to ${row.name.toLowerCase()}`)) {
        onOpenModule(row.id);
        return;
      }
      if (lower.includes(`focus ${row.name.toLowerCase()}`) || lower.includes(`show ${row.name.toLowerCase()}`)) {
        onFocusDestination(row.id);
        setCommand('');
        return;
      }
    }

    if (!relayOnlyAccess) {
      onOpenModule('ravin', { prompt: raw });
      return;
    }

    onOpenNavigator(raw);
    setCommand('');
  };

  const recentRows = allowedModules.slice(0, 3);

  return (
    <aside className="orbit-command-panel" aria-label="ARROW command panel">
      <div className="command-panel-head">
        <div>
          <p>{view === 'home' ? 'COMMAND' : 'ORBIT CONTROL'}</p>
          <h2>
            {view === 'home' && (displayName.trim() || 'You')}
            {view === 'profile' && 'Your profile'}
            {view === 'system' && 'System'}
            {view === 'connections' && 'Connections'}
            {view === 'settings' && 'Settings'}
          </h2>
        </div>
        {view === 'home' ? (
          <span className="command-online"><i /> system online</span>
        ) : (
          <button
            type="button"
            className="command-back"
            onClick={() => setView('home')}
            aria-label="Back to command home"
          >
            <ArrowLeftIcon size={14} />
            <span>back</span>
          </button>
        )}
      </div>

      {view === 'home' && (
        <>
          <button
            type="button"
            className="command-account-strip"
            onClick={() => setView('profile')}
          >
            <span className="command-avatar" aria-hidden="true">
              {(displayName.trim()[0] || 'A').toUpperCase()}
            </span>
            <span>
              <strong>{displayName.trim() || 'ARROW Account'}</strong>
              <small>{prettyPresence(presence)} · {relayOnlyAccess ? 'Relay public access' : 'signed in'}</small>
            </span>
            <ArrowUpRightIcon size={13} />
          </button>

          <form className="command-entry" onSubmit={submitCommand}>
            <CommandIcon size={15} />
            <input
              value={command}
              onChange={event => setCommand(event.target.value)}
              placeholder="Ask RAVIN or run a command..."
              aria-label="ARROW command"
            />
            <button type="submit" aria-label="Run ARROW command">
              <ArrowUpRightIcon size={13} />
            </button>
          </form>

          <div className="command-section">
            <div className="command-section-title">
              <span>QUICK ACTIONS</span>
              <button type="button" onClick={() => onOpenNavigator()}>all commands</button>
            </div>
            <div className="command-quick-grid">
              <button type="button" onClick={() => onQuickCapture()} disabled={relayOnlyAccess}>
                <PulseIcon size={14} />
                <span>Capture</span>
              </button>
              <button type="button" onClick={() => onOpenNavigator()}>
                <SearchIcon size={14} />
                <span>Navigate</span>
              </button>
              <button type="button" onClick={() => setView('connections')}>
                <span className="command-link-glyph" aria-hidden="true">⌁</span>
                <span>Connect</span>
              </button>
              <button type="button" onClick={() => openSystemPanel('focus')}>
                <TargetIcon size={14} />
                <span>Focus</span>
              </button>
            </div>
          </div>

          <div className="command-section">
            <div className="command-section-title">
              <span>SYSTEM</span>
              <button type="button" onClick={() => setView('system')}>
                {statusSummary.active} centers
              </button>
            </div>
            <div className="command-module-list">
              {allowedModules.map(row => (
                <button
                  type="button"
                  className="command-module-row"
                  key={row.id}
                  onClick={() => onFocusDestination(row.id)}
                >
                  <span className="command-module-icon"><ModuleIcon id={row.id} /></span>
                  <span className="command-module-copy">
                    <strong>{row.name}</strong>
                    <small>{statuses[row.id]}</small>
                  </span>
                  <span className="command-status-dot" />
                </button>
              ))}
            </div>
          </div>

          <div className="command-section command-recent">
            <div className="command-section-title">
              <span>RECENT SIGNALS</span>
            </div>
            {recentRows.map(row => (
              <button type="button" key={row.id} onClick={() => onFocusDestination(row.id)}>
                <span>{row.name}</span>
                <small>{statuses[row.id]}</small>
              </button>
            ))}
          </div>

          <button type="button" className="command-settings-link" onClick={() => setView('settings')}>
            <span>System settings</span>
            <ArrowUpRightIcon size={13} />
          </button>
        </>
      )}

      {view === 'profile' && (
        <div className="command-subview">
          <label className="command-field">
            <span>DISPLAY NAME</span>
            <input
              value={displayName}
              onChange={event => setDisplayName(event.target.value.slice(0, 40))}
              placeholder="What should ARROW call you?"
            />
          </label>

          <div className="command-field">
            <span>PRESENCE</span>
            <div className="command-presence-grid">
              {(['available', 'focus', 'school', 'away'] as Presence[]).map(option => (
                <button
                  key={option}
                  type="button"
                  className={presence === option ? 'is-active' : ''}
                  onClick={() => setPresence(option)}
                >
                  <i />
                  {prettyPresence(option)}
                </button>
              ))}
            </div>
          </div>

          <div className="command-info-card">
            <span>ARROW ACCOUNT</span>
            <strong>{relayOnlyAccess ? 'Public Relay access' : 'Universal sign-in active'}</strong>
            <small>
              Orbit profile and presence are stored on this device right now. Account cloud sync can replace this local layer when it is connected.
            </small>
          </div>
        </div>
      )}

      {view === 'system' && (
        <div className="command-subview">
          <div className="command-info-card">
            <span>ARROW STATUS</span>
            <strong>{statusSummary.active} centers available</strong>
            <small>Orbit is the control layer. Each center keeps its own job while reporting status here.</small>
          </div>
          <div className="command-system-cards">
            {moduleRows.map(row => {
              const restricted = relayOnlyAccess && row.id !== 'relay';
              return (
                <div className={`command-system-card ${restricted ? 'is-restricted' : ''}`} key={row.id}>
                  <span className="command-module-icon"><ModuleIcon id={row.id} /></span>
                  <div>
                    <span>{row.code}</span>
                    <strong>{row.name}</strong>
                    <small>{restricted ? 'Unavailable in public Relay access' : statuses[row.id]}</small>
                  </div>
                  <button
                    type="button"
                    disabled={restricted}
                    onClick={() => onOpenModule(row.id)}
                  >
                    open
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {view === 'connections' && (
        <div className="command-subview">
          <div className="command-connection-row">
            <span className="command-connection-icon">A</span>
            <span><strong>ARROW Account</strong><small>{relayOnlyAccess ? 'public Relay session' : 'universal session active'}</small></span>
            <i className="is-live" />
          </div>
          <button type="button" className="command-connection-row" onClick={() => openSystemPanel('calendar')}>
            <span className="command-connection-icon">07</span>
            <span><strong>Calendar</strong><small>ARROW calendar and Waypoint</small></span>
            <ArrowUpRightIcon size={12} />
          </button>
          <button type="button" className="command-connection-row" onClick={() => onOpenModule('atlas')} disabled={relayOnlyAccess}>
            <span className="command-connection-icon"><CompassIcon size={14} /></span>
            <span><strong>Files + projects</strong><small>managed through Atlas</small></span>
            <ArrowUpRightIcon size={12} />
          </button>
          <button type="button" className="command-connection-row" onClick={() => onOpenModule('relay')}>
            <span className="command-connection-icon"><RadioTowerIcon size={14} /></span>
            <span><strong>People + messaging</strong><small>managed through Relay</small></span>
            <ArrowUpRightIcon size={12} />
          </button>
          <div className="command-info-card">
            <span>CONNECTION MODEL</span>
            <strong>One system, specialized centers</strong>
            <small>Connections live where they make sense, while Orbit stays the single place to see and control them.</small>
          </div>
        </div>
      )}

      {view === 'settings' && (
        <div className="command-subview">
          <button type="button" className="command-settings-row" onClick={() => openSystemPanel('appearance')}>
            <span><strong>Appearance</strong><small>theme, motion, accent, experience</small></span>
            <ArrowUpRightIcon size={13} />
          </button>
          <button type="button" className="command-settings-row" onClick={() => openSystemPanel('focus')}>
            <span><strong>Focus</strong><small>timer and attention state</small></span>
            <ArrowUpRightIcon size={13} />
          </button>
          <button type="button" className="command-settings-row" onClick={() => openSystemPanel('settings')}>
            <span><strong>Data + privacy</strong><small>export, import, reset, sign out</small></span>
            <ArrowUpRightIcon size={13} />
          </button>
          <button type="button" className="command-settings-row" onClick={onReplayIntro}>
            <span><strong>Replay Orbit introduction</strong><small>show “Everything starts here” again</small></span>
            <ArrowUpRightIcon size={13} />
          </button>
        </div>
      )}

      {notice && <div className="command-notice" role="status">{notice}</div>}
    </aside>
  );
}

export function IntroParticleCollapse({
  active,
  onComplete,
}: {
  active: boolean;
  onComplete: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const completeRef = useRef(onComplete);

  useEffect(() => {
    completeRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    if (!active) return;

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      const timer = window.setTimeout(() => completeRef.current(), 40);
      return () => window.clearTimeout(timer);
    }

    const canvas = canvasRef.current;
    const shell = document.querySelector<HTMLElement>('.world-shell');
    const source = document.querySelector<HTMLElement>('.orbit-intro-card');
    const context = canvas?.getContext('2d');
    if (!canvas || !shell || !source || !context) {
      const timer = window.setTimeout(() => completeRef.current(), 100);
      return () => window.clearTimeout(timer);
    }

    const shellRect = shell.getBoundingClientRect();
    const sourceRect = source.getBoundingClientRect();
    const width = shellRect.width;
    const height = shellRect.height;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.6);

    canvas.width = Math.max(1, Math.floor(width * dpr));
    canvas.height = Math.max(1, Math.floor(height * dpr));
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    context.setTransform(dpr, 0, 0, dpr, 0, 0);

    const sourceLeft = sourceRect.left - shellRect.left;
    const sourceTop = sourceRect.top - shellRect.top;
    const targetX = width / 2;
    const targetY = height / 2;
    const count = Math.max(86, Math.min(160, Math.round((sourceRect.width * sourceRect.height) / 850)));
    const particles = Array.from({ length: count }, (_, index) => {
      const lane = index / Math.max(1, count - 1);
      const x = sourceLeft + (0.06 + Math.random() * 0.88) * sourceRect.width;
      const y = sourceTop + (0.04 + Math.random() * 0.92) * sourceRect.height;
      const angle = Math.atan2(targetY - y, targetX - x);
      return {
        x,
        y,
        delay: (index % 17) * 7 + Math.random() * 55,
        size: 0.8 + Math.random() * 2.2,
        alpha: 0.38 + Math.random() * 0.62,
        bend: (Math.random() - 0.5) * (44 + lane * 44),
        angle,
      };
    });

    let frame = 0;
    const duration = 920;
    const startedAt = performance.now();
    const easeIn = (value: number) => value * value * value;

    const draw = (now: number) => {
      const elapsed = now - startedAt;
      context.clearRect(0, 0, width, height);
      context.globalCompositeOperation = 'lighter';

      for (const particle of particles) {
        const local = Math.max(0, Math.min(1, (elapsed - particle.delay) / (duration - particle.delay)));
        if (local <= 0) continue;

        const t = easeIn(local);
        const normalX = -Math.sin(particle.angle);
        const normalY = Math.cos(particle.angle);
        const bend = Math.sin(Math.PI * local) * particle.bend;
        const x = particle.x + (targetX - particle.x) * t + normalX * bend;
        const y = particle.y + (targetY - particle.y) * t + normalY * bend;
        const tailT = Math.max(0, t - 0.035);
        const tailX = particle.x + (targetX - particle.x) * tailT + normalX * bend * 0.88;
        const tailY = particle.y + (targetY - particle.y) * tailT + normalY * bend * 0.88;
        const fade = 1 - Math.max(0, (local - 0.82) / 0.18);

        context.strokeStyle = `rgba(255,255,255,${particle.alpha * fade * 0.72})`;
        context.lineWidth = Math.max(0.55, particle.size * 0.48);
        context.beginPath();
        context.moveTo(tailX, tailY);
        context.lineTo(x, y);
        context.stroke();

        context.fillStyle = `rgba(255,255,255,${particle.alpha * fade})`;
        context.beginPath();
        context.arc(x, y, particle.size, 0, Math.PI * 2);
        context.fill();
      }

      context.globalCompositeOperation = 'source-over';

      if (elapsed < duration + 40) {
        frame = window.requestAnimationFrame(draw);
      } else {
        context.clearRect(0, 0, width, height);
        completeRef.current();
      }
    };

    frame = window.requestAnimationFrame(draw);
    return () => window.cancelAnimationFrame(frame);
  }, [active]);

  return (
    <canvas
      ref={canvasRef}
      className={`orbit-intro-particles ${active ? 'is-active' : ''}`}
      aria-hidden="true"
    />
  );
}
