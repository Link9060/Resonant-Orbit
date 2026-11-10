import { expect, test } from '@playwright/test';

async function openBetaOrbit(page: import('@playwright/test').Page) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => {
    localStorage.setItem('arrow-dev-auth-bypass-v1', '1');
    localStorage.setItem('orbit-startup-seen-v2', '1');
  });
  await page.goto('/');
  await expect(page.locator('.world-shell')).toBeVisible();
}

test('integrated full access rebinds number shortcuts after hydration', async ({ page }) => {
  await openBetaOrbit(page);
  await expect(page.locator('.world-shell')).toHaveAttribute('data-access-mode','full');
  for (const [key,name] of [['1','Atlas'],['2','RAVIN'],['3','Relay'],['4','Waypoint']] as const) {
    await page.keyboard.press(key);
    await expect(page.getByRole('heading', { name, exact:true })).toBeVisible();
    await expect(page.getByRole('navigation',{name:'ARROW quick routes'}).getByRole('button',{name:key+': Focus '+name})).toHaveAttribute('aria-pressed','true');
  }
});

test('explicit Relay public access restricts keys 1,2,4 while preserving 3', async ({ page }) => {
  await page.emulateMedia({ reducedMotion:'reduce' });
  await page.addInitScript(() => {
    localStorage.setItem('arrow-dev-auth-bypass-v1','1');
    localStorage.setItem('orbit-startup-seen-v2','1');
  });
  await page.goto('/?access=relay-only');
  await expect(page.locator('.world-shell')).toHaveAttribute('data-access-mode','relay-only');
  const nav=page.getByRole('navigation',{name:'ARROW quick routes'});
  for (const key of ['1','2','4']) {
    await page.keyboard.press(key);
    await expect(nav.getByRole('button',{name:new RegExp('^'+key+': Focus')})).toBeDisabled();
    await expect(page.getByRole('heading',{name:'Your ARROW system'})).toBeVisible();
  }
  await page.keyboard.press('3');
  await expect(page.getByRole('heading',{name:'Relay',exact:true})).toBeVisible();
});

test('quick location picker lets the user move beyond the Tasks default', async ({ page }) => {
  await openBetaOrbit(page);
  await page.getByRole('button',{name:/Quick locations/}).click();
  const editor=page.getByRole('region',{name:'Manage Orbit quick locations'});
  await expect(editor).toBeVisible();
  const tasks=editor.getByRole('radio',{name:'Tasks'});
  const plans=editor.getByRole('radio',{name:'Plans'});
  const goals=editor.getByRole('radio',{name:'Goals'});
  await expect(tasks).toBeChecked();
  await plans.check();
  await expect(plans).toBeChecked();
  await expect(editor.getByText('Selected: Plans')).toBeVisible();
  await goals.check();
  await expect(goals).toBeChecked();
  await expect(tasks).not.toBeChecked();
  await expect(editor.getByText('Selected: Goals')).toBeVisible();
  await expect(editor.getByRole('textbox',{name:'Name'})).toBeVisible();
});
