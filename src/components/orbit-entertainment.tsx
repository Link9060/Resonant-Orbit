'use client';

import type { ArrowDestinationId } from '@/lib/arrow-map';
import {
  ArrowMarkIcon,
  CoreIcon,
  PulseIcon,
  TargetIcon,
} from '@/components/orbit-icons';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react';

export type EntertainmentGameId = 'flight' | 'orbit' | 'cipher' | 'surge';

export type EntertainmentGame = {
  id: EntertainmentGameId;
  slot: ArrowDestinationId;
  shortcut: 1 | 2 | 3 | 4;
  name: string;
  code: string;
  tagline: string;
  status: string;
};

export const ENTERTAINMENT_GAMES: readonly EntertainmentGame[] = [
  {
    id: 'flight',
    slot: 'atlas',
    shortcut: 1,
    name: 'Flight',
    code: 'ARCADE',
    tagline: 'Thread the ARROW craft through shifting gates.',
    status: 'alignment run',
  },
  {
    id: 'orbit',
    slot: 'ravin',
    shortcut: 2,
    name: 'Orbit',
    code: 'GRAVITY',
    tagline: 'Pulse your orbit and stay inside the safe band.',
    status: 'stability run',
  },
  {
    id: 'cipher',
    slot: 'relay',
    shortcut: 3,
    name: 'Cipher',
    code: 'PUZZLE',
    tagline: 'Read the signal, remember it, and rebuild the sequence.',
    status: 'memory signal',
  },
  {
    id: 'surge',
    slot: 'waypoint',
    shortcut: 4,
    name: 'Surge',
    code: 'REACTION',
    tagline: 'Wait for the pulse. Hit it before the signal fades.',
    status: 'reaction test',
  },
];

export const ENTERTAINMENT_GAME_BY_SLOT = Object.fromEntries(
  ENTERTAINMENT_GAMES.map(game => [game.slot, game]),
) as Record<ArrowDestinationId, EntertainmentGame>;

export function EntertainmentGameIcon({
  id,
  size = 18,
}: {
  id: EntertainmentGameId;
  size?: number;
}) {
  if (id === 'flight') return <ArrowMarkIcon size={size} />;
  if (id === 'orbit') return <CoreIcon size={size} />;
  if (id === 'cipher') return <TargetIcon size={size} />;
  return <PulseIcon size={size} />;
}

function FlightGame({paused}: {paused:boolean}) {
  const [playerY, setPlayerY] = useState(50);
  const [gateY, setGateY] = useState(46);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [round, setRound] = useState(1);
  const [result, setResult] = useState('ALIGN WITH THE GAP');
  const playerYRef = useRef(playerY);
  const gateYRef = useRef(gateY);
  const roundRef = useRef(round);

  useEffect(() => {
    playerYRef.current = playerY;
  }, [playerY]);

  useEffect(() => {
    if (paused) return;
    let feedbackTimer: number | undefined;
    const timer = window.setInterval(() => {
      const hit = Math.abs(playerYRef.current - gateYRef.current) <= 13;
      setScore(value => value + (hit ? 100 : 0));
      setStreak(value => hit ? value + 1 : 0);
      setResult(hit ? 'GATE CLEARED' : 'MISSED');

      roundRef.current += 1;
      setRound(roundRef.current);
      const next = 20 + ((roundRef.current * 37) % 61);
      gateYRef.current = next;
      setGateY(next);

      feedbackTimer = window.setTimeout(() => setResult('ALIGN WITH THE GAP'), 520);
    }, 1450);

    return () => { window.clearInterval(timer); window.clearTimeout(feedbackTimer); };
  }, [paused]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (paused || event.target instanceof HTMLElement && event.target.closest('button,input,textarea,select')) return;
      const key = event.key.toLowerCase();
      if (key === 'arrowup' || key === 'w') {
        event.preventDefault();
        setPlayerY(value => Math.max(10, value - 6));
      }
      if (key === 'arrowdown' || key === 's') {
        event.preventDefault();
        setPlayerY(value => Math.min(90, value + 6));
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [paused]);

  const moveCraft = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (paused) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const y = ((event.clientY - rect.top) / Math.max(1, rect.height)) * 100;
    setPlayerY(Math.max(10, Math.min(90, y)));
  };

  return (
    <div className="ent-game-body flight-game">
      <div className="ent-game-hud">
        <span>SCORE <b>{score}</b></span>
        <span>STREAK <b>{streak}</b></span>
        <span>GATE <b>{round}</b></span>
      </div>
      <div className="flight-field" onPointerMove={moveCraft} onPointerDown={moveCraft}>
        <div className="flight-grid" />
        <div className="flight-craft" style={{ top: String(playerY) + '%' }}>
          <ArrowMarkIcon size={28} />
          <span className="flight-trail" />
        </div>
        <div className="flight-gate" style={{ top: String(gateY) + '%' }}>
          <span className="gate-upper" />
          <span className="gate-lower" />
          <span className="gate-target" />
        </div>
        <span className="flight-result">{result}</span>
      </div>
      <label className="flight-steering">Craft altitude<input aria-label="Craft altitude" type="range" min={10} max={90} value={100-playerY} disabled={paused} onChange={event=>setPlayerY(100-Number(event.target.value))}/></label>
      <p className="ent-game-help">Move your pointer, or use ↑ ↓ / W S, to line the craft up with each incoming gate.</p>
    </div>
  );
}

