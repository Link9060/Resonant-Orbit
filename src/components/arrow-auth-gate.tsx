'use client';

import { useEffect, useState, type ReactNode } from 'react';

const DEV_AUTH_BYPASS_KEY = 'arrow-dev-auth-bypass-v1';

function isLocalDev() {
  return (
    window.location.hostname === '127.0.0.1' ||
    window.location.hostname === 'localhost'
  );
}

export function ArrowAuthGate({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const onArrowDomain =
      window.location.hostname === 'enterarrow.com' ||
      window.location.hostname === 'www.enterarrow.com';

    if (onArrowDomain) {
      // The domain-level /arrow-auth-guard.js owns authentication.
      setReady(true);
      return;
    }

    if (isLocalDev() && localStorage.getItem(DEV_AUTH_BYPASS_KEY) === '1') {
      setReady(true);
      return;
    }

    const next = '/orbit/' + window.location.search + window.location.hash;
    const login = new URL('https://enterarrow.com/');
    login.searchParams.set('next', next);
    window.location.replace(login.toString());
  }, []);

  if (!ready) return null;
  return <>{children}</>;
}
