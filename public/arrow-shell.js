(() => {
  if (window.ArrowOS) { window.ArrowOS.mountAll(); return; }
  const STORAGE = {
    links: 'arrow_os_links_v1',
    theme: 'arrow_os_theme_v1',
    motion: 'arrow_os_motion_v1',
    accent: 'arrow_os_accent_v1',
    experience: 'arrow_os_experience_v1',
    focusMinutes: 'arrow_os_focus_minutes_v1',
    focusState: 'arrow_os_focus_state_v1',
  };

  const BETA_BASE = location.hostname === 'link9060.github.io' && location.pathname.startsWith('/Resonant-Relay/') ? '/Resonant-Relay/arrow' : '';
  function resolveHref(href) {
    const url=new URL(href,location.origin);
    if(!BETA_BASE)return url.toString();
    const aliases={'Resonant-Orbit':'orbit','Resonant-Waypoint':'waypoint','Resonant-Field':'atlas','Project-R.A.V.I.N.-1.1':'ravin'};
    if(url.hostname==='link9060.github.io'){const first=url.pathname.split('/')[1];if(aliases[first])url.pathname='/'+aliases[first]+url.pathname.slice(first.length+1);}
    if((url.origin===location.origin || ['enterarrow.com','www.enterarrow.com','link9060.github.io'].includes(url.hostname)) && /^\/(orbit|relay|ravin|atlas|waypoint)(\/|$)/.test(url.pathname)) {
      const path=url.pathname.startsWith('/relay')?'/Resonant-Relay'+url.pathname.slice(6):BETA_BASE+url.pathname;
      return new URL(path+url.search+url.hash,location.origin).toString();
    }
    return url.toString();
  }

  const ON_ENTERARROW = ['enterarrow.com', 'www.enterarrow.com'].includes(window.location.hostname);
  const ORBIT_URL = BETA_BASE ? BETA_BASE+'/orbit/' : ON_ENTERARROW ? '/orbit/' : 'https://link9060.github.io/Resonant-Orbit/';
  const WAYPOINT_URL = BETA_BASE ? BETA_BASE+'/waypoint/' : ON_ENTERARROW ? '/waypoint/' : 'https://link9060.github.io/Resonant-Waypoint/';
  const RELAY_URL = BETA_BASE ? '/Resonant-Relay/' : ON_ENTERARROW ? '/relay/' : 'https://link9060.github.io/Resonant-Relay/';
  const RAVIN_URL = BETA_BASE ? BETA_BASE+'/ravin/' : ON_ENTERARROW ? '/ravin/' : 'https://link9060.github.io/Project-R.A.V.I.N.-1.1/';
  const SIGNOUT_URL = ON_ENTERARROW ? '/signout/' : '';

  document.addEventListener('click', event => {if(!BETA_BASE)return;const link=event.target.closest?.('a[href]');if(link)link.href=resolveHref(link.href);},true);

  // Public client credentials only. User ownership is enforced by Supabase RLS.
  const ARROW_SUPABASE_URL = 'https://cnorozrjugxpanpfmssa.supabase.co';
  const ARROW_SUPABASE_KEY = 'sb_publishable_yVNPiB7opT0WRvBfKTZ2BA_s5bOQLRg';
  const ARROW_AUTH_STORAGE_KEY = 'sb-cnorozrjugxpanpfmssa-auth-token';
  const VALID_MODULES = new Set(['relay', 'orbit', 'atlas', 'ravin', 'waypoint']);
  const PANEL_LABELS = {
    ravin: 'RAVIN',
    notes: 'Notes',
    tasks: 'Tasks',
    focus: 'Focus',
    calendar: 'Calendar',
    links: 'Links',
    appearance: 'Appearance',
    settings: 'Settings',
    support: 'ARROW support',
    moderation: 'ARROW staff',
  };

  const ACCENTS = [
    ['mono', 'Monochrome', '#f3f3f4'],
    ['cobalt', 'Cobalt', '#2f6fed'],
    ['violet', 'Violet', '#7c3aed'],
    ['rose', 'Rose', '#e11d48'],
    ['cyan', 'Cyan', '#0891b2'],
    ['emerald', 'Emerald', '#059669'],
    ['amber', 'Amber', '#d97706'],
  ];

  const state = {
    instances: new Set(),
    activePanel: null,
    activeModule: null,
    panelEl: null,
    panelBody: null,
    panelTitle: null,
    lastFocused: null,
    panelAnchor: null,
    focusTimer: null,
    focusRemaining: 25 * 60,
    focusRunning: false,
    focusUpdatedAt: 0,
    arrivalHandled: false,
    departing: false,
  };

  function id() {
    if (crypto?.randomUUID) return crypto.randomUUID();
    return 'a-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function readJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      const parsed = JSON.parse(raw);
      return parsed ?? fallback;
    } catch {
      return fallback;
    }
  }

  function writeJson(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {}
    window.dispatchEvent(new CustomEvent('arrow-os:datachange', { detail: { key, value } }));
  }

  function readString(key, fallback = '') {
    try {
      return localStorage.getItem(key) ?? fallback;
    } catch {
      return fallback;
    }
  }

  function writeString(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch {}
    window.dispatchEvent(new CustomEvent('arrow-os:datachange', { detail: { key, value } }));
  }

  function readArrowSession() {
    try {
      const session = JSON.parse(localStorage.getItem(ARROW_AUTH_STORAGE_KEY) || 'null');
      return session && typeof session.access_token === 'string' ? session : null;
    } catch {
      return null;
    }
  }

  function saveArrowSession(session) {
    try { localStorage.setItem(ARROW_AUTH_STORAGE_KEY, JSON.stringify(session)); } catch {}
  }

  async function refreshArrowSession(session) {
    if (!session?.refresh_token) return null;
    if (window.__arrowSessionRefreshPromise) return window.__arrowSessionRefreshPromise;
    window.__arrowSessionRefreshPromise = (async () => {
      const response = await fetch(ARROW_SUPABASE_URL + '/auth/v1/token?grant_type=refresh_token', {
        method: 'POST', headers: { apikey: ARROW_SUPABASE_KEY, 'content-type': 'application/json' },
        body: JSON.stringify({ refresh_token: session.refresh_token }),
      });
      if (!response.ok) return null;
      const fresh = await response.json();
      const merged = { ...session, ...fresh, user: fresh.user || session.user };
      saveArrowSession(merged); return merged;
    })();
    try { return await window.__arrowSessionRefreshPromise; }
    finally { window.__arrowSessionRefreshPromise = null; }
  }

  async function arrowData(pathname, options = {}, retry = true) {
    let session = readArrowSession();
    if (!session?.access_token) {
      const error = new Error('Sign in to ARROW to use shared data.');
      error.code = 'ARROW_AUTH_REQUIRED';
      throw error;
    }
    if (session.expires_at && Number(session.expires_at) * 1000 < Date.now() + 30000) {
      session = await refreshArrowSession(session) || session;
    }

    const headers = {
      apikey: ARROW_SUPABASE_KEY,
      Authorization: 'Bearer ' + session.access_token,
      Accept: 'application/json',
      ...(options.headers || {}),
    };
    if (options.body !== undefined) headers['content-type'] = 'application/json';

    const response = await fetch(ARROW_SUPABASE_URL + pathname, {
      method: options.method || 'GET',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });

    if (response.status === 401 && retry) {
      const fresh = await refreshArrowSession(session);
      if (fresh) return arrowData(pathname, options, false);
    }
    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      throw new Error(payload?.message || payload?.error || 'ARROW data could not load.');
    }

    if ((options.method || 'GET').toUpperCase() !== 'GET') {
      try { localStorage.setItem('arrow_shared_data_ping_v1', String(Date.now())); } catch {}
      window.dispatchEvent(new CustomEvent('arrow:planning-changed'));
    }

    if (response.status === 204) return null;
    const text = await response.text();
    return text ? JSON.parse(text) : null;
  }

  function currentArrowUserId() {
    return readArrowSession()?.user?.id || null;
  }

  function sharedDataError(error) {
    const signIn = error?.code === 'ARROW_AUTH_REQUIRED'
      ? '<a href="' + escapeAttr(ORBIT_URL) + '">Open ARROW sign in ↗</a>'
      : '';
    return '<div class="arrow-os-empty"><strong>Shared ARROW data is unavailable.</strong><span>' +
      escapeHtml(error?.message || 'Try again in a moment.') + '</span>' + signIn + '</div>';
  }

  function resolveTheme(choice) {
    if (choice === 'light' || choice === 'dark') return choice;
    return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  function getThemeChoice() {
    const value = readString(STORAGE.theme, 'system');
    return ['system', 'light', 'dark'].includes(value) ? value : 'system';
  }

  function applyTheme(choice = getThemeChoice(), persist = false) {
    const resolved = resolveTheme(choice);

    if (persist) writeString(STORAGE.theme, choice);

    try {
      localStorage.setItem('relay-theme', resolved);
      localStorage.setItem('resonant-theme', resolved);
      localStorage.setItem('ravin_theme', resolved);
    } catch {}

    const root = document.documentElement;
    const currentModule = [...state.instances][0]?.module;
    if (true) {
      root.classList.toggle('dark', resolved === 'dark');
      if (root.dataset.theme !== resolved) root.dataset.theme = resolved;
    }
    if (root.dataset.arrowTheme !== resolved) root.dataset.arrowTheme = resolved;

    window.dispatchEvent(new CustomEvent('arrow:themechange', {
      detail: { choice, resolved },
    }));

    updateHostTheme();
    state.instances.forEach(updateInstanceState);
    if (state.activePanel === 'appearance') updateAppearanceState();
  }

  function getExperienceChoice() {
    const value = readString(STORAGE.experience, 'balanced');
    return ['balanced', 'quiet', 'dynamic', 'glass'].includes(value) ? value : 'balanced';
  }

  function applyExperienceChoice(choice, persist = false) {
    if (persist) writeString(STORAGE.experience, choice);
    const normalized = ['balanced', 'quiet', 'dynamic', 'glass'].includes(choice) ? choice : 'balanced';
    document.documentElement.dataset.arrowExperience = normalized;

    const relayMap = {
      balanced: 'flow',
      quiet: 'still',
      dynamic: 'spark',
      glass: 'lucid',
    };

    try {
      localStorage.setItem('relay-experience-mode', relayMap[normalized] || 'flow');
    } catch {}

    window.dispatchEvent(new CustomEvent('relay-experience-change'));
    window.dispatchEvent(new CustomEvent('arrow:experiencechange', { detail: { experience: normalized } }));

    if (state.activePanel === 'appearance') updateAppearanceState();
  }

  function applyAccent(accent, persist = false) {
    const allowed = new Set(ACCENTS.map(([value]) => value));
    const normalized = allowed.has(accent) ? accent : 'mono';
    if (persist) writeString(STORAGE.accent, normalized);
    document.documentElement.dataset.arrowAccent = normalized;

    const relayPalette = normalized === 'mono' ? 'monochrome' : normalized;
    try {
      localStorage.setItem('relay-experience-palette', relayPalette);
    } catch {}

    window.dispatchEvent(new CustomEvent('relay-experience-change'));
    window.dispatchEvent(new CustomEvent('arrow:accentchange', { detail: { accent: normalized } }));

    if (state.activePanel === 'appearance') updateAppearanceState();
  }

  function getMotionChoice() {
    const value = readString(STORAGE.motion, 'system');
    return ['system', 'full', 'reduce'].includes(value) ? value : 'system';
  }

  function motionReduced() {
    const choice = getMotionChoice();
    if (choice === 'reduce') return true;
    if (choice === 'full') return false;
    return matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function applyMotion(choice, persist = false) {
    if (persist) writeString(STORAGE.motion, choice);
    document.documentElement.dataset.arrowMotion = motionReduced() ? 'reduce' : 'full';
    window.dispatchEvent(new CustomEvent('arrow:motionchange', {
      detail: { choice, reduced: motionReduced() },
    }));
    if (state.activePanel === 'appearance') updateAppearanceState();
  }

  function hostIsDark() {
    const root = document.documentElement;
    if (root.dataset.theme === 'dark' || root.getAttribute('data-theme') === 'dark') return true;
    if (root.dataset.theme === 'light' || root.getAttribute('data-theme') === 'light') return false;
    if (root.classList.contains('dark')) return true;

    const target = document.body || root;
    const value = getComputedStyle(target).backgroundColor;
    const match = value.match(/rgba?\((\d+)[,\s]+(\d+)[,\s]+(\d+)/);
    if (!match) return matchMedia('(prefers-color-scheme: dark)').matches;
    const [, r, g, b] = match.map(Number);
    const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    return lum < 0.48;
  }

  function updateHostTheme() {
    const hostTheme = hostIsDark() ? 'dark' : 'light';
    state.instances.forEach(instance => {
      if (instance.root.dataset.hostTheme !== hostTheme) instance.root.dataset.hostTheme = hostTheme;
    });
    if (state.panelEl && state.panelEl.dataset.hostTheme !== hostTheme) state.panelEl.dataset.hostTheme = hostTheme;
  }

  function icon(name) {
    const paths = {
      orbit: '<circle cx="12" cy="12" r="2.2"/><ellipse cx="12" cy="12" rx="8.2" ry="3.7" fill="none"/><ellipse cx="12" cy="12" rx="3.7" ry="8.2" fill="none"/>',
      notes: '<path d="M6.5 4.5h11v15h-11zM9 8h6M9 11.5h6M9 15h4" fill="none"/>',
      tasks: '<path d="m5.5 7.5 1.8 1.8 3.2-3.4M12.5 8h6M5.5 15l1.8 1.8 3.2-3.4M12.5 15.5h6" fill="none"/>',
      focus: '<circle cx="12" cy="12" r="6.5" fill="none"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3" fill="none"/>',
      calendar: '<rect x="4.5" y="6" width="15" height="13" rx="2" fill="none"/><path d="M8 3.8v4.4M16 3.8v4.4M4.5 10h15" fill="none"/>',
      links: '<path d="M9.5 14.5 14.5 9.5M8 16l-1.2 1.2a3.1 3.1 0 0 1-4.4-4.4L6.2 9a3.1 3.1 0 0 1 4.4 0M16 8l1.2-1.2a3.1 3.1 0 0 1 4.4 4.4L17.8 15a3.1 3.1 0 0 1-4.4 0" fill="none"/>',
      appearance: '<circle cx="12" cy="12" r="7.2" fill="none"/><path d="M12 4.8a7.2 7.2 0 0 0 0 14.4V4.8Z" fill="currentColor" stroke="none"/>',
      settings: '<circle cx="12" cy="12" r="3" fill="none"/><path d="M12 3.5v2M12 18.5v2M3.5 12h2M18.5 12h2M6 6l1.5 1.5M16.5 16.5 18 18M18 6l-1.5 1.5M7.5 16.5 6 18" fill="none"/>',
      ravin: '<circle cx="12" cy="12" r="2.4"/><circle cx="12" cy="12" r="6.8" fill="none"/><path d="M12 2.5v2M21.5 12h-2M12 21.5v-2M2.5 12h2" fill="none"/>',
      plus: '<path d="M12 5v14M5 12h14" fill="none"/>',
      trash: '<path d="M6 7h12M9 7V5h6v2M8 9l.6 9h6.8L16 9" fill="none"/>',
      close: '<path d="m7 7 10 10M17 7 7 17" fill="none"/>',
      play: '<path d="m9 7 8 5-8 5Z" fill="currentColor" stroke="none"/>',
      pause: '<path d="M8 7h3v10H8zM13 7h3v10h-3z" fill="currentColor" stroke="none"/>',
      reset: '<path d="M6.5 8.5A6.5 6.5 0 1 1 6 15M6.5 8.5V4.8M6.5 8.5h3.7" fill="none"/>',
    };
    return '<svg viewBox="0 0 24 24" aria-hidden="true">' + (paths[name] || '') + '</svg>';
  }

  function controlButton(name, label, extra = '') {
    return '<button type="button" class="arrow-os-control" data-arrow-panel="' + name + '" aria-label="' + label + '" title="' + label + '" aria-haspopup="dialog" aria-expanded="false" ' + extra + '>' +
      icon(name) + '<span>' + label + '</span></button>';
  }

  function createInstance(mount) {
    if (mount.dataset.arrowOsMounted === 'true') return;
    mount.dataset.arrowOsMounted = 'true';

    // eslint-disable-next-line @next/next/no-assign-module-variable -- Browser-only ARROW center identifier.
    const module = VALID_MODULES.has(mount.dataset.module) ? mount.dataset.module : 'relay';
    const orbitAccess = mount.dataset.orbitAccess || 'enabled';
    const orbitEnabled = orbitAccess !== 'disabled';
    const root = document.createElement('div');
    root.className = 'arrow-os-root';
    root.dataset.module = module;
    root.dataset.open = 'false';
    root.dataset.pinned = 'false';
    root.innerHTML =
      '<div class="arrow-os-island" role="navigation" aria-label="ARROW system controls">' +
        '<div class="arrow-os-content" aria-hidden="true">' +
          '<span class="arrow-os-module">' + module.toUpperCase() + '</span>' +
          '<button type="button" class="arrow-os-control arrow-os-orbit" aria-label="Orbit" title="Orbit">' + icon('orbit') + '<span>Orbit</span></button>' +
          controlButton('ravin', 'RAVIN') +
          '<span class="arrow-os-divider" aria-hidden="true"></span>' +
          controlButton('notes', 'Notes') +
          controlButton('tasks', 'Tasks') +
          controlButton('focus', 'Focus') +
          controlButton('calendar', 'Calendar') +
          controlButton('links', 'Links') +
          '<span class="arrow-os-divider" aria-hidden="true"></span>' +
          controlButton('appearance', 'Appearance') +
          controlButton('settings', 'Settings') +
          controlButton('support', 'Support') +
          '<span class="arrow-os-divider" aria-hidden="true"></span>' +
          '<span class="arrow-os-name" aria-hidden="true">ARROW</span>' +
        '</div>' +
        '<button type="button" class="arrow-os-trigger" aria-label="Open ARROW controls" aria-expanded="false" title="ARROW">' +
          '<span class="arrow-os-mark" aria-hidden="true"></span>' +
        '</button>' +
      '</div>';

    mount.replaceChildren(root);

    const instance = {
      mount,
      root,
      module,
      orbitAccess,
      orbitEnabled,
      trigger: root.querySelector('.arrow-os-trigger'),
      content: root.querySelector('.arrow-os-content'),
      hover: false,
      pinned: false,
    };

    state.instances.add(instance);

    root.addEventListener('mouseenter', () => {
      instance.hover = true;
      setOpen(instance, true);
    });
    root.addEventListener('mouseleave', () => {
      instance.hover = false;
      if (!instance.pinned && !state.activePanel) setOpen(instance, false);
    });
    root.addEventListener('focusin', () => setOpen(instance, true));
    root.addEventListener('focusout', () => {
      requestAnimationFrame(() => {
        if (!instance.pinned && !state.activePanel && !root.contains(document.activeElement)) {
          setOpen(instance, false);
        }
      });
    });

    instance.trigger.addEventListener('click', () => {
      if (state.activePanel) {
        closePanel(false);
        instance.pinned = false;
        root.dataset.pinned = 'false';
        setOpen(instance, false);
        instance.trigger.focus({ preventScroll: true });
        return;
      }

      instance.pinned = !instance.pinned;
      root.dataset.pinned = String(instance.pinned);
      setOpen(instance, instance.pinned || root.dataset.open !== 'true');
    });

    const orbitButton = root.querySelector('.arrow-os-orbit');
    if (module === 'orbit') {
      orbitButton.classList.add('is-active');
      orbitButton.setAttribute('aria-current', 'page');
    } else if (!orbitEnabled) {
      orbitButton.classList.add('is-disabled');
      orbitButton.disabled = true;
      orbitButton.setAttribute('aria-disabled', 'true');
      orbitButton.setAttribute('aria-label', 'Orbit — coming soon');
      orbitButton.setAttribute('title', 'Orbit — coming soon');
      orbitButton.querySelector('span')?.replaceChildren('Orbit · Soon');
    }

    orbitButton.addEventListener('click', () => {
      if (!orbitEnabled && module !== 'orbit') return;
      if (module === 'orbit') {
        closePanel();
        const core = document.querySelector('.orbit-core-label');
        if (core instanceof HTMLButtonElement) core.click();
        window.dispatchEvent(new CustomEvent('arrow:orbit-home'));
        return;
      }
      launchToOrbit(module, orbitButton, instance.orbitAccess);
    });

    root.querySelectorAll('[data-arrow-panel]').forEach(button => {
      button.addEventListener('click', () => {
        const name = button.dataset.arrowPanel;
        state.lastFocused = button;
        state.panelAnchor = instance.trigger;
        openPanel(name, module, button);
      });
    });

    setOpen(instance, false);
    updateInstanceState(instance);
    updateHostTheme();
  }

  function setOpen(instance, open) {
    instance.root.dataset.open = String(open);
    instance.trigger.setAttribute('aria-expanded', String(open));
    instance.trigger.setAttribute('aria-label', open ? 'Close ARROW controls' : 'Open ARROW controls');
    instance.content.setAttribute('aria-hidden', String(!open));
    instance.content.inert = !open;
  }

  function updateInstanceState(instance) {
    instance.root.querySelectorAll('[data-arrow-panel]').forEach(button => {
      const active = button.dataset.arrowPanel === state.activePanel;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-expanded', String(active));
      button.setAttribute('aria-controls', 'arrow-os-system-panel');
    });
  }

  function ensurePanel() {
    if (state.panelEl) return state.panelEl;

    const panel = document.createElement('section');
    panel.className = 'arrow-os-panel';
    panel.id = 'arrow-os-system-panel';
    panel.hidden = true;
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'false');
    panel.setAttribute('aria-labelledby', 'arrow-os-panel-title');
    panel.innerHTML =
      '<header class="arrow-os-panel-head">' +
        '<div><span>ARROW SYSTEM</span><h2 id="arrow-os-panel-title"></h2></div>' +
        '<button type="button" class="arrow-os-panel-close" aria-label="Close ARROW panel">' + icon('close') + '</button>' +
      '</header>' +
      '<div class="arrow-os-panel-body"></div>';

    document.body.appendChild(panel);
    state.panelEl = panel;
    state.panelBody = panel.querySelector('.arrow-os-panel-body');
    state.panelTitle = panel.querySelector('h2');

    panel.querySelector('.arrow-os-panel-close').addEventListener('click', closePanel);
    panel.addEventListener('keydown', handlePanelKeydown);
    return panel;
  }

  function positionPanel(anchor) {
    const panel = ensurePanel();
    const rect = anchor?.getBoundingClientRect();
    const mobile = innerWidth <= 680;
    const availableHeight = window.visualViewport?.height || innerHeight;

    if (mobile) {
      panel.style.left = '12px';
      panel.style.right = '12px';
      panel.style.top = Math.max(64, (rect?.bottom || 58) + 8) + 'px';
      panel.style.width = 'auto';
    } else {
      const right = Math.max(12, innerWidth - (rect?.right || innerWidth - 20));
      panel.style.left = 'auto';
      panel.style.right = right + 'px';
      panel.style.top = Math.max(58, (rect?.bottom || 50) + 8) + 'px';
      panel.style.width = 'min(430px, calc(100vw - 24px))';
    }
    const top = Math.min(parseFloat(panel.style.top), Math.max(12, availableHeight - 160));
    panel.style.top = top + 'px';
    panel.style.maxHeight = Math.max(80, availableHeight - top - 12) + 'px';
  }

  function openPanel(name, module, anchor) {
    if (!PANEL_LABELS[name]) return;
    const panel = ensurePanel();
    state.activePanel = name;
    state.activeModule = module;
    state.lastFocused = anchor || state.lastFocused;

    state.panelTitle.textContent = PANEL_LABELS[name];
    panel.dataset.panel = name;
    panel.hidden = false;
    panel.dataset.open = 'true';
    positionPanel(state.panelAnchor || anchor || document.querySelector('.arrow-os-trigger'));
    updateHostTheme();
    renderPanel(name);

    state.instances.forEach(instance => {
      setOpen(instance, true);
      updateInstanceState(instance);
    });

    requestAnimationFrame(() => {
      panel.querySelector('input, textarea, button:not(.arrow-os-panel-close), a[href]')?.focus({ preventScroll: true });
    });
  }

  function closePanel(restoreFocus = true) {
    if (!state.panelEl || state.panelEl.hidden) return;
    state.panelEl.dataset.open = 'false';
    state.panelEl.hidden = true;
    state.activePanel = null;
    state.activeModule = null;
    state.instances.forEach(instance => {
      updateInstanceState(instance);
      if (!instance.pinned && !instance.hover && !instance.root.contains(document.activeElement)) {
        setOpen(instance, false);
      }
    });
    const target = state.lastFocused;
    state.lastFocused = null;
    state.panelAnchor = null;
    if (restoreFocus) {
      const instance = [...state.instances].find(item => item.root.contains(target));
      instance?.trigger.focus({ preventScroll: true });
    }
  }

  function handlePanelKeydown(event) {
    if (event.key === 'Escape') {
      event.preventDefault();
      closePanel();
    }
  }

  function panelEmpty(copy) {
    return '<div class="arrow-os-empty">' + copy + '</div>';
  }

  function renderPanel(name) {
    if (!state.panelBody) return;
    if (name === 'ravin') renderRavin();
    if (name === 'notes') renderNotes();
    if (name === 'tasks') renderTasks();
    if (name === 'calendar') renderCalendar();
    if (name === 'links') renderLinks();
    if (name === 'focus') renderFocus();
    if (name === 'appearance') { renderAppearance(); updateAppearanceState(); }
    if (name === 'settings') renderSettings();
    if (name === 'support') renderSupport();
    if (name === 'moderation') renderModeration();
  }

  async function staffRole() {
    const userId = currentArrowUserId();
    if (!userId) return 'user';
    const rows = await arrowData('/rest/v1/profiles?id=eq.' + encodeURIComponent(userId) + '&select=role,banned_at');
    return rows?.[0]?.banned_at ? 'user' : rows?.[0]?.role || 'user';
  }

  const rpc = (name, body) => arrowData('/rest/v1/rpc/' + name, { method: 'POST', body });

  async function renderSupport() {
    // eslint-disable-next-line @next/next/no-assign-module-variable -- Browser-only ARROW center identifier.
    const module = state.activeModule || 'orbit';
    state.panelBody.innerHTML = '<p class="arrow-os-panel-copy">Support for every ARROW location. Track replies and status here.</p>' +
      '<form class="arrow-os-form" id="arrow-support-form">' +
      '<label>Location<select name="module">' + [...VALID_MODULES].map(m => '<option ' + (m === module ? 'selected' : '') + '>' + m + '</option>').join('') + '</select></label>' +
      '<label>Request<select name="type"><option value="bug_report">Something is broken</option><option value="safety_report">Safety or abuse</option><option value="feature_request">Feature idea</option><option value="privacy_request">Privacy or data</option><option value="general_feedback">Other feedback</option></select></label>' +
      '<label>Subject<input name="subject" required minlength="3" maxlength="105" /></label>' +
      '<label>Details<textarea name="description" required minlength="10" maxlength="5000" rows="5" placeholder="What happened, and what did you expect?"></textarea></label>' +
      '<button type="submit">Send to ARROW support</button><p role="status" id="arrow-support-status"></p></form><div id="arrow-support-history"></div>';
    const form = state.panelBody.querySelector('form');
    const history = state.panelBody.querySelector('#arrow-support-history');
    const message = state.panelBody.querySelector('[role="status"]');
    async function loadHistory() {
      try {
        const rows = await arrowData('/rest/v1/staff_requests?requester_id=eq.' + encodeURIComponent(currentArrowUserId()) + '&select=id,subject,status,staff_note,created_at&order=created_at.desc&limit=12');
        if (!history.isConnected) return;
        history.innerHTML = '<h3>Your requests</h3>' + (rows.length ? rows.map(r => '<article class="arrow-os-support-row"><strong>' + escapeHtml(r.subject) + '</strong><span>' + escapeHtml(r.status) + ' · ' + escapeHtml(new Date(r.created_at).toLocaleDateString()) + '</span>' + (r.staff_note ? '<p>' + escapeHtml(r.staff_note) + '</p>' : '') + '</article>').join('') : panelEmpty('No requests yet.'));
      } catch (error) { if (history.isConnected) history.innerHTML = sharedDataError(error); }
    }
    form.addEventListener('submit', async event => {
      event.preventDefault();
      const data = new FormData(form); const button = form.querySelector('button'); button.disabled = true;
      message.textContent = 'Sending…';
      try {
        await rpc('submit_staff_request', { p_request_type: data.get('type'), p_subject: '[' + data.get('module') + '] ' + String(data.get('subject')).trim(), p_description: String(data.get('description')).trim(), p_requested_role: null, p_metadata: { source: 'arrow_support', module: data.get('module'), path: location.pathname, viewport: innerWidth + 'x' + innerHeight } });
        form.querySelector('[name="subject"]').value = ''; form.querySelector('textarea').value = '';
        message.textContent = 'Sent. Your request is in the ARROW staff queue.'; await loadHistory();
      } catch (error) { message.textContent = error.message || 'Could not send. Please retry.'; }
      finally { button.disabled = false; }
    });
    await loadHistory();
  }

  async function renderModeration() {
    state.panelBody.innerHTML = '<p class="arrow-os-loading">Verifying staff access…</p>';
    try {
      const role = await staffRole();
      if (state.activePanel !== 'moderation') return;
      if (!['moderator', 'admin', 'owner'].includes(role)) {
        state.panelBody.innerHTML = panelEmpty('Staff access is required. For help, open ARROW support.'); return;
      }
      state.panelBody.innerHTML = '<p class="arrow-os-panel-copy">ARROW staff · ' + escapeHtml(role) + '</p><div class="arrow-os-segmented"><button data-queue="requests">Support</button><button data-queue="email">Inbox</button><button data-queue="reports">Reports</button>' + (role !== 'moderator' ? '<button data-queue="users">Accounts</button>' : '') + (role === 'owner' ? '<button data-queue="overview">Overview</button><button data-queue="audit">Audit</button><button data-queue="beta">Beta access</button>' : '') + '</div><label class="arrow-os-form">Filter<input id="arrow-staff-search" type="search" placeholder="Search this queue" /></label><div id="arrow-staff-queue"></div>';
      const host = state.panelBody.querySelector('#arrow-staff-queue');
      const search = state.panelBody.querySelector('#arrow-staff-search');
      let active = 'requests'; let records = []; let offset = 0; let loadVersion = 0;
      const paging = document.createElement('div'); paging.className = 'arrow-staff-paging';
      const previous = document.createElement('button'); previous.textContent = 'Previous'; previous.type = 'button';
      const nextPage = document.createElement('button'); nextPage.textContent = 'Next'; nextPage.type = 'button';
      const pageLabel = document.createElement('span'); paging.append(previous,pageLabel,nextPage); host.after(paging);
      previous.onclick = () => load(active, Math.max(0, offset - 100)); nextPage.onclick = () => load(active, offset + 100);
      async function action(name, body, button) {
        button.disabled = true;
        try { await rpc(name, body); await load(active); }
        catch (error) { host.prepend(Object.assign(document.createElement('p'), { textContent: error.message, role: 'alert' })); }
        finally { button.disabled = false; }
      }
      function draw() {
        const query = search.value.toLowerCase();
        host.replaceChildren();
        const visible = records.filter(row => JSON.stringify(row).toLowerCase().includes(query));
        if (!visible.length) host.innerHTML = panelEmpty('No matching items.');
        visible.forEach(row => {
          const article = document.createElement('article'); article.className = 'arrow-os-support-row';
          const title = document.createElement('strong');
          title.textContent = row.subject || row.reason || row.action || row.display_name || row.email || 'Account'; article.append(title);
          const detail = document.createElement('p');
          detail.textContent = active === 'users' ? [row.email, row.role, row.banned_at ? 'Banned' : 'Active'].filter(Boolean).join(' · ') : [row.metadata?.module || (active === 'reports' ? 'relay' : 'arrow'), row.status, row.description || row.details].filter(Boolean).join(' · '); article.append(detail);
          if (active === 'email') {
            const open=document.createElement('button');open.type='button';open.textContent='Open thread';article.append(open);
            open.onclick=async()=>{open.disabled=true;try{const messages=await arrowData('/rest/v1/support_email_messages?thread_id=eq.'+encodeURIComponent(row.id)+'&select=id,direction,from_email,text_body,created_at&order=created_at.asc&limit=200');const thread=document.createElement('section');thread.className='arrow-staff-thread';for(const message of messages){const copy=document.createElement('p');copy.style.whiteSpace='pre-wrap';copy.textContent=(message.direction==='outbound'?'Support':message.from_email)+' · '+new Date(message.created_at).toLocaleString()+'\n'+(message.text_body||'(No text body)');thread.append(copy);}
              if(role!=='moderator'){const reply=document.createElement('textarea');reply.placeholder='Reply to '+row.sender_email;reply.maxLength=10000;thread.append(reply);const send=document.createElement('button');send.type='button';send.textContent='Send reply';send.onclick=async()=>{if(!reply.value.trim()||!confirm('Send this reply to '+row.sender_email+'?'))return;send.disabled=true;try{await arrowData('/functions/v1/support-email',{method:'POST',body:{action:'reply',threadId:row.id,text:reply.value.trim()}});reply.value='';await load('email',offset);}catch(error){thread.append(Object.assign(document.createElement('p'),{textContent:error.message}));}finally{send.disabled=false;}};thread.append(send);
              const status=document.createElement('select');for(const value of ['new','open','pending','closed']){const option=document.createElement('option');option.value=value;option.textContent=value;option.selected=value===row.status;status.append(option);}thread.append(status);const save=document.createElement('button');save.textContent='Save status';save.onclick=()=>action('staff_update_support_thread',{p_thread_id:row.id,p_status:status.value,p_assigned_to:null},save);thread.append(save);}
              article.append(thread);open.remove();}catch(error){article.append(Object.assign(document.createElement('p'),{textContent:error.message}));open.disabled=false;}};
          } else if (active === 'audit') {
            const info = document.createElement('p'); info.textContent = [row.actor_name || row.actor_email, row.target_name || row.target_email, new Date(row.created_at).toLocaleString()].filter(Boolean).join(' · ');article.append(info);
            const details = document.createElement('details');const summary = document.createElement('summary');summary.textContent='Action details';const copy=document.createElement('pre');copy.textContent=JSON.stringify(row.metadata||{},null,2);details.append(summary,copy);article.append(details);
          } else if (active === 'beta') {
            const info=document.createElement('p');info.textContent=[row.primary_email,row.request_status,row.request_message].filter(Boolean).join(' · ');article.append(info);
            if(row.request_status==='pending'){const reply=document.createElement('textarea');reply.placeholder='Response to applicant';reply.maxLength=1000;article.append(reply);
              for(const approved of [true,false]){const review=document.createElement('button');review.type='button';review.textContent=approved?'Approve access':'Decline';review.onclick=()=>{if(!reply.value.trim()){reply.focus();return;}void action('owner_review_beta_request',{p_request_id:row.request_id,p_approve:approved,p_message:reply.value.trim()},review);};article.append(review);}
            }
          } else if (active !== 'users') {
            const note = document.createElement('textarea'); note.rows = 2; note.placeholder = 'Staff note'; note.maxLength = 2000; note.value = row.staff_note || row.moderation_note || ''; article.append(note);
            const select = document.createElement('select');
            (active === 'requests' ? ['new','reviewing','resolved','dismissed'] : ['submitted','reviewing','resolved','dismissed']).forEach(status => { const option = document.createElement('option'); option.value = status; option.textContent = status; option.selected = status === row.status; select.append(option); }); article.append(select);
            const save = document.createElement('button'); save.textContent = 'Save status'; save.type = 'button'; article.append(save);
            if(active==='requests'&&role==='owner'&&row.request_type==='role_application'&&row.status!=='resolved'){const approve=document.createElement('button');approve.type='button';approve.textContent='Approve staff application';approve.onclick=()=>{if(!confirm('Approve this staff role application?'))return;void action('owner_approve_role_request',{p_request_id:row.request_id,p_note:note.value},approve);};article.append(approve);}
            save.onclick = () => action(active === 'requests' ? 'staff_update_request_status' : 'staff_update_report_status', active === 'requests' ? { p_request_id: row.request_id, p_status: select.value, p_note: note.value } : { p_report_id: row.report_id, p_status: select.value, p_note: note.value }, save);
          } else if (role === 'owner') {
            const inspect = document.createElement('button');inspect.type='button';inspect.textContent='Inspect account';article.append(inspect);
            inspect.onclick=async()=>{inspect.disabled=true;try{const result=await rpc('owner_user_inspector',{p_user_id:row.id});const details=document.createElement('details');details.open=true;const summary=document.createElement('summary');summary.textContent='Account details';details.append(summary);const renderValue=(host,label,value)=>{const section=document.createElement('section');const heading=document.createElement('h4');heading.textContent=label.replaceAll('_',' ');section.append(heading);if(value&&typeof value==='object'){for(const [key,item] of Object.entries(value)){if(item&&typeof item==='object'){renderValue(section,key,item);}else{const line=document.createElement('p');line.textContent=key.replaceAll('_',' ')+': '+String(item??'—');section.append(line);}}}else{const line=document.createElement('p');line.textContent=String(value??'—');section.append(line);}host.append(section);};for(const [label,value] of Object.entries(result||{}))renderValue(details,label,value);article.append(details);}catch(error){article.append(Object.assign(document.createElement('p'),{textContent:error.message}));}finally{inspect.disabled=false;}};
            const ban = document.createElement('button'); ban.type = 'button'; ban.textContent = row.banned_at ? 'Restore account' : 'Suspend account'; article.append(ban);
            ban.onclick = () => { const reason = prompt('Reason for this ARROW account action:'); if (reason === null || !reason.trim()) return; if (!confirm(ban.textContent + ' for ' + title.textContent + '?')) return; void action('owner_set_user_ban', {p_user_id:row.id, p_banned:!row.banned_at, p_reason:reason}, ban); };
            const roleSelect = document.createElement('select');
            ['user','moderator','admin','owner'].forEach(value => { const option = document.createElement('option'); option.value = value; option.textContent = value; option.selected = value === row.role; roleSelect.append(option); }); article.append(roleSelect);
            const changeRole = document.createElement('button'); changeRole.type = 'button'; changeRole.textContent = 'Update role'; article.append(changeRole);
            changeRole.onclick = () => { if (roleSelect.value === row.role || !confirm('Change ' + title.textContent + ' to ' + roleSelect.value + '?')) return; void action('set_user_role', {p_user_id:row.id,p_role:roleSelect.value},changeRole); };
            const ownerNote=document.createElement('textarea');ownerNote.placeholder='Private owner note';ownerNote.maxLength=4000;ownerNote.setAttribute('aria-label','Private owner note');article.append(ownerNote);
            const addNote=document.createElement('button');addNote.type='button';addNote.textContent='Save owner note';addNote.onclick=()=>{if(ownerNote.value.trim())void action('owner_add_user_note',{p_user_id:row.id,p_note:ownerNote.value.trim()},addNote);};article.append(addNote);
            const revokeBeta=document.createElement('button');revokeBeta.type='button';revokeBeta.textContent='Revoke beta access';revokeBeta.onclick=()=>{if(confirm('Revoke beta access for '+title.textContent+'?'))void action('owner_revoke_beta_access',{p_user_id:row.id,p_message:null},revokeBeta);};article.append(revokeBeta);
            const deleteAccount=document.createElement('button');deleteAccount.type='button';deleteAccount.textContent='Delete account';deleteAccount.onclick=()=>{if(prompt('Permanently delete '+title.textContent+' and their data? Type DELETE to confirm.')==='DELETE')void action('owner_delete_user',{p_user_id:row.id},deleteAccount);};article.append(deleteAccount);
            const signOut = document.createElement('button'); signOut.type = 'button'; signOut.textContent = 'Revoke sessions'; article.append(signOut);
            signOut.onclick = () => { if (!confirm('Sign out all sessions for ' + title.textContent + '?')) return; void action('owner_force_sign_out',{p_user_id:row.id},signOut); };

          }
          host.append(article);
        });
      }
      async function load(queue, nextOffset = 0) {
        const version = ++loadVersion; offset = nextOffset; active = queue; host.textContent = 'Loading…';
        try {
          if(queue==='overview'){paging.hidden=true;const [stats,storage]=await Promise.all([rpc('owner_dashboard_stats',{}),rpc('owner_storage_overview',{})]);if(version!==loadVersion)return;host.replaceChildren();for(const [label,value] of [['Accounts and activity',stats],['Storage',storage]]){const card=document.createElement('section');card.className='arrow-os-support-row';const heading=document.createElement('h3');heading.textContent=label;card.append(heading);for(const [key,amount] of Object.entries(value||{})){const line=document.createElement('p');line.textContent=key.replaceAll('_',' ')+': '+(typeof amount==='object'?JSON.stringify(amount):String(amount));card.append(line);}host.append(card);}return;}
          paging.hidden=false;
          const result = queue==='email'?await arrowData('/rest/v1/support_email_threads?select=id,sender_email,sender_name,subject,status,latest_message_at&order=latest_message_at.desc&limit=100&offset='+nextOffset):await rpc(queue === 'requests' ? 'staff_list_requests' : queue === 'reports' ? 'staff_list_reports' : queue==='audit'?'owner_list_audit_log':queue==='beta'?'owner_list_beta_requests':'admin_list_users_v2', { ...(['requests','reports','beta'].includes(queue) ? { p_status: null } : {}), p_limit: 100, p_offset: nextOffset }) || [];
          if (version !== loadVersion) return;
          records = result;
          previous.disabled = nextOffset === 0; nextPage.disabled = records.length < 100; pageLabel.textContent = 'Page ' + (Math.floor(nextOffset / 100) + 1);
          if (host.isConnected) draw();
        } catch (error) { if (host.isConnected) host.innerHTML = sharedDataError(error); }
      }
      search.oninput = draw;
      state.panelBody.querySelectorAll('[data-queue]').forEach(button => button.onclick = () => load(button.dataset.queue));
      const requested=new URLSearchParams(location.search).get('queue');
      const allowed=['requests','reports','email',...(role!=='moderator'?['users']:[]),...(role==='owner'?['overview','audit','beta']:[])];
      await load(allowed.includes(requested)?requested:'requests');
    } catch (error) { if (state.activePanel === 'moderation') state.panelBody.innerHTML = sharedDataError(error); }
  }

  async function nextMove() {
    if(BETA_BASE){
      const [tasks,events,plans]=await Promise.all([
        arrowData('/rest/v1/todos?select=id,title,due_on,completed,position,scheduled_on,scheduled_start&limit=500'),
        arrowData('/rest/v1/relay_calendar_events?select=id,title,event_date,start_time,end_time,source_key&limit=500'),
        arrowData('/rest/v1/waypoint_items?status=eq.active&select=id,title,source_key,due_date,due_time,depends_on,why,status&limit=100')
      ]);
      const {planningCandidates}=await import(BETA_BASE+'/next-move.js?v=beta-repair-1');
      const candidates=planningCandidates({tasks,events,plans,timezone:Intl.DateTimeFormat().resolvedOptions().timeZone});
      return {next:candidates[0]||null,source:'calendar',generated_at:new Date().toISOString()};
    }
    const session = readArrowSession();
    if (!session) throw new Error('Sign in to see what is next.');
    const fresh = session.expires_at * 1000 < Date.now() + 30000 ? await refreshArrowSession(session) || session : session;
    const response = await fetch('/ravin/api/arrow/next', { method: 'POST', headers: { Authorization: 'Bearer ' + fresh.access_token, 'content-type': 'application/json' }, body: JSON.stringify({ timezone: Intl.DateTimeFormat().resolvedOptions().timeZone }), signal: AbortSignal.timeout(25000) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'RAVIN could not load your next move.');
    return result;
  }

  async function previewPlan(start,end){
    if(!BETA_BASE)throw new Error('This preview is available in ARROW Beta.');
    const [tasks,events]=await Promise.all([
      arrowData('/rest/v1/todos?select=id,title,due_on,completed,position,estimated_minutes,scheduled_on,scheduled_start&limit=500'),
      arrowData('/rest/v1/relay_calendar_events?select=id,title,event_date,start_time,end_time,is_all_day,source_key&limit=500')
    ]);
    const {buildSchedule}=await import(BETA_BASE+'/autoPlanner.js?v=beta-repair-1');
    return {...buildSchedule({tasks,events,start,end,timezone:Intl.DateTimeFormat().resolvedOptions().timeZone}),source:'calendar',can_apply:false};
  }

  function moduleRavinProfile(module) {
    const profiles = {
      orbit: {
        line: 'RAVIN sees the whole ARROW system from here.',
        prompts: ['What needs my attention across ARROW?', 'Find the most connected thing in my Field', 'Where should I go next?'],
      },
      relay: {
        line: 'RAVIN can use your shared notes, tasks, calendar, and Field context without reading private Relay chats by default.',
        prompts: ['What should I follow up on today?', 'Turn my current notes into next actions', 'What do I have coming up?'],
      },
      waypoint: {
        line: 'RAVIN is in planning mode here: tasks, calendar, notes, plans, and direction.',
        prompts: ['What is my best next move?', 'Help me organize what I need to do today', 'What am I forgetting this week?'],
      },
      atlas: {
        line: 'RAVIN is in retrieval mode here: find, connect, and explain the knowledge in your Field.',
        prompts: ['Find everything related to my current project', 'What connects these ideas?', 'Summarize my most relevant recent knowledge'],
      },
      ravin: {
        line: 'Full RAVIN workspace. Ask across every RAVIN-readable part of ARROW.',
        prompts: ['What changed across ARROW recently?', 'Pull together my current priorities', 'Search my Field for something useful'],
      },
    };
    return profiles[module] || profiles.orbit;
  }

  function ravinUrl(prompt = '') {
    const url = new URL(RAVIN_URL, location.href);
    const surface = state.activeModule || 'orbit';
    url.searchParams.set('from', surface);
    url.searchParams.set('surface', surface);
    if (prompt) url.searchParams.set('prompt', prompt);
    return url;
  }

  function renderRavin() {
    // eslint-disable-next-line @next/next/no-assign-module-variable -- Browser-only ARROW center identifier.
    const module = state.activeModule || 'orbit';
    const profile = moduleRavinProfile(module);
    state.panelBody.innerHTML =
      '<div class="arrow-os-ravin-card">' +
        '<div class="arrow-os-ravin-core" aria-hidden="true"></div>' +
        '<div><span>RAVIN · ' + escapeHtml(module.toUpperCase()) + '</span><p>' + escapeHtml(profile.line) + '</p></div>' +
      '</div>' +
      '<div class="arrow-os-ravin-prompts">' +
        profile.prompts.map(prompt => '<button type="button" data-ravin-prompt="' + escapeAttr(prompt) + '">' + escapeHtml(prompt) + '</button>').join('') +
      '</div>' +
      '<form class="arrow-os-ravin-form">' +
        '<input type="text" maxlength="500" placeholder="Ask RAVIN from ' + escapeAttr(module) + '..." aria-label="Ask RAVIN" />' +
        '<button type="submit">Ask ↗</button>' +
      '</form>' +
      '<div class="arrow-os-panel-foot"><span>Context follows you into RAVIN.</span><a href="' + escapeAttr(ravinUrl().toString()) + '">Open full RAVIN ↗</a></div>';

    state.panelBody.querySelectorAll('[data-ravin-prompt]').forEach(button => {
      button.addEventListener('click', () => location.assign(ravinUrl(button.dataset.ravinPrompt).toString()));
    });
    state.panelBody.querySelector('.arrow-os-ravin-form')?.addEventListener('submit', event => {
      event.preventDefault();
      const value = event.currentTarget.querySelector('input')?.value?.trim();
      location.assign(ravinUrl(value || '').toString());
    });
  }

  async function renderNotes() {
    state.panelBody.innerHTML = '<div class="arrow-os-loading">Loading shared notes…</div>';
    try {
      const notes = await arrowData('/rest/v1/notes?select=id,title,content,is_pinned,updated_at&order=is_pinned.desc,updated_at.desc&limit=12');
      if (state.activePanel !== 'notes') return;
      state.panelBody.innerHTML =
        '<div class="arrow-os-owner-note"><span>ONE NOTES LIBRARY</span><p>Relay edits the same notes that Field indexes and RAVIN can read.</p><a href="' + escapeAttr(new URL('notes', new URL(RELAY_URL, location.href)).toString()) + '">Open full Notes ↗</a></div>' +
        '<form class="arrow-os-note-form">' +
          '<textarea rows="4" maxlength="4000" placeholder="Quick note — this saves to your shared ARROW notes…" aria-label="Quick note"></textarea>' +
          '<button type="submit">Save shared note</button>' +
        '</form>' +
        '<div class="arrow-os-list">' +
          (notes?.length ? notes.map(note => {
            const blocks = Array.isArray(note.content) ? note.content : [];
            const snippet = blocks.map(block => typeof block?.text === 'string' ? block.text.trim() : '').filter(Boolean).slice(0, 2).join(' · ');
            return '<div class="arrow-os-list-row arrow-os-note-row"><div><strong>' + escapeHtml(note.title || 'Untitled') + '</strong><span>' + escapeHtml(snippet || 'Empty note') + '</span></div></div>';
          }).join('') : panelEmpty('No notes yet.')) +
        '</div>';

      state.panelBody.querySelector('.arrow-os-note-form')?.addEventListener('submit', async event => {
        event.preventDefault();
        const area = event.currentTarget.querySelector('textarea');
        const value = area?.value?.trim();
        const userId = currentArrowUserId();
        if (!value || !userId) return;
        const title = value.split(/\n/)[0].slice(0, 80) || 'Quick note';
        event.currentTarget.querySelector('button').disabled = true;
        try {
          await arrowData('/rest/v1/notes', {
            method: 'POST',
            headers: { Prefer: 'return=minimal' },
            body: { user_id: userId, title, content: [{ id: id(), type: 'paragraph', text: value }], is_pinned: false },
          });
          renderNotes();
        } catch (error) {
          state.panelBody.innerHTML = sharedDataError(error);
        }
      });
    } catch (error) {
      if (state.activePanel === 'notes') state.panelBody.innerHTML = sharedDataError(error);
    }
  }

  function ownerNote(tab, copy) {
    const url = new URL(WAYPOINT_URL, location.href);
    url.searchParams.set('from', state.activeModule || 'orbit');
    url.searchParams.set('tab', tab);
    return '<div class="arrow-os-owner-note"><span>WAYPOINT</span><p>' + copy + '</p><a href="' + escapeAttr(url.toString()) + '">Open Waypoint ↗</a></div>';
  }

  async function renderTasks() {
    state.panelBody.innerHTML = '<div class="arrow-os-loading">Loading shared tasks…</div>';
    try {
      const tasks = await arrowData('/rest/v1/todos?select=id,title,due_on,completed,position,created_at&order=completed.asc,due_on.asc,position.asc,created_at.asc&limit=80');
      if (state.activePanel !== 'tasks') return;
      state.panelBody.innerHTML =
        ownerNote('today', 'Waypoint is the planning view. Relay and RAVIN use this exact same task data.') +
        '<form class="arrow-os-inline-form arrow-os-task-form">' +
          '<input type="text" maxlength="120" placeholder="Add a task…" aria-label="Task name" required />' +
          '<input type="date" aria-label="Due date" required />' +
          '<button type="submit" aria-label="Add task">' + icon('plus') + '</button>' +
        '</form>' +
        '<div class="arrow-os-list">' +
          (tasks?.length ? tasks.map(task =>
            '<div class="arrow-os-list-row ' + (task.completed ? 'is-done' : '') + '" data-id="' + escapeAttr(task.id) + '">' +
              '<label><input type="checkbox" ' + (task.completed ? 'checked' : '') + ' /><span>' + escapeHtml(task.title) + '<small>' + escapeHtml(task.due_on || '') + '</small></span></label>' +
              '<button type="button" class="arrow-os-row-delete" aria-label="Delete task">' + icon('trash') + '</button>' +
            '</div>'
          ).join('') : panelEmpty('No tasks yet.')) +
        '</div>';

      const form = state.panelBody.querySelector('.arrow-os-task-form');
      form.querySelector('input[type="date"]').value = localDateInputValue();
      form.addEventListener('submit', async event => {
        event.preventDefault();
        const [titleInput, dateInput] = form.querySelectorAll('input');
        const userId = currentArrowUserId();
        const title = titleInput.value.trim();
        if (!title || !dateInput.value || !userId) return;
        await arrowData('/rest/v1/todos', {
          method: 'POST',
          headers: { Prefer: 'return=minimal' },
          body: { user_id: userId, title, due_on: dateInput.value },
        });
        renderTasks();
      });

      state.panelBody.querySelectorAll('.arrow-os-list-row').forEach(row => {
        row.querySelector('input')?.addEventListener('change', async event => {
          await arrowData('/rest/v1/todos?id=eq.' + encodeURIComponent(row.dataset.id), {
            method: 'PATCH',
            headers: { Prefer: 'return=minimal' },
            body: { completed: event.target.checked },
          });
          renderTasks();
        });
        row.querySelector('.arrow-os-row-delete')?.addEventListener('click', async () => {
          await arrowData('/rest/v1/todos?id=eq.' + encodeURIComponent(row.dataset.id), { method: 'DELETE' });
          renderTasks();
        });
      });
    } catch (error) {
      if (state.activePanel === 'tasks') state.panelBody.innerHTML = sharedDataError(error);
    }
  }

  async function renderCalendar() {
    state.panelBody.innerHTML = '<div class="arrow-os-loading">Loading shared calendar…</div>';
    try {
      const events = await arrowData('/rest/v1/relay_calendar_events?select=id,title,event_date,is_all_day,start_time,end_time,details&order=event_date.asc,start_time.asc&limit=80');
      if (state.activePanel !== 'calendar') return;
      state.panelBody.innerHTML =
        ownerNote('calendar', 'Waypoint is the planning view. This panel writes to the same calendar events Relay and RAVIN use.') +
        '<form class="arrow-os-calendar-form">' +
          '<input type="text" maxlength="100" placeholder="Event title" aria-label="Event title" required />' +
          '<div class="arrow-os-form-grid">' +
            '<input type="date" aria-label="Event date" required />' +
            '<input type="time" aria-label="Event time" />' +
          '</div>' +
          '<button type="submit">Add shared event</button>' +
        '</form>' +
        '<div class="arrow-os-list arrow-os-events">' +
          (events?.length ? events.map(item =>
            '<div class="arrow-os-list-row" data-id="' + escapeAttr(item.id) + '">' +
              '<div><strong>' + escapeHtml(item.title) + '</strong><span>' + escapeHtml(formatEventDate(item.event_date, item.start_time?.slice(0, 5) || '')) + '</span></div>' +
              '<button type="button" class="arrow-os-row-delete" aria-label="Delete event">' + icon('trash') + '</button>' +
            '</div>'
          ).join('') : panelEmpty('No ARROW events yet.')) +
        '</div>';

      const form = state.panelBody.querySelector('.arrow-os-calendar-form');
      form.querySelector('input[type="date"]').value = localDateInputValue();
      form.addEventListener('submit', async event => {
        event.preventDefault();
        const [titleInput, dateInput, timeInput] = form.querySelectorAll('input');
        const userId = currentArrowUserId();
        const title = titleInput.value.trim();
        if (!title || !dateInput.value || !userId) return;
        await arrowData('/rest/v1/relay_calendar_events', {
          method: 'POST',
          headers: { Prefer: 'return=minimal' },
          body: { user_id: userId, title, event_date: dateInput.value, is_all_day: !timeInput.value, start_time: timeInput.value || null },
        });
        renderCalendar();
      });

      state.panelBody.querySelectorAll('.arrow-os-events .arrow-os-list-row').forEach(row => {
        row.querySelector('.arrow-os-row-delete')?.addEventListener('click', async () => {
          await arrowData('/rest/v1/relay_calendar_events?id=eq.' + encodeURIComponent(row.dataset.id), { method: 'DELETE' });
          renderCalendar();
        });
      });
    } catch (error) {
      if (state.activePanel === 'calendar') state.panelBody.innerHTML = sharedDataError(error);
    }
  }

  function renderLinks() {
    const rawLinks = readJson(STORAGE.links, []);
    const links = Array.isArray(rawLinks)
      ? rawLinks
          .filter(item => item && typeof item.id === 'string' && typeof item.label === 'string' && typeof item.url === 'string')
          .map(item => ({ ...item, url: normalizeUrl(item.url) }))
          .filter(item => item.url)
          .slice(0, 500)
      : [];
    state.panelBody.innerHTML =
      '<form class="arrow-os-link-form">' +
        '<input type="text" maxlength="70" placeholder="Name" aria-label="Link name" required />' +
        '<input type="url" placeholder="https://..." aria-label="Link URL" required />' +
        '<button type="submit">Add link</button>' +
      '</form>' +
      '<div class="arrow-os-list arrow-os-links">' +
        (links.length ? links.map(item =>
          '<div class="arrow-os-list-row" data-id="' + escapeAttr(item.id) + '">' +
            '<a href="' + escapeAttr(item.url) + '" target="_blank" rel="noopener noreferrer"><strong>' + escapeHtml(item.label) + '</strong><span>' + escapeHtml(shortHost(item.url)) + '</span></a>' +
            '<button type="button" class="arrow-os-row-delete" aria-label="Delete link">' + icon('trash') + '</button>' +
          '</div>'
        ).join('') : panelEmpty('No saved links yet.')) +
      '</div>';

    state.panelBody.querySelector('.arrow-os-link-form').addEventListener('submit', event => {
      event.preventDefault();
      const [nameInput, urlInput] = event.currentTarget.querySelectorAll('input');
      const label = nameInput.value.trim();
      const url = normalizeUrl(urlInput.value.trim());
      if (!label || !url) return;
      writeJson(STORAGE.links, [{ id: id(), label, url, createdAt: Date.now() }, ...links]);
      renderLinks();
    });

    state.panelBody.querySelectorAll('.arrow-os-links .arrow-os-list-row').forEach(row => {
      row.querySelector('.arrow-os-row-delete').addEventListener('click', () => {
        writeJson(STORAGE.links, links.filter(item => item.id !== row.dataset.id));
        renderLinks();
      });
    });
  }

  function localDateInputValue(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return year + '-' + month + '-' + day;
  }

  function focusMinutes() {
    const value = Number(readString(STORAGE.focusMinutes, '25'));
    return [15, 25, 45, 60].includes(value) ? value : 25;
  }

  function saveFocusState() {
    if (state.focusRunning) {
      const elapsed = Math.max(0, Math.floor((Date.now() - state.focusUpdatedAt) / 1000));
      state.focusRemaining = Math.max(0, state.focusRemaining - elapsed);
      state.focusUpdatedAt += elapsed * 1000;
    }
    writeJson(STORAGE.focusState, {
      remaining: Math.max(0, Math.floor(state.focusRemaining)),
      running: Boolean(state.focusRunning),
      updatedAt: Date.now(),
    });
  }

  function restoreFocusState() {
    const saved = readJson(STORAGE.focusState, null);
    if (!saved || typeof saved !== 'object') {
      state.focusRemaining = focusMinutes() * 60;
      state.focusRunning = false;
      state.focusUpdatedAt = Date.now();
      return;
    }

    const baseRemaining = Number(saved.remaining);
    state.focusRemaining = Number.isFinite(baseRemaining) && baseRemaining >= 0
      ? baseRemaining
      : focusMinutes() * 60;
    state.focusRunning = Boolean(saved.running) && state.focusRemaining > 0;
    const savedAt = Number(saved.updatedAt) || Date.now();

    if (state.focusRunning) {
      const elapsed = Math.max(0, Math.floor((Date.now() - savedAt) / 1000));
      state.focusRemaining = Math.max(0, state.focusRemaining - elapsed);
      if (state.focusRemaining <= 0) state.focusRunning = false;
    }

    state.focusUpdatedAt = Date.now();
    if (state.focusRunning) beginFocusInterval();
  }

  function resetFocus(minutes = focusMinutes()) {
    stopFocusTimer(false);
    state.focusRemaining = minutes * 60;
    state.focusUpdatedAt = Date.now();
    saveFocusState();
    renderFocus();
  }

  function beginFocusInterval() {
    clearInterval(state.focusTimer);
    state.focusTimer = setInterval(() => {
      const elapsed = Math.floor((Date.now() - state.focusUpdatedAt) / 1000);
      if (elapsed <= 0) return;
      state.focusUpdatedAt += elapsed * 1000;
      state.focusRemaining = Math.max(0, state.focusRemaining - elapsed);
      updateFocusDisplay();
      if (state.focusRemaining <= 0) {
        stopFocusTimer(true);
        if (state.activePanel === 'focus') renderFocus();
        const previousTitle = document.title;
        document.title = 'Focus complete · ARROW';
        setTimeout(() => {
          if (document.title === 'Focus complete · ARROW') document.title = previousTitle;
        }, 4000);
      }
    }, 250);
  }

  function startFocusTimer() {
    if (state.focusRunning) return;
    if (state.focusRemaining <= 0) state.focusRemaining = focusMinutes() * 60;
    state.focusRunning = true;
    state.focusUpdatedAt = Date.now();
    beginFocusInterval();
    saveFocusState();
    renderFocus();
  }

  function stopFocusTimer(save = true) {
    if (save && state.focusRunning) {
      const elapsed = Math.max(0, Math.floor((Date.now() - state.focusUpdatedAt) / 1000));
      state.focusRemaining = Math.max(0, state.focusRemaining - elapsed);
    }
    state.focusRunning = false;
    clearInterval(state.focusTimer);
    state.focusTimer = null;
    state.focusUpdatedAt = Date.now();
    if (save) saveFocusState();
  }

  function formatTime(seconds) {
    const min = Math.floor(seconds / 60).toString().padStart(2, '0');
    const sec = Math.floor(seconds % 60).toString().padStart(2, '0');
    return min + ':' + sec;
  }

  function updateFocusDisplay() {
    const display = state.panelBody?.querySelector('.arrow-os-focus-time');
    if (display) display.textContent = formatTime(state.focusRemaining);
  }

  function renderFocus() {
    if (!state.focusRunning && state.focusUpdatedAt === 0) {
      state.focusRemaining = focusMinutes() * 60;
      state.focusUpdatedAt = Date.now();
    }

    state.panelBody.innerHTML =
      '<div class="arrow-os-focus">' +
        '<span class="arrow-os-focus-label">FOCUS TIMER</span>' +
        '<strong class="arrow-os-focus-time">' + formatTime(state.focusRemaining) + '</strong>' +
        '<div class="arrow-os-focus-actions">' +
          '<button type="button" data-focus-action="toggle">' + (state.focusRunning ? icon('pause') + 'Pause' : icon('play') + 'Start') + '</button>' +
          '<button type="button" data-focus-action="reset">' + icon('reset') + 'Reset</button>' +
        '</div>' +
        '<div class="arrow-os-presets">' +
          [15,25,45,60].map(value => '<button type="button" data-focus-minutes="' + value + '" class="' + (focusMinutes() === value ? 'is-active' : '') + '">' + value + ' min</button>').join('') +
        '</div>' +
      '</div>';

    state.panelBody.querySelector('[data-focus-action="toggle"]').addEventListener('click', () => {
      if (state.focusRunning) {
        stopFocusTimer(true);
        renderFocus();
      } else {
        startFocusTimer();
      }
    });
    state.panelBody.querySelector('[data-focus-action="reset"]').addEventListener('click', () => resetFocus());
    state.panelBody.querySelectorAll('[data-focus-minutes]').forEach(button => {
      button.addEventListener('click', () => {
        const value = Number(button.dataset.focusMinutes);
        writeString(STORAGE.focusMinutes, String(value));
        resetFocus(value);
      });
    });
  }

  function updateAppearanceState() {
    if (!state.panelBody) return;
    const choices = {
      theme: getThemeChoice(), motion: getMotionChoice(),
      experience: getExperienceChoice(), accent: readString(STORAGE.accent, 'mono'),
    };
    Object.entries(choices).forEach(([kind, value]) => {
      state.panelBody.querySelectorAll('[data-' + kind + '-choice]').forEach(button => {
        const selected = button.getAttribute('data-' + kind + '-choice') === value;
        button.classList.toggle('is-active', selected);
        button.setAttribute('aria-pressed', String(selected));
      });
    });
  }

  function renderAppearance() {
    const theme = getThemeChoice();
    const motion = getMotionChoice();
    const accent = readString(STORAGE.accent, 'mono');
    const experience = getExperienceChoice();

    state.panelBody.innerHTML =
      '<div class="arrow-os-section">' +
        '<span class="arrow-os-section-label">EXPERIENCE</span>' +
        '<div class="arrow-os-segmented arrow-os-experience-grid">' +
          [['balanced','Balanced'],['quiet','Quiet'],['dynamic','Dynamic'],['glass','Glass']].map(([value,label]) => '<button type="button" data-experience-choice="' + value + '" class="' + (experience === value ? 'is-active' : '') + '">' + label + '</button>').join('') +
        '</div>' +
      '</div>' +
      '<div class="arrow-os-section">' +
        '<span class="arrow-os-section-label">THEME</span>' +
        '<div class="arrow-os-segmented">' +
          ['system','light','dark'].map(value => '<button type="button" data-theme-choice="' + value + '" class="' + (theme === value ? 'is-active' : '') + '">' + capitalize(value) + '</button>').join('') +
        '</div>' +
      '</div>' +
      '<div class="arrow-os-section">' +
        '<span class="arrow-os-section-label">MOTION</span>' +
        '<div class="arrow-os-segmented">' +
          [['system','System'],['full','Full'],['reduce','Reduced']].map(([value,label]) => '<button type="button" data-motion-choice="' + value + '" class="' + (motion === value ? 'is-active' : '') + '">' + label + '</button>').join('') +
        '</div>' +
      '</div>' +
      '<div class="arrow-os-section">' +
        '<span class="arrow-os-section-label">ACCENT</span>' +
        '<div class="arrow-os-accents">' +
          ACCENTS.map(([value,label,color]) =>
            '<button type="button" data-accent-choice="' + value + '" class="' + (accent === value ? 'is-active' : '') + '">' +
              '<i style="--swatch:' + color + '"></i><span>' + label + '</span>' +
            '</button>'
          ).join('') +
        '</div>' +
      '</div>';

    state.panelBody.querySelectorAll('[data-experience-choice]').forEach(button => {
      button.addEventListener('click', () => applyExperienceChoice(button.dataset.experienceChoice, true));
    });
    state.panelBody.querySelectorAll('[data-theme-choice]').forEach(button => {
      button.addEventListener('click', () => applyTheme(button.dataset.themeChoice, true));
    });
    state.panelBody.querySelectorAll('[data-motion-choice]').forEach(button => {
      button.addEventListener('click', () => applyMotion(button.dataset.motionChoice, true));
    });
    state.panelBody.querySelectorAll('[data-accent-choice]').forEach(button => {
      button.addEventListener('click', () => {
        applyAccent(button.dataset.accentChoice, true);
      });
    });
  }

  function renderSettings() {
    const asArray = value => Array.isArray(value) ? value : [];
    const tasks = asArray(readJson(STORAGE.tasks, []));
    const events = asArray(readJson(STORAGE.events, []));
    const links = asArray(readJson(STORAGE.links, []));
    const notesLength = readString(STORAGE.notes, '').length;

    state.panelBody.innerHTML =
      '<div class="arrow-os-settings-card">' +
        '<span>ARROW local data</span>' +
        '<strong>' + tasks.length + ' tasks · ' + events.length + ' events · ' + links.length + ' links</strong>' +
        '<small>' + notesLength + ' note characters. Browser-synced across ARROW centers on this device. Account cloud sync is not connected yet.</small>' +
      '</div>' +
      '<div class="arrow-os-settings-actions">' +
        '<button type="button" data-settings-action="intro">Replay Orbit intro</button>' +
        '<button type="button" data-settings-action="export">Export ARROW data</button>' +
        '<label class="arrow-os-import">Import ARROW data<input type="file" accept="application/json" data-settings-action="import" /></label>' +
        (SIGNOUT_URL ? '<button type="button" class="is-danger" data-settings-action="signout">Sign out of ARROW</button>' : '') +
        '<button type="button" class="is-danger" data-settings-action="reset">Reset ARROW data</button>' +
      '</div>';

    state.panelBody.querySelector('[data-settings-action="intro"]').addEventListener('click', () => {
      const url = new URL(ORBIT_URL);
      url.searchParams.set('intro', '1');
      location.assign(url.toString());
    });
    state.panelBody.querySelector('[data-settings-action="export"]').addEventListener('click', exportData);
    state.panelBody.querySelector('[data-settings-action="import"]').addEventListener('change', importData);
    const signoutButton = state.panelBody.querySelector('[data-settings-action="signout"]');
    signoutButton?.addEventListener('click', () => {
      location.assign(SIGNOUT_URL);
    });

    state.panelBody.querySelector('[data-settings-action="reset"]').addEventListener('click', () => {
      if (!confirm('Reset ARROW notes, tasks, calendar events, links, appearance, and focus settings in this browser?')) return;
      Object.values(STORAGE).forEach(key => {
        try { localStorage.removeItem(key); } catch {}
      });
      applyTheme('system', false);
      applyMotion('system', false);
      applyExperienceChoice('balanced', false);
      applyAccent('mono', false);
      stopFocusTimer(false);
      state.focusRemaining = 25 * 60;
      state.focusUpdatedAt = 0;
      renderSettings();
      state.instances.forEach(updateInstanceState);
    });
  }

  function exportData() {
    const data = {};
    Object.entries(STORAGE).forEach(([name, key]) => {
      data[name] = readString(key, '');
    });
    const blob = new Blob([JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), data }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'arrow-data.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function importData(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      if (file.size > 1024 * 1024) throw new Error('ARROW import files must be smaller than 1 MB.');
      const payload = JSON.parse(await file.text());
      if (payload?.version !== 1 || !payload.data || typeof payload.data !== 'object' || Array.isArray(payload.data)) throw new Error('Invalid ARROW export.');
      for (const name of ['tasks', 'events', 'links']) {
        const raw = payload.data[name];
        if (raw && (typeof raw !== 'string' || !Array.isArray(JSON.parse(raw)))) throw new Error('Invalid ARROW ' + name + ' data.');
      }
      Object.entries(STORAGE).forEach(([name, key]) => {
        if (typeof payload.data[name] === 'string') localStorage.setItem(key, payload.data[name]);
      });
      applyTheme(getThemeChoice(), false);
      applyMotion(getMotionChoice(), false);
      applyExperienceChoice(getExperienceChoice(), false);
      applyAccent(readString(STORAGE.accent, 'mono'), false);
      stopFocusTimer(false);
      restoreFocusState();
      renderSettings();
      alert('ARROW data imported.');
    } catch (error) {
      alert(error?.message || 'Could not import that ARROW data file.');
    } finally {
      event.target.value = '';
    }
  }

  function formatEventDate(date, time) {
    const parsed = new Date(date + 'T' + (time || '12:00'));
    if (Number.isNaN(parsed.getTime())) return date;
    return parsed.toLocaleString([], {
      month: 'short',
      day: 'numeric',
      ...(time ? { hour: 'numeric', minute: '2-digit' } : {}),
    });
  }

  function normalizeUrl(value) {
    try {
      const candidate = /^[a-z][a-z0-9+.-]*:\/\//i.test(value) ? value : 'https://' + value;
      const url = new URL(candidate);
      if (!['http:', 'https:'].includes(url.protocol)) return '';
      return url.toString();
    } catch {
      return '';
    }
  }

  function shortHost(value) {
    try { return new URL(value).hostname.replace(/^www\./, ''); }
    catch { return value; }
  }

  function capitalize(value) {
    return value.charAt(0).toUpperCase() + value.slice(1);
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, char => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }[char]));
  }

  function escapeAttr(value) {
    return escapeHtml(value);
  }

  function moduleOrbitControl(module) {
    const instance = [...state.instances].find(item => item.module === module);
    if (!instance?.root) return null;
    return (
      instance.root.querySelector('.arrow-os-trigger') ||
      instance.root.querySelector('.arrow-os-orbit')
    );
  }

  function viewportPoint(element) {
    const rect = element?.getBoundingClientRect?.();
    if (!rect || (!rect.width && !rect.height)) {
      return { x: innerWidth / 2, y: innerHeight / 2 };
    }
    return {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    };
  }

  function startParticleCanvas(canvas, direction) {
    if (!(canvas instanceof HTMLCanvasElement)) return;
    let context = null;
    try {
      context = canvas.getContext('2d');
    } catch {
      return;
    }
    if (!context) return;

    const width = innerWidth;
    const height = innerHeight;
    const dpr = Math.min(devicePixelRatio || 1, 1.5);
    canvas.width = Math.max(1, Math.floor(width * dpr));
    canvas.height = Math.max(1, Math.floor(height * dpr));
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    context.setTransform(dpr, 0, 0, dpr, 0, 0);

    const cx = width / 2;
    const cy = height / 2;
    const count = width < 700 ? 150 : 230;
    const radius = Math.hypot(width, height) * .62;
    const particles = Array.from({ length: count }, (_, index) => {
      const angle = Math.PI * 2 * index / count + (index % 9) * .018;
      const lane = .18 + ((index * 37) % 100) / 100 * .82;
      return {
        angle,
        distance: radius * lane,
        size: 1.1 + (index % 5) * .52,
        delay: (index % 17) * 5.5,
        bend: ((index % 7) - 3) * .028,
        alpha: .44 + (index % 6) * .09,
      };
    });

    const inward = direction === 'in';
    const startedAt = performance.now();
    const duration = inward ? 420 : 380;
    let frame = 0;

    const easeIn = value => value * value * value;
    const easeOut = value => 1 - Math.pow(1 - value, 3);

    const draw = now => {
      const elapsed = now - startedAt;
      const global = Math.min(1, elapsed / duration);
      context.clearRect(0, 0, width, height);
      context.globalCompositeOperation = 'lighter';

      for (let index = 0; index < particles.length; index++) {
        const particle = particles[index];
        const local = Math.max(0, Math.min(1, (elapsed - particle.delay) / (duration - particle.delay)));
        if (local <= 0) continue;

        const travel = inward ? easeIn(local) : easeOut(local);
        const r = inward
          ? particle.distance * (1 - travel)
          : particle.distance * travel;
        const spiral = particle.angle + particle.bend * travel * 12;
        const x = cx + Math.cos(spiral) * r;
        const y = cy + Math.sin(spiral) * r * .72;
        const speedGlow = inward ? travel : 1 - Math.abs(.5 - travel) * .8;
        const length = 3 + speedGlow * (inward ? 19 : 13);
        const tailX = x - Math.cos(spiral) * length * (inward ? -1 : 1);
        const tailY = y - Math.sin(spiral) * length * .72 * (inward ? -1 : 1);

        const fade = inward
          ? Math.min(1, local * 3) * (1 - Math.max(0, (local - .86) / .14))
          : Math.min(1, local * 4) * (1 - Math.max(0, (local - .9) / .1));

        context.strokeStyle = `rgba(255,255,255,${particle.alpha * fade})`;
        context.lineWidth = Math.max(.65, particle.size * .58);
        context.beginPath();
        context.moveTo(tailX, tailY);
        context.lineTo(x, y);
        context.stroke();

        context.fillStyle = `rgba(255,255,255,${Math.min(1, particle.alpha * 1.22) * fade})`;
        context.beginPath();
        context.arc(x, y, particle.size, 0, Math.PI * 2);
        context.fill();
      }

      context.globalCompositeOperation = 'source-over';
      if (global < 1 && document.documentElement.contains(canvas)) {
        frame = requestAnimationFrame(draw);
      } else {
        context.clearRect(0, 0, width, height);
      }
    };

    frame = requestAnimationFrame(draw);
    canvas.dataset.frame = String(frame);
  }

  function warpPageIntoSingularity(point) {
    const selector = [
      'header','nav','aside','main > *','main section','main article',
      'h1','h2','h3','p','button','a','[role="button"]',
      '[class*="card"]','[class*="panel"]'
    ].join(',');

    const candidates = [...document.querySelectorAll(selector)]
      .filter(element => {
        if (!(element instanceof HTMLElement)) return false;
        if (element.closest('.arrow-os-handoff')) return false;
        const rect = element.getBoundingClientRect();
        if (rect.width < 20 || rect.height < 10) return false;
        if (rect.bottom < 0 || rect.top > innerHeight || rect.right < 0 || rect.left > innerWidth) return false;
        const style = getComputedStyle(element);
        return style.visibility !== 'hidden' && style.display !== 'none' && Number(style.opacity || 1) > .03;
      })
      .sort((a, b) => {
        const ar = a.getBoundingClientRect();
        const br = b.getBoundingClientRect();
        return (br.width * br.height) - (ar.width * ar.height);
      })
      .slice(0, 28);

    const maxDistance = Math.max(1, Math.hypot(innerWidth, innerHeight));

    candidates.forEach((element, index) => {
      const rect = element.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = point.x - cx;
      const dy = point.y - cy;
      const distance = Math.hypot(dx, dy);
      const normalized = Math.min(1, distance / maxDistance);
      const direction = dx * dy >= 0 ? 1 : -1;
      const bendX = -dy * .055 * direction;
      const bendY = dx * .055 * direction;

      const rotation = direction * (4 + normalized * 10);
      element.style.setProperty('--arrow-warp-x', dx + 'px');
      element.style.setProperty('--arrow-warp-y', dy + 'px');
      element.style.setProperty('--arrow-warp-mid-x', (dx * .62) + 'px');
      element.style.setProperty('--arrow-warp-mid-y', (dy * .62) + 'px');
      element.style.setProperty('--arrow-warp-bend-x', bendX + 'px');
      element.style.setProperty('--arrow-warp-bend-y', bendY + 'px');
      element.style.setProperty('--arrow-warp-rot', rotation + 'deg');
      element.style.setProperty('--arrow-warp-rot-a', (rotation * .28) + 'deg');
      element.style.setProperty('--arrow-warp-rot-b', (rotation * .72) + 'deg');
      element.style.setProperty('--arrow-warp-delay', (36 + normalized * 90 + (index % 4) * 7) + 'ms');
      element.style.setProperty('--arrow-warp-duration', (850 + normalized * 170) + 'ms');
      element.classList.add('arrow-os-gravity-target');
    });
  }

  let handoffTimer = null;
  function resetHandoff() {
    if(handoffTimer!==null){clearTimeout(handoffTimer);handoffTimer=null;}
    state.departing=false;
    document.documentElement.classList.remove('arrow-os-blackhole-active');
    document.querySelectorAll('.arrow-os-handoff').forEach(node=>node.remove());
    document.querySelectorAll('.arrow-os-gravity-target').forEach(node=>{
      node.classList.remove('arrow-os-gravity-target');
      [...node.style].filter(key=>key.startsWith('--arrow-warp-')).forEach(key=>node.style.removeProperty(key));
    });
  }
  window.addEventListener('pageshow',event=>{if(event.persisted)resetHandoff();});
  window.addEventListener('pagehide',()=>{if(handoffTimer!==null){clearTimeout(handoffTimer);handoffTimer=null;}});

  function launchToOrbit(module, anchor, orbitAccess = 'enabled', destination = null) {
    if ((module === 'orbit' && !destination) || state.departing) return;
    const url = new URL(resolveHref(destination || ORBIT_URL), window.location.origin);
    if (destination && !ON_ENTERARROW && !BETA_BASE) { location.assign(url.toString()); return; }
    if (destination && (url.origin !== location.origin || !(/^\/(orbit|relay|ravin|atlas|waypoint)(\/|$)/.test(url.pathname) || BETA_BASE && (url.pathname.startsWith(BETA_BASE+'/') || url.pathname.startsWith('/Resonant-Relay/'))))) return;
    state.departing = true;
    url.searchParams.set('from', module);
    if (orbitAccess === 'relay-only') url.searchParams.set('access', 'relay-only');

    if (motionReduced()) {
      location.assign(url.toString());
      return;
    }

    const point = { x: innerWidth / 2, y: innerHeight / 2 };
    document.documentElement.style.setProperty('--arrow-bh-x', point.x + 'px');
    document.documentElement.style.setProperty('--arrow-bh-y', point.y + 'px');

    const overlay = document.createElement('div');
    overlay.className = 'arrow-os-handoff arrow-os-blackhole-departure';
    overlay.setAttribute('role', 'status');
    overlay.setAttribute('aria-live', 'polite');
    overlay.style.setProperty('--bh-x', point.x + 'px');
    overlay.style.setProperty('--bh-y', point.y + 'px');
    overlay.innerHTML =
      '<span class="arrow-os-gravity-vignette"></span>' +
      '<span class="arrow-os-blackhole-halo"></span>' +
      '<span class="arrow-os-blackhole-lens lens-upper"></span>' +
      '<span class="arrow-os-blackhole-lens lens-lower"></span>' +
      '<span class="arrow-os-blackhole-disk disk-far"></span>' +
      '<span class="arrow-os-blackhole-disk disk-main"></span>' +
      '<span class="arrow-os-blackhole-photon-ring"></span>' +
      '<span class="arrow-os-blackhole-core"></span>' +
      '<canvas class="arrow-os-particle-canvas" aria-hidden="true"></canvas>' +
      '<p>' + (destination ? 'Traveling to ' + escapeHtml(url.pathname.split('/')[1].toUpperCase()) : 'Collapsing to Orbit') + '</p>';
    document.body.appendChild(overlay);
    startParticleCanvas(overlay.querySelector('.arrow-os-particle-canvas'), 'in');

    requestAnimationFrame(() => {
      document.documentElement.classList.add('arrow-os-blackhole-active');
      warpPageIntoSingularity(point);
    });

    handoffTimer = setTimeout(() => {handoffTimer=null;location.assign(url.toString());}, 1380);
  }

  function receiveFromOrbit(module) {
    if (module === 'orbit' || state.arrivalHandled) return;
    state.arrivalHandled = true;
    const url = new URL(location.href);
    if (url.searchParams.get('from') !== 'orbit') return;

    const clear = () => {
      url.searchParams.delete('from');
      history.replaceState({}, '', url.pathname + url.search + url.hash);
    };

    if (motionReduced()) {
      clear();
      return;
    }

    const overlay = document.createElement('div');
    overlay.className = 'arrow-os-handoff arrow-os-center-arrival';
    overlay.setAttribute('role', 'status');
    overlay.setAttribute('aria-live', 'polite');
    overlay.innerHTML =
      '<span class="arrow-os-center-arrival-core"></span>' +
      '<span class="arrow-os-center-shock shock-a"></span>' +
      '<span class="arrow-os-center-shock shock-b"></span>' +
      '<canvas class="arrow-os-particle-canvas" aria-hidden="true"></canvas>' +
      '<p>Arriving in ' + module.toUpperCase() + '</p>';
    document.body.appendChild(overlay);
    startParticleCanvas(overlay.querySelector('.arrow-os-particle-canvas'), 'out');

    setTimeout(() => {
      overlay.remove();
      clear();
    }, 1260);
  }

  function pruneInstances() {
    state.instances.forEach(instance => {
      if (!document.documentElement.contains(instance.mount)) {
        state.instances.delete(instance);
      }
    });
  }

  function mountAll() {
    pruneInstances();
    const previousCount = state.instances.size;
    document.querySelectorAll('[data-arrow-os-shell]').forEach(createInstance);
    const first = [...state.instances][0];

    if (first && state.instances.size > previousCount && readString(STORAGE.theme, '')) {
      applyTheme(getThemeChoice(), false);
    }

    if (first) receiveFromOrbit(first.module);
    updateHostTheme();
  }

  function closeEverythingOnOutsidePointer(event) {
    const insideRoot = [...state.instances].some(instance => instance.root.contains(event.target));
    const insidePanel = state.panelEl?.contains(event.target);
    if (insideRoot || insidePanel) return;

    closePanel(false);
    state.instances.forEach(instance => {
      instance.pinned = false;
      instance.root.dataset.pinned = 'false';
      setOpen(instance, false);
    });
  }

  document.addEventListener('pointerdown', closeEverythingOnOutsidePointer);
  window.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;

    const current = [...state.instances][0];
    if (current && current.module !== 'orbit') {
      event.preventDefault();
      closePanel(false);
      state.instances.forEach(instance => {
        instance.pinned = false;
        instance.root.dataset.pinned = 'false';
        setOpen(instance, false);
      });
      launchToOrbit(current.module, moduleOrbitControl(current.module), current.orbitAccess);
      return;
    }

    if (state.activePanel) {
      closePanel();
      return;
    }

    state.instances.forEach(instance => {
      instance.pinned = false;
      instance.root.dataset.pinned = 'false';
      setOpen(instance, false);
    });
  }, true);

  const repositionPanel = () => {
    if (state.activePanel) positionPanel(state.panelAnchor);
  };
  window.addEventListener('resize', repositionPanel);
  window.visualViewport?.addEventListener('resize', repositionPanel);

  window.addEventListener('storage', event => {
    if (event.key === 'arrow_shared_data_ping_v1') {
      if (['notes', 'tasks', 'calendar'].includes(state.activePanel)) renderPanel(state.activePanel);
      window.dispatchEvent(new CustomEvent('arrow:planning-changed'));
      return;
    }
    if (!Object.values(STORAGE).includes(event.key)) return;
    if (event.key === STORAGE.theme) applyTheme(getThemeChoice(), false);
    if (event.key === STORAGE.motion) applyMotion(getMotionChoice(), false);
    if (event.key === STORAGE.experience) applyExperienceChoice(getExperienceChoice(), false);
    if (event.key === STORAGE.accent) applyAccent(readString(STORAGE.accent, 'mono'), false);
    if (event.key === STORAGE.focusState || event.key === STORAGE.focusMinutes) {
      stopFocusTimer(false);
      restoreFocusState();
    }
    const panelKeys = { notes: [STORAGE.notes], tasks: [STORAGE.tasks], calendar: [STORAGE.events], links: [STORAGE.links], focus: [STORAGE.focusState, STORAGE.focusMinutes], settings: Object.values(STORAGE) };
    if (panelKeys[state.activePanel]?.includes(event.key)) renderPanel(state.activePanel);
  });

  matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => {
    if (getThemeChoice() === 'system') applyTheme('system', false);
  });
  matchMedia('(prefers-reduced-motion: reduce)').addEventListener?.('change', () => {
    if (getMotionChoice() === 'system') applyMotion('system', false);
  });

  new MutationObserver(updateHostTheme).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class', 'data-theme', 'data-arrow-theme'],
  });

  document.documentElement.dataset.arrowAccent = readString(STORAGE.accent, 'mono');
  if (readString(STORAGE.experience, '')) applyExperienceChoice(getExperienceChoice(), false);
  if (readString(STORAGE.accent, '')) applyAccent(readString(STORAGE.accent, 'mono'), false);
  applyTheme(getThemeChoice(), false);
  applyExperienceChoice(getExperienceChoice(), false);
  applyAccent(readString(STORAGE.accent, 'mono'), false);
  applyMotion(getMotionChoice(), false);
  restoreFocusState();
  // State is persisted on timer actions. An old background tab must not overwrite it on exit.

  const startMounting = () => {
    requestAnimationFrame(() => {
      mountAll();
      const panel = new URLSearchParams(location.search).get('panel');
      if (location.pathname.startsWith('/orbit') && ['support','moderation'].includes(panel)) openPanel(panel,'orbit');
    });
    // Ignore panel rendering, chat tokens, counters and other unrelated DOM updates.
    let mountFrame = 0;
    const isMount = node => node.nodeType === 1 &&
      (node.matches('[data-arrow-os-shell]') || node.querySelector('[data-arrow-os-shell]'));
    const observer = new MutationObserver(records => {
      if (!records.some(record => [...record.addedNodes, ...record.removedNodes].some(isMount))) return;
      if (mountFrame) return;
      mountFrame = requestAnimationFrame(() => { mountFrame = 0; mountAll(); });
    });
    observer.observe(document.body, { childList: true, subtree: true });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startMounting, { once: true });
  } else {
    startMounting();
  }

  window.ArrowOS = {
    mountAll,
    openPanel,
    closePanel,
    applyTheme,
    applyMotion,
    applyAccent,
    applyExperienceChoice,
    launchToOrbit,
    resolveHref,
    previewPlan,
    navigate: (href, module = 'orbit') => launchToOrbit(module, null, 'enabled', href),
    data: arrowData,
    staffRole,
    nextMove,
  };
})();
