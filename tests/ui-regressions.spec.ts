import { expect, test, type Page } from '@playwright/test';

async function openApp(page: Page, view: 'world' | 'dashboard' = 'world') {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(nextView => {
    localStorage.setItem('arrow-dev-auth-bypass-v1', '1');
    localStorage.setItem('orbit-startup-seen-v2', '1');
    localStorage.setItem('arrow_orbit_view_v1', nextView);
  }, view);
  await page.goto('/');
  await expect(page.locator('.world-shell')).toBeAttached();
}

test('all four default number shortcuts select their destinations in full Orbit', async ({ page }) => {
  await openApp(page);
  await expect(page.locator('.world-shell')).toHaveAttribute('data-access-mode', 'full');
  for (const [key, name] of [['1','Atlas'],['2','RAVIN'],['3','Relay'],['4','Waypoint']] as const) {
    await page.keyboard.press(key);
    await expect(page.locator('.world-inspector h2')).toHaveText(name);
    await expect(page.getByRole('button', { name: key + ': Focus ' + name })).toHaveAttribute('aria-pressed', 'true');
  }
});

test('world shortcuts cannot change routes while the dashboard is active', async ({ page }) => {
  await openApp(page, 'dashboard');
  await expect(page.locator('.adapt-dashboard')).toBeVisible();
  await page.keyboard.press('3');
  await expect(page.locator('.world-inspector h2')).toHaveText('Your ARROW system');
});

test('all identities retain readable foreground/background contrast in both appearances', async ({ page }) => {
  await openApp(page, 'dashboard');
  await expect(page.locator('.adapt-widget').first()).toBeVisible();
  const details = await page.evaluate(() => {
    const root = document.documentElement;
    const widget = document.querySelector<HTMLElement>('.adapt-widget');
    if (!widget) throw new Error('No dashboard widget');
    const parse = (css: string) => (css.match(/[\d.]+/g) || []).slice(0,3).map(Number);
    const linear = (v: number) => {
      v /= 255;
      return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4;
    };
    const luminance = (rgb: number[]) => .2126 * linear(rgb[0]) + .7152 * linear(rgb[1]) + .0722 * linear(rgb[2]);
    const pairs: { identity: string; theme: string; ratio: number; text: string; surface: string }[] = [];
    for (const identity of ['core','bloom','haven','atelier','pulse']) {
      for (const theme of ['light','dark']) {
        root.dataset.arrowIdentity = identity;
        root.dataset.arrowTheme = theme;
        const style = getComputedStyle(widget);
        const fg = style.color, bg = style.backgroundColor;
        const a = luminance(parse(fg)), b = luminance(parse(bg));
        pairs.push({ identity, theme, text:fg, surface:bg, ratio:(Math.max(a,b)+.05)/(Math.min(a,b)+.05) });
      }
    }
    return pairs;
  });
  expect(details, JSON.stringify(details)).toHaveLength(10);
  for (const item of details) expect(item.ratio, JSON.stringify(item)).toBeGreaterThanOrEqual(4.5);
});

test('weather card opens a detailed forecast with accessible keyboard close', async ({ page }) => {
  await page.route('https://api.open-meteo.com/v1/forecast**', route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({
      current:{time:'2026-11-09T10:00',temperature_2m:63,apparent_temperature:60,weather_code:1,relative_humidity_2m:49,wind_speed_10m:10},
      hourly:{time:Array.from({length:24},(_,i)=>'2026-11-09T'+String(i).padStart(2,'0')+':00'),temperature_2m:Array(24).fill(63),precipitation_probability:Array(24).fill(5),weather_code:Array(24).fill(1)},
      daily:{time:['2026-11-09','2026-11-10','2026-11-11','2026-11-12','2026-11-13','2026-11-14','2026-11-15'],weather_code:Array(7).fill(1),temperature_2m_max:Array(7).fill(69),temperature_2m_min:Array(7).fill(45),sunrise:Array(7).fill('2026-11-09T06:51'),sunset:Array(7).fill('2026-11-09T17:09'),uv_index_max:Array(7).fill(3),precipitation_probability_max:Array(7).fill(12)},
    }),
  }));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => {
    localStorage.setItem('arrow-dev-auth-bypass-v1', '1');
    localStorage.setItem('orbit-startup-seen-v2', '1');
    localStorage.setItem('arrow_orbit_view_v1', 'dashboard');
    localStorage.setItem('arrow_orbit_widgets_v1',JSON.stringify(['weather']));
    localStorage.setItem('arrow_orbit_weather_place_v1',JSON.stringify({name:'Kansas City, Kansas',latitude:39.11,longitude:-94.63}));
  });
  await page.goto('/');
  const summary = page.getByRole('button',{name:'Open detailed weather forecast for Kansas City, Kansas'});
  await expect(summary).toBeVisible();
  await summary.click();
  const dialog = page.getByRole('dialog', { name: /63°/ });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('heading',{name:'Seven-day forecast'})).toBeVisible();
  await expect(dialog.getByRole('heading',{name:'Next 12 hours'})).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(summary).toBeFocused();
});