function OrbitGame({paused}: {paused:boolean}) {
  const [radius, setRadius] = useState(49);
  const [angle, setAngle] = useState(0);
  const [score, setScore] = useState(0);
  const [alive, setAlive] = useState(true);

  useEffect(() => {
    if (!alive || paused) return;
    const timer = window.setInterval(() => {
      setAngle(value => value + 0.16);
      setScore(value => value + 1);
      setRadius(value => {
        const next = value - 0.92;
        if (next < 22 || next > 78) {
          setAlive(false);
          return value;
        }
        return next;
      });
    }, 90);

    return () => window.clearInterval(timer);
  }, [alive, paused]);

  const boost = () => {
    if (!alive || paused) return;
    setRadius(value => Math.min(82, value + 7.5));
  };

  const reset = () => {
    setRadius(49);
    setAngle(0);
    setScore(0);
    setAlive(true);
  };

  const dotStyle = {
    '--orbit-game-radius': String(radius * 2.35) + 'px',
    '--orbit-game-angle': String(angle) + 'rad',
  } as CSSProperties;

  return (
    <div className="ent-game-body orbit-game">
      <div className="ent-game-hud">
        <span>STABILITY <b>{Math.round(radius)}</b></span>
        <span>SCORE <b>{score}</b></span>
      </div>
      <div className={'orbit-game-field ' + (alive ? '' : 'is-lost')}>
        <div className="orbit-safe-band" />
        <div className="orbit-game-core"><CoreIcon size={32} /></div>
        <span className="orbit-game-dot" style={dotStyle} />
        <span className="orbit-game-readout">{alive ? 'KEEP IT STABLE' : 'ORBIT LOST'}</span>
      </div>
      <div className="ent-game-actions">
        {alive ? (
          <button type="button" disabled={paused} onClick={boost}>BOOST ORBIT</button>
        ) : (
          <button type="button" onClick={reset}>RESTART</button>
        )}
      </div>
      <p className="ent-game-help">Gravity pulls you inward. Tap Boost to stay in the highlighted orbit without overshooting it.</p>
    </div>
  );
}

const CIPHER_SYMBOLS = ['△', '○', '◇', '□', '✦', '↑'];

function makeCipherSequence(length: number, seed: number) {
  return Array.from({ length }, (_, index) =>
    (seed * 3 + index * 5 + index * index * 2) % CIPHER_SYMBOLS.length
  );
}

