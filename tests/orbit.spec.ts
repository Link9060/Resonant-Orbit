import { expect, test } from '@playwright/test';

async function openOrbit(page: import('@playwright/test').Page) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => {
    localStorage.setItem('arrow-dev-auth-bypass-v1', '1');
    localStorage.setItem('orbit-startup-seen-v2', '1');
  });
  await page.goto('/');
  await expect(page.locator('.world-shell')).toBeVisible();
}

test('ARROW login is the first surface before Orbit mounts', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'ARROW' })).toBeVisible();
  await expect(page.getByText('ONE ACCOUNT · EVERY CENTER')).toBeVisible();
  await expect(page.locator('.orbit-app')).toHaveCount(0);
});

test('quick-route rail exposes all four destinations and selected state', async ({ page }) => {
  await openOrbit(page);

  const quickRoutes = page.getByRole('navigation', { name: 'ARROW quick routes' });
  await expect(quickRoutes).toBeVisible();
  await expect(quickRoutes.getByRole('button')).toHaveCount(4);

  const relayQuickRoute = quickRoutes.getByRole('button', { name: '3: Focus Relay' });
  await expect(relayQuickRoute).toBeVisible();

  await relayQuickRoute.click();
  await expect(relayQuickRoute).toHaveAttribute('aria-pressed', 'true');
});

