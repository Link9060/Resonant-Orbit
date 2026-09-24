import { expect, test } from '@playwright/test';

async function openOrbit(page: import('@playwright/test').Page) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => {
    sessionStorage.setItem('orbit-startup-seen', '1');
  });
  await page.goto('/');
}

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

test('travel moves focus into the destination arrival screen', async ({ page }) => {
  await openOrbit(page);

  await page.keyboard.press('3');
  const travel = page.getByRole('button', { name: 'Travel to Relay' });
  await expect(travel).toBeVisible();

  await travel.click();

  const arrival = page.getByRole('region', { name: 'Relay arrival' });
  const openRelay = page.getByRole('button', { name: 'Open Relay' });

  await expect(arrival).toBeVisible();
  await expect(arrival).toBeFocused();

  await page.keyboard.press('Tab');
  await expect(openRelay).toBeFocused();
});

test('Escape returns from a destination preview using the normal return path', async ({ page }) => {
  await openOrbit(page);

  await page.keyboard.press('3');
  await page.getByRole('button', { name: 'Travel to Relay' }).click();
  await expect(page.getByRole('region', { name: 'Relay arrival' })).toBeVisible();

  await page.keyboard.press('Escape');

  const core = page.getByRole('button', { name: /YOU ARE HERE Orbit/i });
  await expect(core).toBeVisible();
  await expect(core).toBeFocused();
});

test('staged destinations are labeled as previews rather than connected travel', async ({ page }) => {
  await openOrbit(page);

  await page.keyboard.press('4');
  await expect(page.getByRole('button', { name: 'Preview W' })).toBeVisible();
  await expect(page.getByText('preview only · route staged')).toBeVisible();
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

test('reduced-motion incoming handoff clears the source query immediately', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => {
    sessionStorage.setItem('orbit-startup-seen', '1');
  });

  await page.goto('/?from=relay');

  await expect.poll(() => new URL(page.url()).searchParams.get('from')).toBeNull();
  await expect(page.getByText('Everything starts here.')).toBeVisible();
});


test('ARROW system island expands from the Orbit header', async ({ page }) => {
  await openOrbit(page);

  const trigger = page.getByRole('button', { name: 'Open ARROW controls' });
  await expect(trigger).toBeVisible();

  await trigger.click();
  await expect(trigger).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByRole('link', { name: 'Notes' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Calendar' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'ARROW settings' })).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
});
