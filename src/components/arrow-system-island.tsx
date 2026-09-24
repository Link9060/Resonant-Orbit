'use client';

import { useEffect, useRef, useState } from 'react';

const RELAY_BASE =
  process.env.NEXT_PUBLIC_RELAY_SITE_URL ??
  'https://link9060.github.io/Resonant-Relay';

const SYSTEM_LINKS = [
  { href: '/', label: 'Orbit', icon: 'orbit' },
  { href: `${RELAY_BASE}/notes/`, label: 'Notes', icon: 'notes' },
  { href: `${RELAY_BASE}/todo/`, label: 'Tasks', icon: 'tasks' },
  { href: `${RELAY_BASE}/focus/`, label: 'Focus', icon: 'focus' },
  { href: `${RELAY_BASE}/calendar/`, label: 'Calendar', icon: 'calendar' },
  { href: `${RELAY_BASE}/quicklinks/`, label: 'Links', icon: 'links' },
] as const;

function SystemIcon({ kind }: { kind: string }) {
  if (kind === 'orbit') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="2.2" />
        <ellipse cx="12" cy="12" rx="8.2" ry="3.7" fill="none" />
        <ellipse cx="12" cy="12" rx="3.7" ry="8.2" fill="none" />
      </svg>
    );
  }

  if (kind === 'notes') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M6.5 4.5h11v15h-11z" fill="none" />
        <path d="M9 8h6M9 11.5h6M9 15h4" fill="none" />
      </svg>
    );
  }

  if (kind === 'tasks') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="m5.5 7.5 1.8 1.8 3.2-3.4M12.5 8h6M5.5 15l1.8 1.8 3.2-3.4M12.5 15.5h6" fill="none" />
      </svg>
    );
  }

  if (kind === 'focus') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="6.5" fill="none" />
        <path d="M12 3v3M12 18v3M3 12h3M18 12h3" fill="none" />
      </svg>
    );
  }

  if (kind === 'calendar') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="4.5" y="6" width="15" height="13" rx="2" fill="none" />
        <path d="M8 3.8v4.4M16 3.8v4.4M4.5 10h15" fill="none" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M9.5 14.5 14.5 9.5M8 16l-1.2 1.2a3.1 3.1 0 0 1-4.4-4.4L6.2 9a3.1 3.1 0 0 1 4.4 0M16 8l1.2-1.2a3.1 3.1 0 0 1 4.4 4.4L17.8 15a3.1 3.1 0 0 1-4.4 0" fill="none" />
    </svg>
  );
}

export function ArrowSystemIsland() {
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(false);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setPinned(false);
        setOpen(false);
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setPinned(false);
      setOpen(false);
      rootRef.current?.querySelector<HTMLButtonElement>('.arrow-system-trigger')?.focus();
    };

    document.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  return (
    <div className="arrow-system-anchor">
      <div
        ref={rootRef}
        className="arrow-system-island"
        data-open={open ? 'true' : 'false'}
        data-pinned={pinned ? 'true' : 'false'}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => {
          if (!pinned) setOpen(false);
        }}
        onFocusCapture={() => setOpen(true)}
        onBlurCapture={() => {
          window.requestAnimationFrame(() => {
            if (!pinned && rootRef.current && !rootRef.current.contains(document.activeElement)) {
              setOpen(false);
            }
          });
        }}
      >
        <div className="arrow-system-content" aria-hidden={!open}>
          {SYSTEM_LINKS.map(link => (
            <a
              key={link.label}
              href={link.href}
              className="arrow-system-control"
              aria-label={link.label}
              aria-current={link.label === 'Orbit' ? 'page' : undefined}
              title={link.label}
            >
              <SystemIcon kind={link.icon} />
              <span>{link.label}</span>
            </a>
          ))}

          <span className="arrow-system-divider" aria-hidden="true" />

          <a
            href={`${RELAY_BASE}/profile/`}
            className="arrow-system-settings"
            aria-label="ARROW settings"
            title="ARROW settings"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="12" r="3" fill="none" />
              <path d="M12 3.5v2M12 18.5v2M3.5 12h2M18.5 12h2M6 6l1.5 1.5M16.5 16.5 18 18M18 6l-1.5 1.5M7.5 16.5 6 18" fill="none" />
            </svg>
          </a>

          <span className="arrow-system-divider" aria-hidden="true" />
          <span className="arrow-system-name" aria-hidden="true">ARROW</span>
        </div>

        <button
          type="button"
          className="arrow-system-trigger"
          onClick={() => {
            const next = !pinned;
            setPinned(next);
            setOpen(next || !open);
          }}
          aria-label={open ? 'Close ARROW controls' : 'Open ARROW controls'}
          aria-expanded={open}
          title="ARROW"
        >
          <span className="arrow-system-mark" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