test('global number shortcut focuses Relay without hijacking modified shortcuts', async ({ page }) => {
  await openOrbit(page);

  await page.keyboard.press('Control+1');
  await expect(page.getByRole('heading', { name: 'Your ARROW system' })).toBeVisible();

  await page.keyboard.press('3');
  await expect(page.getByRole('heading', { name: 'Relay' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Travel to Relay' })).toBeVisible();
});

test('Navigator numeric search understands quick-route shortcuts', async ({ page }) => {
  await openOrbit(page);

  await page.keyboard.press('Control+K');
  const dialog = page.getByRole('dialog', { name: 'Orbit navigator' });
  const search = dialog.getByRole('textbox', { name: 'Search ARROW destinations' });

  await search.fill('3');
  await expect(search).toHaveValue('3');
  await expect(dialog.getByRole('button', { name: /Relay/i })).toHaveCount(1);
  await expect(dialog.getByRole('button', { name: /Atlas/i })).toHaveCount(0);
});

test('Navigator supports arrow browsing and marks the current destination', async ({ page }) => {
  await openOrbit(page);

  await page.keyboard.press('3');
  await page.keyboard.press('Control+K');

  const dialog = page.getByRole('dialog', { name: 'Orbit navigator' });
  const search = dialog.getByRole('textbox', { name: 'Search ARROW destinations' });
  const relayResult = dialog.getByRole('button', { name: /Relay/i });

  await expect(relayResult).toHaveAttribute('aria-current', 'true');

  await search.fill('');
  await search.focus();
  await page.keyboard.press('ArrowDown');
  await expect(dialog.getByRole('button', { name: /Atlas/i }).first()).toBeFocused();
});

test('Navigator Enter selects the first result and moves focus to its world node', async ({ page }) => {
  await openOrbit(page);

  await page.keyboard.press('Control+K');
  const dialog = page.getByRole('dialog', { name: 'Orbit navigator' });
  const search = dialog.getByRole('textbox', { name: 'Search ARROW destinations' });

  await search.fill('relay');
  await page.keyboard.press('Enter');

  await expect(dialog).toBeHidden();
  await expect(page.getByRole('heading', { name: 'Relay' })).toBeVisible();

  const relayNode = page.locator('.destination-node').filter({ hasText: 'Relay' });
  await expect(relayNode).toBeFocused();
});

test('travel starts from the live craft pose and uses a one-second continuous animation', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.addInitScript(() => {
    localStorage.setItem('arrow-dev-auth-bypass-v1', '1');
    localStorage.setItem('orbit-startup-seen-v2', '1');
  });
  await page.goto('/');
  await expect(page.locator('.world-shell')).toBeVisible();

  await page.keyboard.press('3');
  await page.waitForTimeout(180);

  await page.route('https://link9060.github.io/Resonant-Relay/**', route => route.abort());

  // Capture the orbiting craft and trigger Travel in the same browser task.
  // This measures the exact click-time pose instead of a stale Playwright
  // bounding box from a few animation frames earlier.
  const beforeCenter = await page.evaluate(() => {
    const craft = document.querySelector<HTMLElement>('.craft-orbit');
    const shell = document.querySelector<HTMLElement>('.world-shell');
    const travel = document.querySelector<HTMLButtonElement>('.travel-button');
    if (!craft || !shell || !travel) throw new Error('Orbit travel controls are not ready');

    const craftRect = craft.getBoundingClientRect();
    const shellRect = shell.getBoundingClientRect();
    const point = {
      x: craftRect.left + craftRect.width / 2 - (shellRect.left + shellRect.width / 2),
      y: craftRect.top + craftRect.height / 2 - (shellRect.top + shellRect.height / 2),
    };

    travel.click();
    return point;
  });

  const travelCraft = page.locator('.travel-craft');
  await expect(travelCraft).toBeVisible();

  const duration = await travelCraft.evaluate(element =>
    getComputedStyle(element).animationDuration,
  );
  expect(duration).toBe('1s');

  await expect(page.locator('.travel-transfer-veil')).toBeVisible();
  await expect(page.locator('.travel-transfer-particle')).toHaveCount(26);

  const flightVars = await page.locator('.world-shell').evaluate(element => {
    const style = getComputedStyle(element);
    return {
      startX: style.getPropertyValue('--flight-start-x').trim(),
      startY: style.getPropertyValue('--flight-start-y').trim(),
      viaX: style.getPropertyValue('--flight-via-x').trim(),
      viaY: style.getPropertyValue('--flight-via-y').trim(),
      targetX: style.getPropertyValue('--flight-target-x').trim(),
      targetY: style.getPropertyValue('--flight-target-y').trim(),
    };
  });

  for (const value of Object.values(flightVars)) {
    expect(value).toMatch(/^-?\d+(?:\.\d+)?px$/);
  }

  const startX = Number.parseFloat(flightVars.startX);
  const startY = Number.parseFloat(flightVars.startY);
  expect(Math.hypot(
    startX - beforeCenter.x,
    startY - beforeCenter.y,
  )).toBeLessThan(8);
});

test('Waypoint is a connected fourth destination', async ({ page }) => {
  await openOrbit(page);

  await page.keyboard.press('4');
  await expect(page.getByRole('heading', { name: 'Waypoint' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Travel to Waypoint' })).toBeVisible();
  await expect(page.getByText('route connected')).toBeVisible();
});

test('Navigator maps task language to Waypoint', async ({ page }) => {
  await openOrbit(page);

  await page.keyboard.press('Control+K');
  const dialog = page.getByRole('dialog', { name: 'Orbit navigator' });
  const search = dialog.getByRole('textbox', { name: 'Search ARROW destinations' });
  await search.fill('brain dump');
  await expect(dialog.getByRole('button', { name: /Waypoint/i })).toHaveCount(1);
});

test('vertical drag moves the Orbit globe in the same direction as the pointer', async ({ page }) => {
  await openOrbit(page);

  const relayNode = page.locator('.destination-node').filter({ hasText: 'Relay' });
  const before = await relayNode.boundingBox();
  expect(before).not.toBeNull();

  const shell = page.locator('.world-shell');
  const shellBox = await shell.boundingBox();
  expect(shellBox).not.toBeNull();

  const x = shellBox!.x + shellBox!.width * 0.5;
  const startY = shellBox!.y + shellBox!.height * 0.55;
  const endY = startY - 110;

  await page.mouse.move(x, startY);
  await page.mouse.down();
  await page.mouse.move(x, endY, { steps: 12 });
  await page.mouse.up();
  await page.waitForTimeout(180);

  const after = await relayNode.boundingBox();
  expect(after).not.toBeNull();
  expect(after!.y).toBeLessThan(before!.y - 4);
});

test('dragging the world never selects interface text', async ({ page }) => {
  await openOrbit(page);

  const shell = page.locator('.world-shell');
  const box = await shell.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.move(box!.x + box!.width * 0.36, box!.y + box!.height * 0.48);
  await page.mouse.down();
  await page.mouse.move(box!.x + box!.width * 0.72, box!.y + box!.height * 0.32, { steps: 10 });
  await page.mouse.up();

  expect(await page.evaluate(() => window.getSelection()?.toString() ?? '')).toBe('');
  expect(await shell.evaluate(element => getComputedStyle(element).userSelect)).toBe('none');
});

test('Atlas and RAVIN are connected ARROW destinations', async ({ page }) => {
  await openOrbit(page);

  await page.keyboard.press('1');
  await expect(page.getByRole('button', { name: 'Travel to Atlas' })).toBeVisible();
  await expect(page.getByText('route connected')).toBeVisible();

  await page.keyboard.press('2');
  await expect(page.getByRole('button', { name: 'Travel to RAVIN' })).toBeVisible();
  await expect(page.getByText('route connected')).toBeVisible();
});

test('mobile quick routes clear the centered intro copy', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openOrbit(page);

  const copyBox = await page.locator('.stage-copy').boundingBox();
  const routeBox = await page.getByRole('navigation', { name: 'ARROW quick routes' }).boundingBox();

  expect(copyBox).not.toBeNull();
  expect(routeBox).not.toBeNull();
  expect(routeBox!.y).toBeGreaterThan(copyBox!.y + copyBox!.height + 4);
});

test('destination nodes remain inside the mobile viewport after rotation', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openOrbit(page);

  const shell = page.locator('.world-shell');
  const shellBox = await shell.boundingBox();
  expect(shellBox).not.toBeNull();

  await page.mouse.move(195, 430);
  await page.mouse.down();
  await page.mouse.move(355, 300, { steps: 12 });
  await page.mouse.up();
  await page.waitForTimeout(150);

  const nodes = page.locator('.destination-node');
  const count = await nodes.count();

  for (let index = 0; index < count; index += 1) {
    const box = await nodes.nth(index).boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(-1);
    expect(box!.y).toBeGreaterThanOrEqual(-1);
    expect(box!.x + box!.width).toBeLessThanOrEqual(391);
    expect(box!.y + box!.height).toBeLessThanOrEqual(845);
  }
});

test('startup behaves as a real modal and Escape returns focus to Orbit', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.addInitScript(() => {
    localStorage.setItem('arrow-dev-auth-bypass-v1', '1');
    localStorage.removeItem('orbit-startup-seen-v2');
  });
  await page.goto('/');

  const intro = page.getByRole('dialog', { name: 'Orbit introduction' });
  const app = page.locator('.orbit-app');

  await expect(intro).toBeVisible();
  await expect(app).toHaveAttribute('inert', '');
  await expect(app).toHaveAttribute('aria-hidden', 'true');

  await page.keyboard.press('Escape');

  await expect(intro).toBeHidden();
  await expect(app).not.toHaveAttribute('inert', '');
  await expect(page.getByRole('button', { name: /YOU ARE HERE Orbit/i })).toBeFocused();
});

test('viewport opts into full safe-area coverage', async ({ page }) => {
  await openOrbit(page);

  const viewport = await page.locator('meta[name="viewport"]').getAttribute('content');
  expect(viewport).toContain('viewport-fit=cover');
});

test('Waypoint return reforms Orbit from a singularity and particles', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.addInitScript(() => {
    localStorage.setItem('arrow-dev-auth-bypass-v1', '1');
    localStorage.setItem('orbit-startup-seen-v2', '1');
  });

  await page.goto('/?from=waypoint');

  const shell = page.locator('.world-shell');
  await expect(shell).toHaveAttribute('data-incoming-from', 'waypoint');
  await expect(page.locator('.incoming-singularity')).toBeVisible();
  await expect(page.locator('.incoming-reform-particle')).toHaveCount(30);
  await expect(page.locator('.incoming-craft')).toBeVisible();
  await expect(page.locator('.world-canvas')).toHaveCSS('animation-duration', '1.05s');
});

test('reduced-motion incoming handoff clears the source query immediately', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => {
    localStorage.setItem('arrow-dev-auth-bypass-v1', '1');
    localStorage.setItem('orbit-startup-seen-v2', '1');
  });

  await page.goto('/?from=relay');

  await expect.poll(() => new URL(page.url()).searchParams.get('from')).toBeNull();
  await expect(page.getByText('Everything starts here.')).toBeVisible();
});


