import { expect, test } from '@playwright/test';

async function openOrbit(page: import('@playwright/test').Page) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => {
    sessionStorage.setItem('orbit-startup-seen', '1');
  });
  await page.goto('/');
}

test('quick-route rail exposes all four destinations', async ({ page }) => {
  await openOrbit(page);

  const quickRoutes = page.getByRole('navigation', { name: 'ARROW quick routes' });
  await expect(quickRoutes).toBeVisible();
  await expect(quickRoutes.getByRole('button')).toHaveCount(4);
  await expect(quickRoutes.getByRole('button', { name: '3: Focus Relay' })).toBeVisible();
});

test('global number shortcut focuses Relay without hijacking modified shortcuts', async ({ page }) => {
  await openOrbit(page);

  await page.keyboard.press('Control+1');
  await expect(page.getByRole('heading', { name: 'Your ARROW system' })).toBeVisible();

  await page.keyboard.press('3');
  await expect(page.getByRole('heading', { name: 'Relay' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Travel to Relay' })).toBeVisible();
});

test('Navigator allows numeric search text and arrow-key browsing', async ({ page }) => {
  await openOrbit(page);

  await page.keyboard.press('Control+K');
  const dialog = page.getByRole('dialog', { name: 'Orbit navigator' });
  const search = dialog.getByRole('textbox', { name: 'Search ARROW destinations' });

  await expect(dialog).toBeVisible();
  await search.fill('3');
  await expect(search).toHaveValue('3');
  await expect(dialog).toBeVisible();

  await search.fill('');
  await page.keyboard.press('ArrowDown');
  await expect(dialog.getByRole('button', { name: /Atlas/i }).first()).toBeFocused();
});

test('Navigator Enter selects the first filtered destination', async ({ page }) => {
  await openOrbit(page);

  await page.keyboard.press('Control+K');
  const dialog = page.getByRole('dialog', { name: 'Orbit navigator' });
  const search = dialog.getByRole('textbox', { name: 'Search ARROW destinations' });

  await search.fill('relay');
  await page.keyboard.press('Enter');

  await expect(dialog).toBeHidden();
  await expect(page.getByRole('heading', { name: 'Relay' })).toBeVisible();
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

test('Escape returns from a destination preview', async ({ page }) => {
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

  await page.keyboard.press('1');
  await expect(page.getByRole('button', { name: 'Preview Atlas' })).toBeVisible();
  await expect(page.getByText('preview only · route staged')).toBeVisible();
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
