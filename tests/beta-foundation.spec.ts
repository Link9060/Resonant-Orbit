import { expect, test } from '@playwright/test';

async function openBetaOrbit(page: import('@playwright/test').Page, identity = 'core') {
  await page.emulateMedia({ reducedMotion:'reduce' });
  await page.addInitScript((selected) => {
    localStorage.setItem('arrow-dev-auth-bypass-v1','1');
    localStorage.setItem('orbit-startup-seen-v2','1');
    localStorage.setItem('arrow_os_adapt_v1',selected);
  },identity);
  await page.goto('/');
  await expect(page.locator('.orbit-app')).toBeVisible();
}

test('older beta retains the Orbit / Dashboard switch and both destinations', async ({ page }) => {
  await openBetaOrbit(page);
  const controls = page.getByRole('group',{name:'Orbit display'});
  const orbit = controls.getByRole('button',{name:'Orbit',exact:true});
  const dashboard = controls.getByRole('button',{name:'Dashboard',exact:true});
  await expect(orbit).toHaveAttribute('aria-pressed','true');
  await dashboard.click();
  await expect(page.locator('.orbit-app')).toHaveAttribute('data-orbit-view','widgets');
  await expect(page.getByRole('heading',{name:'Dashboard',exact:true})).toBeVisible();
  await expect(page.locator('.adapt-dashboard')).toBeVisible();
  await orbit.click();
  await expect(page.locator('.orbit-app')).toHaveAttribute('data-orbit-view','orbit');
  await expect(page.locator('.adapt-dashboard')).toHaveCount(0);
  await expect(page.locator('.world-shell')).toBeVisible();
});

test('dashboard scrolls as one page, never in the individual widget bodies', async ({ page }) => {
  await openBetaOrbit(page,'bloom');
  await page.getByRole('group',{name:'Orbit display'})
    .getByRole('button',{name:'Dashboard',exact:true}).click();
  const dashboard = page.locator('.adapt-dashboard');
  await expect(dashboard).toBeVisible();
  const scroll = await dashboard.evaluate(el=>getComputedStyle(el).overflowY);
  expect(scroll).toBe('auto');
  const cards = page.locator('.orbit-positioned-widget .adapt-widget-content');
  await expect(cards.first()).toBeVisible();
  const values = await cards.evaluateAll(nodes=>nodes.map(el=>getComputedStyle(el).overflowY));
  expect(values.length).toBeGreaterThan(0);
  expect(values.every(value=>value==='hidden')).toBe(true);
});

test('Atelier dashboard background follows its custom ARROW palette', async ({ page }) => {
  await openBetaOrbit(page,'atelier');
  await page.evaluate(()=>{
    document.documentElement.dataset.arrowTheme='light';
    document.documentElement.style.setProperty('--arrow-adapt-primary','#7a1734');
  });
  await page.getByRole('group',{name:'Orbit display'})
    .getByRole('button',{name:'Dashboard',exact:true}).click();
  await expect(page.locator('.adapt-dashboard')).toBeVisible();
  const burgundy = await page.locator('.adapt-dashboard').evaluate(el=>getComputedStyle(el).backgroundColor);
  await page.evaluate(()=>document.documentElement.style.setProperty('--arrow-adapt-primary','#167a35'));
  const emerald = await page.locator('.adapt-dashboard').evaluate(el=>getComputedStyle(el).backgroundColor);
  expect(burgundy).not.toEqual(emerald);
});
