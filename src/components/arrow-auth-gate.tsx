'use client';

import { ArrowMarkIcon } from '@/components/orbit-icons';
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react';

const SUPABASE_URL = 'https://cnorozrjugxpanpfmssa.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_yVNPiB7opT0WRvBfKTZ2BA_s5bOQLRg';
const SUPABASE_SDK_URL =
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.112.4/dist/umd/supabase.js';
const ARROW_POST_AUTH_URL_KEY = 'arrow-post-auth-url-v1';
const DEV_AUTH_BYPASS_KEY = 'arrow-dev-auth-bypass-v1';
const REQUEST_COOLDOWN_MS = 60_000;

type AuthError = { message?: string } | null;

type AuthClient = {
  auth: {
    getUser: () => Promise<{ data: { user: unknown | null }; error: AuthError }>;
    signOut: (options?: { scope?: 'local' | 'global' | 'others' }) => Promise<{ error: AuthError }>;
    signInWithOAuth: (options: {
      provider: 'google';
      options: {
        redirectTo: string;
        scopes: string;
        queryParams: Record<string, string>;
      };
    }) => Promise<{ error: AuthError }>;
  };
};

declare global {
  interface Window {
    supabase?: {
      createClient: (
        url: string,
        key: string,
        options?: {
          auth?: {
            flowType?: 'pkce';
            detectSessionInUrl?: boolean;
            persistSession?: boolean;
            autoRefreshToken?: boolean;
          };
        },
      ) => AuthClient;
    };
  }
}

let sdkPromise: Promise<void> | null = null;
let authClient: AuthClient | null = null;

function loadSupabaseSdk() {
  if (window.supabase?.createClient) return Promise.resolve();
  if (sdkPromise) return sdkPromise;

  sdkPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      'script[data-arrow-supabase-sdk]',
    );

    const finish = () => {
      if (window.supabase?.createClient) resolve();
      else reject(new Error('ARROW sign-in could not load.'));
    };

    if (existing) {
      if (window.supabase?.createClient) {
        resolve();
        return;
      }
      existing.addEventListener('load', finish, { once: true });
      existing.addEventListener(
        'error',
        () => reject(new Error('ARROW sign-in could not load.')),
        { once: true },
      );
      return;
    }

    const script = document.createElement('script');
    script.src = SUPABASE_SDK_URL;
    script.async = true;
    script.crossOrigin = 'anonymous';
    script.dataset.arrowSupabaseSdk = 'true';
    script.addEventListener('load', finish, { once: true });
    script.addEventListener(
      'error',
      () => reject(new Error('ARROW sign-in could not load.')),
      { once: true },
    );
    document.head.appendChild(script);
  });

  return sdkPromise;
}

async function getAuthClient() {
  await loadSupabaseSdk();
  if (!window.supabase?.createClient) {
    throw new Error('ARROW sign-in could not load.');
  }

  authClient ??= window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY,
    {
      auth: {
        flowType: 'pkce',
        detectSessionInUrl: false,
        persistSession: true,
        autoRefreshToken: true,
      },
    },
  );

  return authClient;
}

function currentRelayCallback() {
  if (window.location.hostname === 'link9060.github.io') {
    return 'https://link9060.github.io/Resonant-Relay/auth/callback/';
  }

  return 'https://resonantrelay.org/auth/callback/';
}

function currentArrowReturnUrl() {
  const url = new URL(window.location.href);
  url.search = '';
  url.hash = '';
  return url.toString();
}

function rememberArrowReturn() {
  localStorage.setItem(ARROW_POST_AUTH_URL_KEY, currentArrowReturnUrl());
}

function isLocalDev() {
  return (
    window.location.hostname === '127.0.0.1' ||
    window.location.hostname === 'localhost'
  );
}

function retryTime(timestamp: number) {
  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(timestamp);
}