function CipherGame({paused}: {paused:boolean}) {
  const [level, setLevel] = useState(1);
  const [score, setScore] = useState(0);
  const [sequence, setSequence] = useState(() => makeCipherSequence(4, 18));
  const [visible, setVisible] = useState(true);
  const [entry, setEntry] = useState<number[]>([]);
  const [feedback, setFeedback] = useState('READ THE SIGNAL');
  const feedbackTimer = useRef<number | undefined>(undefined);
  useEffect(()=>()=>window.clearTimeout(feedbackTimer.current),[]);

  useEffect(() => {
    window.clearTimeout(feedbackTimer.current);
    if (paused) return;
    setVisible(true);
    setEntry([]);
    setFeedback('READ THE SIGNAL');
    const timer = window.setTimeout(() => {
      setVisible(false);
      setFeedback('REBUILD IT');
    }, 1050 + sequence.length * 120);
    return () => window.clearTimeout(timer);
  }, [sequence, paused]);

  const choose = (symbolIndex: number) => {
    if (paused || visible || feedback === 'SIGNAL MATCHED' || feedback === 'SIGNAL BROKEN') return;
    const position = entry.length;

    if (sequence[position] !== symbolIndex) {
      setFeedback('SIGNAL BROKEN');
      setEntry([]);
      feedbackTimer.current = window.setTimeout(() => setFeedback('TRY AGAIN'), 420);
      return;
    }

    const nextEntry = [...entry, symbolIndex];
    setEntry(nextEntry);

    if (nextEntry.length === sequence.length) {
      setFeedback('SIGNAL MATCHED');
      setScore(value => value + sequence.length * 100);
      feedbackTimer.current = window.setTimeout(() => {
        const nextLevel = level + 1;
        setLevel(nextLevel);
        setSequence(makeCipherSequence(Math.min(8, 3 + nextLevel), 18 + nextLevel * 7));
      }, 560);
    }
  };

  return (
    <div className="ent-game-body cipher-game">
      <div className="ent-game-hud">
        <span>LEVEL <b>{level}</b></span>
        <span>SCORE <b>{score}</b></span>
      </div>
      <div className="cipher-display" aria-live="polite">
        {visible ? (
          sequence.map((symbol, index) => (
            <span key={String(index) + '-' + String(symbol)}>{CIPHER_SYMBOLS[symbol]}</span>
          ))
        ) : (
          sequence.map((_, index) => (
            <span key={index} className={index < entry.length ? 'is-filled' : ''}>
              {index < entry.length ? CIPHER_SYMBOLS[entry[index]] : '·'}
            </span>
          ))
        )}
      </div>
      <p className="cipher-feedback">{feedback}</p>
      <div className="cipher-pad">
        {CIPHER_SYMBOLS.map((symbol, index) => (
          <button
            type="button"
            key={symbol}
            onClick={() => choose(index)}
            disabled={paused || visible || feedback === 'SIGNAL MATCHED' || feedback === 'SIGNAL BROKEN'}
            aria-label={'Cipher symbol ' + symbol}
          >
            {symbol}
          </button>
        ))}
      </div>
      <p className="ent-game-help">Memorize the signal while it is visible, then rebuild it in order.</p>
    </div>
  );
}

type SurgePhase = 'ready' | 'waiting' | 'go' | 'result' | 'early';

function SurgeGame({paused}: {paused:boolean}) {
  const [phase, setPhase] = useState<SurgePhase>('ready');
  const [reaction, setReaction] = useState<number | null>(null);
  const timerRef = useRef<number | null>(null);
  const goAtRef = useRef(0);

  const clearTimer = () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  useEffect(() => clearTimer, []);
  useEffect(()=>{if(paused){clearTimer();setPhase('ready');setReaction(null);}},[paused]);

  const arm = () => {
    if (paused) return;
    clearTimer();
    setReaction(null);
    setPhase('waiting');
    const delay = 800 + Math.random() * 1800;
    timerRef.current = window.setTimeout(() => {
      goAtRef.current = performance.now();
      setPhase('go');
      timerRef.current = null;
    }, delay);
  };

  const hit = () => {
    if (paused) return;
    if (phase === 'waiting') {
      clearTimer();
      setPhase('early');
      return;
    }
    if (phase !== 'go') return;
    const ms = Math.round(performance.now() - goAtRef.current);
    setReaction(ms);
    setPhase('result');
  };

  const hostLine = useMemo(() => {
    if (phase === 'early') return 'Too soon. The signal had not fired.';
    if (phase !== 'result' || reaction === null) return '';
    if (reaction < 190) return 'Lightning response.';
    if (reaction < 260) return 'Clean reaction.';
    if (reaction < 360) return 'Solid. You can beat that.';
    return 'Try again when you’re ready.';
  }, [phase, reaction]);

  return (
    <div className="ent-game-body surge-game">
      <div
        className={'surge-pad is-' + phase}
        onPointerDown={hit}
        role="button"
        tabIndex={0}
        aria-label="Surge reaction pad"
        onKeyDown={event => {
          if (event.key === ' ' || event.key === 'Enter') {
            event.preventDefault();
            hit();
          }
        }}
      >
        <PulseIcon size={44} />
        <strong>
          {phase === 'ready' && 'ARM THE SIGNAL'}
          {phase === 'waiting' && 'WAIT...'}
          {phase === 'go' && 'NOW'}
          {phase === 'early' && 'FALSE START'}
          {phase === 'result' && (reaction === null ? 'RESULT' : String(reaction) + ' MS')}
        </strong>
        <span>{phase === 'go' ? 'HIT THE PULSE' : 'do not jump it'}</span>
      </div>
      <div className="ent-game-actions">
        {(phase === 'ready' || phase === 'result' || phase === 'early') && (
          <button
            type="button"
            onPointerDown={event => event.stopPropagation()}
            onClick={arm}
          >
            {phase === 'ready' ? 'START' : 'RUN AGAIN'}
          </button>
        )}
      </div>
      {hostLine && <p className="surge-ravin">{hostLine}</p>}
      <p className="ent-game-help">Arm the test, wait for the white pulse, then click or press Space as fast as you can.</p>
    </div>
  );
}

