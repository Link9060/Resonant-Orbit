(() => {
  const STORAGE = {
    notes: 'arrow_os_notes_v1',
    tasks: 'arrow_os_tasks_v1',
    events: 'arrow_os_events_v1',
    links: 'arrow_os_links_v1',
    theme: 'arrow_os_theme_v1',
    motion: 'arrow_os_motion_v1',
    accent: 'arrow_os_accent_v1',
    experience: 'arrow_os_experience_v1',
    focusMinutes: 'arrow_os_focus_minutes_v1',
    focusState: 'arrow_os_focus_state_v1',
  };

  const ORBIT_URL = 'https://link9060.github.io/Resonant-Orbit/';
  const VALID_MODULES = new Set(['relay', 'orbit', 'atlas', 'ravin']);
  const PANEL_LABELS = {
    notes: 'Notes',
    tasks: 'Tasks',
    focus: 'Focus',
    calendar: 'Calendar',
    links: 'Links',
    appearance: 'Appearance',
    settings: 'Settings',
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
    if (currentModule !== 'orbit') {
      root.classList.toggle('dark', resolved === 'dark');
      root.dataset.theme = resolved;
      root.setAttribute('data-theme', resolved);
    }
    root.dataset.arrowTheme = resolved;

    window.dispatchEvent(new CustomEvent('arrow:themechange', {
      detail: { choice, resolved },
    }));

    updateHostTheme();
    state.instances.forEach(updateInstanceState);
    if (state.activePanel === 'appearance') renderPanel('appearance');
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

    if (state.activePanel === 'appearance') renderPanel('appearance');
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

    if (state.activePanel === 'appearance') renderPanel('appearance');
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
    if (state.activePanel === 'appearance') renderPanel('appearance');
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
      instance.root.dataset.hostTheme = hostTheme;
    });
    if (state.panelEl) state.panelEl.dataset.hostTheme = hostTheme;
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

    const module = VALID_MODULES.has(mount.dataset.module) ? mount.dataset.module : 'relay';
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
          '<span class="arrow-os-divider" aria-hidden="true"></span>' +
          controlButton('notes', 'Notes') +
          controlButton('tasks', 'Tasks') +
          controlButton('focus', 'Focus') +
          controlButton('calendar', 'Calendar') +
          controlButton('links', 'Links') +
          '<span class="arrow-os-divider" aria-hidden="true"></span>' +
          controlButton('appearance', 'Appearance') +
          controlButton('settings', 'Settings') +
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
    }

    orbitButton.addEventListener('click', () => {
      if (module === 'orbit') {
        closePanel();
        const core = document.querySelector('.orbit-core-label');
        if (core instanceof HTMLButtonElement) core.click();
        window.dispatchEvent(new CustomEvent('arrow:orbit-home'));
        return;
      }
      launchToOrbit(module);
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
    if (restoreFocus) target?.focus?.({ preventScroll: true });
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
    if (name === 'notes') renderNotes();
    if (name === 'tasks') renderTasks();
    if (name === 'calendar') renderCalendar();
    if (name === 'links') renderLinks();
    if (name === 'focus') renderFocus();
    if (name === 'appearance') renderAppearance();
    if (name === 'settings') renderSettings();
  }

  function renderNotes() {
    const value = readString(STORAGE.notes, '');
    state.panelBody.innerHTML =
      '<label class="arrow-os-field">' +
        '<span>Quick note</span>' +
        '<textarea class="arrow-os-notes" rows="12" placeholder="Write anything you want available everywhere in ARROW..."></textarea>' +
      '</label>' +
      '<div class="arrow-os-panel-foot"><span class="arrow-os-save-state">Saved locally across ARROW</span><span>' + value.length + ' characters</span></div>';

    const area = state.panelBody.querySelector('.arrow-os-notes');
    area.value = value;
    area.addEventListener('input', () => {
      writeString(STORAGE.notes, area.value);
      state.panelBody.querySelector('.arrow-os-panel-foot span:last-child').textContent = area.value.length + ' characters';
    });
  }

  function renderTasks() {
    const rawTasks = readJson(STORAGE.tasks, []);
    const tasks = Array.isArray(rawTasks)
      ? rawTasks.filter(task => task && typeof task.id === 'string' && typeof task.text === 'string').slice(0, 500)
      : [];
    state.panelBody.innerHTML =
      '<form class="arrow-os-inline-form arrow-os-task-form">' +
        '<input type="text" maxlength="120" placeholder="Add a task..." aria-label="Task name" required />' +
        '<button type="submit" aria-label="Add task">' + icon('plus') + '</button>' +
      '</form>' +
      '<div class="arrow-os-list">' +
        (tasks.length ? tasks.map(task =>
          '<div class="arrow-os-list-row ' + (task.done ? 'is-done' : '') + '" data-id="' + escapeAttr(task.id) + '">' +
            '<label><input type="checkbox" ' + (task.done ? 'checked' : '') + ' /><span>' + escapeHtml(task.text) + '</span></label>' +
            '<button type="button" class="arrow-os-row-delete" aria-label="Delete task">' + icon('trash') + '</button>' +
          '</div>'
        ).join('') : panelEmpty('No tasks yet.')) +
      '</div>';

    state.panelBody.querySelector('.arrow-os-task-form').addEventListener('submit', event => {
      event.preventDefault();
      const input = event.currentTarget.querySelector('input');
      const text = input.value.trim();
      if (!text) return;
      const next = [{ id: id(), text, done: false, createdAt: Date.now() }, ...tasks];
      writeJson(STORAGE.tasks, next);
      renderTasks();
      state.panelBody.querySelector('.arrow-os-task-form input')?.focus();
    });

    state.panelBody.querySelectorAll('.arrow-os-list-row').forEach(row => {
      const taskId = row.dataset.id;
      row.querySelector('input').addEventListener('change', event => {
        const next = tasks.map(task => task.id === taskId ? { ...task, done: event.target.checked } : task);
        writeJson(STORAGE.tasks, next);
        renderTasks();
      });
      row.querySelector('.arrow-os-row-delete').addEventListener('click', () => {
        writeJson(STORAGE.tasks, tasks.filter(task => task.id !== taskId));
        renderTasks();
      });
    });
  }

  function renderCalendar() {
    const rawEvents = readJson(STORAGE.events, []);
    const events = (Array.isArray(rawEvents)
      ? rawEvents.filter(item => item && typeof item.id === 'string' && typeof item.title === 'string' && typeof item.date === 'string').slice(0, 500)
      : [])
      .sort((a, b) => String(a.date + (a.time || '')).localeCompare(String(b.date + (b.time || ''))));
    state.panelBody.innerHTML =
      '<form class="arrow-os-calendar-form">' +
        '<input type="text" maxlength="100" placeholder="Event title" aria-label="Event title" required />' +
        '<div class="arrow-os-form-grid">' +
          '<input type="date" aria-label="Event date" required />' +
          '<input type="time" aria-label="Event time" />' +
        '</div>' +
        '<button type="submit">Add event</button>' +
      '</form>' +
      '<div class="arrow-os-list arrow-os-events">' +
        (events.length ? events.map(item =>
          '<div class="arrow-os-list-row" data-id="' + escapeAttr(item.id) + '">' +
            '<div><strong>' + escapeHtml(item.title) + '</strong><span>' + formatEventDate(item.date, item.time) + '</span></div>' +
            '<button type="button" class="arrow-os-row-delete" aria-label="Delete event">' + icon('trash') + '</button>' +
          '</div>'
        ).join('') : panelEmpty('No ARROW events yet.')) +
      '</div>';

    const form = state.panelBody.querySelector('.arrow-os-calendar-form');
    form.querySelector('input[type="date"]').value = localDateInputValue();
    form.addEventListener('submit', event => {
      event.preventDefault();
      const [titleInput, dateInput, timeInput] = form.querySelectorAll('input');
      const title = titleInput.value.trim();
      if (!title || !dateInput.value) return;
      writeJson(STORAGE.events, [
        ...events,
        { id: id(), title, date: dateInput.value, time: timeInput.value || '', createdAt: Date.now() },
      ]);
      renderCalendar();
    });

    state.panelBody.querySelectorAll('.arrow-os-events .arrow-os-list-row').forEach(row => {
      row.querySelector('.arrow-os-row-delete').addEventListener('click', () => {
        writeJson(STORAGE.events, events.filter(item => item.id !== row.dataset.id));
        renderCalendar();
      });
    });
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
      state.focusUpdatedAt = Date.now();
      state.focusRemaining = Math.max(0, state.focusRemaining - elapsed);
      updateFocusDisplay();
      if (state.focusRemaining <= 0) {
        stopFocusTimer(true);
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
    const tasks = readJson(STORAGE.tasks, []);
    const events = readJson(STORAGE.events, []);
    const links = readJson(STORAGE.links, []);
    const notesLength = readString(STORAGE.notes, '').length;

    state.panelBody.innerHTML =
      '<div class="arrow-os-settings-card">' +
        '<span>ARROW local data</span>' +
        '<strong>' + tasks.length + ' tasks · ' + events.length + ' events · ' + links.length + ' links</strong>' +
        '<small>' + notesLength + ' note characters. Stored in this browser and shared across the four GitHub Pages ARROW modules.</small>' +
      '</div>' +
      '<div class="arrow-os-settings-actions">' +
        '<button type="button" data-settings-action="export">Export ARROW data</button>' +
        '<label class="arrow-os-import">Import ARROW data<input type="file" accept="application/json" data-settings-action="import" /></label>' +
        '<button type="button" class="is-danger" data-settings-action="reset">Reset ARROW data</button>' +
      '</div>';

    state.panelBody.querySelector('[data-settings-action="export"]').addEventListener('click', exportData);
    state.panelBody.querySelector('[data-settings-action="import"]').addEventListener('change', importData);
    state.panelBody.querySelector('[data-settings-action="reset"]').addEventListener('click', () => {
      if (!confirm('Reset ARROW notes, tasks, calendar events, links, appearance, and focus settings in this browser?')) return;
      Object.values(STORAGE).forEach(key => {
        try { localStorage.removeItem(key); } catch {}
      });
      applyTheme('system', false);
      applyMotion('system', false);
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
      if (!payload?.data || typeof payload.data !== 'object') throw new Error('Invalid ARROW export.');
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

  function launchToOrbit(module) {
    if (motionReduced()) {
      const url = new URL(ORBIT_URL);
      url.searchParams.set('from', module);
      location.assign(url.toString());
      return;
    }

    const overlay = document.createElement('div');
    overlay.className = 'arrow-os-handoff arrow-os-departure';
    overlay.setAttribute('role', 'status');
    overlay.setAttribute('aria-live', 'polite');
    overlay.innerHTML =
      '<span class="arrow-os-handoff-ring ring-a"></span>' +
      '<span class="arrow-os-handoff-ring ring-b"></span>' +
      '<span class="arrow-os-handoff-craft"><span></span></span>' +
      '<p>Returning to Orbit</p>';
    document.body.appendChild(overlay);

    const url = new URL(ORBIT_URL);
    url.searchParams.set('from', module);
    setTimeout(() => location.assign(url.toString()), 980);
  }

  function receiveFromOrbit(module) {
    if (module === 'orbit') return;
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
    overlay.className = 'arrow-os-handoff arrow-os-arrival';
    overlay.setAttribute('role', 'status');
    overlay.setAttribute('aria-live', 'polite');
    overlay.innerHTML =
      '<span class="arrow-os-handoff-ring ring-a"></span>' +
      '<span class="arrow-os-handoff-ring ring-b"></span>' +
      '<span class="arrow-os-handoff-craft"><span></span></span>' +
      '<p>Arriving in ' + module.toUpperCase() + '</p>';
    document.body.appendChild(overlay);
    setTimeout(() => {
      overlay.remove();
      clear();
    }, 1080);
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
    document.querySelectorAll('[data-arrow-os-shell]').forEach(createInstance);
    const first = [...state.instances][0];

    if (first && readString(STORAGE.theme, '')) {
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
    if (state.activePanel) {
      closePanel();
      return;
    }
    state.instances.forEach(instance => {
      instance.pinned = false;
      instance.root.dataset.pinned = 'false';
      setOpen(instance, false);
    });
  });

  window.addEventListener('resize', () => {
    if (state.activePanel && state.panelAnchor) positionPanel(state.panelAnchor);
  });

  window.addEventListener('storage', event => {
    if (!Object.values(STORAGE).includes(event.key)) return;
    if (event.key === STORAGE.theme) applyTheme(getThemeChoice(), false);
    if (event.key === STORAGE.motion) applyMotion(getMotionChoice(), false);
    if (event.key === STORAGE.experience) applyExperienceChoice(getExperienceChoice(), false);
    if (event.key === STORAGE.accent) applyAccent(readString(STORAGE.accent, 'mono'), false);
    if (event.key === STORAGE.focusState || event.key === STORAGE.focusMinutes) {
      stopFocusTimer(false);
      restoreFocusState();
    }
    if (state.activePanel) renderPanel(state.activePanel);
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
  applyMotion(getMotionChoice(), false);
  restoreFocusState();
  window.addEventListener('beforeunload', saveFocusState);

  const startMounting = () => {
    requestAnimationFrame(mountAll);
    const observer = new MutationObserver(() => mountAll());
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
  };
})();