export function ArrowAuthGate({ children }: { children: ReactNode }) {
  const [authorized, setAuthorized] = useState(false);
  const [checking, setChecking] = useState(true);
  const [googleEnabled, setGoogleEnabled] = useState(false);
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [retryAfter, setRetryAfter] = useState<number | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    if (
      isLocalDev() &&
      localStorage.getItem(DEV_AUTH_BYPASS_KEY) === '1'
    ) {
      setAuthorized(true);
      setChecking(false);
      return () => {
        mountedRef.current = false;
      };
    }

    void (async () => {
      try {
        const [client, settingsResponse] = await Promise.all([
          getAuthClient(),
          fetch(`${SUPABASE_URL}/auth/v1/settings`, {
            headers: { apikey: SUPABASE_PUBLISHABLE_KEY },
          }).catch(() => null),
        ]);

        if (settingsResponse?.ok) {
          const settings = (await settingsResponse.json()) as {
            external?: { google?: boolean };
          };
          if (mountedRef.current) {
            setGoogleEnabled(settings.external?.google === true);
          }
        }

        const {
          data: { user },
        } = await client.auth.getUser();

        if (mountedRef.current) {
          setAuthorized(Boolean(user));
          setChecking(false);
        }
      } catch {
        if (mountedRef.current) {
          setAuthorized(false);
          setChecking(false);
          setMessage(
            'ARROW could not check your session. Email sign-in is still available.',
          );
        }
      }
    })();

    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!retryAfter) return;

    const timer = window.setTimeout(() => {
      setRetryAfter(null);
      setMessage(null);
    }, Math.max(0, retryAfter - Date.now()) + 250);

    return () => window.clearTimeout(timer);
  }, [retryAfter]);

  const signInWithGoogle = async () => {
    setBusy(true);
    setMessage(null);

    try {
      const client = await getAuthClient();
      await client.auth.signOut({ scope: 'local' });
      rememberArrowReturn();

      const { error } = await client.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: currentRelayCallback(),
          scopes: 'openid email profile',
          queryParams: { prompt: 'select_account' },
        },
      });

      if (error) throw new Error(error.message || 'Google sign-in failed.');
    } catch {
      setMessage(
        'Google sign-in is unavailable right now. Use the email option below.',
      );
      setBusy(false);
    }
  };

  const signInWithEmail = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (retryAfter) {
      setMessage(
        `That email was requested too recently. Try again after ${retryTime(retryAfter)}.`,
      );
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) return;

    setBusy(true);
    setMessage(null);
    rememberArrowReturn();

    try {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/auth-email`, {
        method: 'POST',
        headers: {
          apikey: SUPABASE_PUBLISHABLE_KEY,
          authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          email: normalizedEmail,
          brand: 'arrow',
        }),
      });

      const body = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;

      if (response.status === 429) {
        const nextAttempt = Date.now() + REQUEST_COOLDOWN_MS;
        setRetryAfter(nextAttempt);
        setMessage(
          `Too many sign-in emails were requested. Try again after ${retryTime(nextAttempt)}.`,
        );
        return;
      }

      if (!response.ok) {
        throw new Error(body?.error || 'ARROW could not send the sign-in email.');
      }

      setMessage(
        'Sign-in link sent. Open the newest ARROW email in this browser to continue.',
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'ARROW could not send the sign-in email.',
      );
    } finally {
      setBusy(false);
    }
  };

  if (authorized) return <>{children}</>;

  return (
    <main className="arrow-auth-gate" aria-busy={checking}>
      <section className="arrow-auth-card" aria-labelledby="arrow-auth-title">
        <div className="arrow-auth-brand">
          <span className="arrow-auth-mark" aria-hidden="true">
            <ArrowMarkIcon size={30} />
          </span>
          <div>
            <p>RESONANT ASSIST</p>
            <h1 id="arrow-auth-title">ARROW</h1>
          </div>
        </div>

        <div className="arrow-auth-copy">
          <p className="arrow-auth-kicker">ONE ACCOUNT · EVERY CENTER</p>
          <h2>Your system starts here.</h2>
          <p>
            Sign in once, then move through Orbit, Relay, RAVIN, Atlas, and
            Waypoint as one connected ARROW system.
          </p>
        </div>

        {checking ? (
          <div className="arrow-auth-checking" role="status">
            <span />
            Checking your ARROW session
          </div>
        ) : (
          <>
            {googleEnabled && (
              <>
                <button
                  type="button"
                  className="arrow-auth-google"
                  onClick={signInWithGoogle}
                  disabled={busy}
                >
                  <GoogleIcon />
                  Continue with Google
                </button>
                <div className="arrow-auth-divider" aria-hidden="true">
                  <span />
                  or
                  <span />
                </div>
              </>
            )}

            <form className="arrow-auth-form" onSubmit={signInWithEmail}>
              <label htmlFor="arrow-email">Personal email address</label>
              <input
                id="arrow-email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={event => setEmail(event.target.value)}
                placeholder="you@example.com"
              />
              <button type="submit" disabled={busy || Boolean(retryAfter)}>
                {retryAfter
                  ? `Try again after ${retryTime(retryAfter)}`
                  : busy
                    ? 'Sending…'
                    : 'Email me a sign-in link'}
              </button>
            </form>
          </>
        )}

        {message && (
          <p className="arrow-auth-message" role="status">
            {message}
          </p>
        )}

        <div className="arrow-auth-note">
          <strong>Use a personal account.</strong>
          <span>
            School- or work-managed accounts can block sign-in or connected
            permissions.
          </span>
        </div>

        <p className="arrow-auth-legal">
          ARROW currently uses the existing Resonant authentication service
          while the suite moves to one domain.
        </p>
      </section>
    </main>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.9c1.7-1.57 2.7-3.88 2.7-6.62z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.8.54-1.84.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.9v2.33A9 9 0 0 0 9 18z" />
      <path fill="#FBBC05" d="M3.95 10.7A5.4 5.4 0 0 1 3.66 9c0-.59.1-1.16.29-1.7V4.97H.9A9 9 0 0 0 0 9c0 1.45.35 2.83.9 4.03l3.05-2.33z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .9 4.97l3.05 2.33C4.66 5.17 6.65 3.58 9 3.58z" />
    </svg>
  );
}