export function EntertainmentOverlay({
  gameId,
  onClose,
}: {
  gameId: EntertainmentGameId;
  onClose: () => void;
}) {
  const game = ENTERTAINMENT_GAMES.find(item => item.id === gameId) ?? ENTERTAINMENT_GAMES[0];
  const rootRef=useRef<HTMLDivElement>(null);
  const [manualPause,setManualPause]=useState(false);
  const [background,setBackground]=useState(false);
  const paused=manualPause||background;
  useEffect(()=>{const update=()=>setBackground(document.hidden);update();document.addEventListener('visibilitychange',update);return()=>document.removeEventListener('visibilitychange',update);},[]);
  useEffect(()=>{
    const previous=document.activeElement instanceof HTMLElement?document.activeElement:null;
    const root=rootRef.current;
    root?.querySelector<HTMLButtonElement>('.ent-close')?.focus();
    const contain=(event:KeyboardEvent)=>{
      if(event.key!=='Tab'||!root)return;
      const controls=[...root.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),[tabindex="0"]')].filter(el=>el.getClientRects().length);
      if(!controls.length){event.preventDefault();root.focus();return;}
      const first=controls[0],last=controls[controls.length-1];
      if(event.shiftKey&&(document.activeElement===first||!root.contains(document.activeElement))){event.preventDefault();last.focus();}
      else if(!event.shiftKey&&(document.activeElement===last||!root.contains(document.activeElement))){event.preventDefault();first.focus();}
    };
    document.addEventListener('keydown',contain,true);
    return()=>{document.removeEventListener('keydown',contain,true);if(previous?.isConnected)previous.focus();};
  },[]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div
      className="ent-overlay"
      ref={rootRef}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-label={game.name + ' game'}
      onPointerDown={event => event.stopPropagation()}
    >
      <div className="ent-overlay-shell">
        <header className="ent-overlay-header">
          <div>
            <p>{game.code} / ENTERTAINMENT MODE</p>
            <h2>{game.name}</h2>
            <span>{game.tagline}</span>
          </div>
          <button type="button" className="ent-close" onClick={onClose} aria-label="Close game">
            ×
          </button>
        </header>

        <div className="ent-session-controls"><button type="button" aria-pressed={manualPause} onClick={()=>setManualPause(value=>!value)}>{manualPause?'Resume':'Pause'}</button><span role="status">{paused?'Paused · your game stops while this tab is hidden':'Session active'}</span></div>
        {gameId === 'flight' && <FlightGame paused={paused} />}
        {gameId === 'orbit' && <OrbitGame paused={paused} />}
        {gameId === 'cipher' && <CipherGame paused={paused} />}
        {gameId === 'surge' && <SurgeGame paused={paused} />}

        <footer className="ent-overlay-footer">
          <span>ARROW ARCADE / LOCAL SESSION</span>
          <span>ESC TO RETURN TO ORBIT</span>
        </footer>
      </div>
    </div>
  );
}
