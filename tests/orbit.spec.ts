import { expect, test } from '@playwright/test';

async function openOrbit(page: import('@playwright/test').Page) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => {
    sessionStorage.setItem('orbit-startup-seen', '1');
  });
  await page.goto('/');
}

test('Navigator shortcuts focus the matching destination', async ({ page }) => {
  await openOrbit(page);

  await page.keyboard.press('Control+K');
  await expect(page.getByRole('dialog', { name: 'Orbit navigator' })).toBeVisible();

  await page.keyboard.press('3');

  await expect(page.getByRole('dialog', { name: 'Orbit navigator' })).toBeHidden();
  await expect(page.getByRole('heading', { name: 'Relay' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Travel to Relay' })).toBeVisible();
});

test('travel moves focus into the destination arrival screen', async ({ page }) => {
  await openOrbit(page);

  await page.keyboard.press('3');
  const travel = page.getByRole('button', { name: 'Travel to Relay' });
  await expect(travel).toBeVisible();

  await travel.click();

  const openRelay = page.getByRole('button', { name: 'Open Relay' });
  await expect(openRelay).toBeVisible();
  const activeElement = await page.evaluate(() => {
    const active = document.activeElement as HTMLElement | null;
    return {
      tag: active?.tagName ?? null,
      text: active?.textContent?.trim() ?? null,
      className: active?.className ?? null,
      ariaHidden: active?.getAttribute('aria-hidden') ?? null,
      inert: active?.hasAttribute('inert') ?? false,
    };
  });
  console.log('Orbit arrival active element:', JSON.stringify(activeElement));
  await expect(openRelay).toBeFocused();
});

test('returning to Orbit restores focus to the core', async ({ page }) => {
  await openOrbit(page);

  await page.keyboard.press('3');
  await page.getByRole('button', { name: 'Travel to Relay' }).click();
  await expect(page.getByRole('button', { name: 'Back to Orbit' })).toBeVisible();

  await page.getByRole('button', { name: 'Back to Orbit' }).click();

  const core = page.getByRole('button', { name: /YOU ARE HERE Orbit/i });
  await expect(core).toBeVisible();
  await expect(core).toBeFocused();
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