test('canonical ARROW shell expands from the Orbit header', async ({ page }) => {
  await openOrbit(page);

  const trigger = page.locator('.arrow-os-trigger');
  await expect(trigger).toBeVisible();
  await expect(trigger).toHaveAccessibleName('Open ARROW controls');

  await trigger.click();
  await expect(trigger).toHaveAttribute('aria-expanded', 'true');
  await expect(trigger).toHaveAccessibleName('Close ARROW controls');
  await expect(page.getByRole('button', { name: 'Notes' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Tasks' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Calendar' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Settings' })).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
});

test('ARROW Notes is a system panel, not a Relay route, and persists on reload', async ({ page }) => {
  await openOrbit(page);

  await page.locator('.arrow-os-trigger').click();
  await page.getByRole('button', { name: 'Notes' }).click();

  const dialog = page.getByRole('dialog', { name: 'Notes' });
  const note = dialog.getByRole('textbox', { name: 'Quick note' });
  await expect(dialog).toBeVisible();

  await note.fill('Shared ARROW note');
  await page.reload();

  await page.locator('.arrow-os-trigger').click();
  await page.getByRole('button', { name: 'Notes' }).click();
  await expect(page.getByRole('dialog', { name: 'Notes' }).getByRole('textbox', { name: 'Quick note' })).toHaveValue('Shared ARROW note');
});

test('ARROW task and appearance controls remain local system panels', async ({ page }) => {
  await openOrbit(page);

  await page.locator('.arrow-os-trigger').click();
  await page.getByRole('button', { name: 'Tasks' }).click();
  await expect(page.getByRole('dialog', { name: 'Tasks' })).toBeVisible();
  await expect(page).toHaveURL(/\/$/);

  await page.reload();
  const trigger = page.locator('.arrow-os-trigger');
  await expect(trigger).toBeVisible();
  await trigger.click();
  await page.getByRole('button', { name: 'Appearance' }).click();
  await expect(page.getByRole('dialog', { name: 'Appearance' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Balanced' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Dark' })).toBeVisible();
});
