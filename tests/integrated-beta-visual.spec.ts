import {expect,test} from '@playwright/test';
import {mkdirSync} from 'node:fs';

const identities=['core','bloom','haven','atelier','pulse'] as const;
const modes=['light','dark'] as const;

test('all ten Adapt identity/theme combinations stay inside desktop and mobile bounds',async({page})=>{
  test.setTimeout(180_000);
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.addInitScript(()=>{
    localStorage.setItem('arrow-dev-auth-bypass-v1','1');
    localStorage.setItem('orbit-startup-seen-v2','1');
  });
  mkdirSync('test-results/arrow-visual-qa',{recursive:true});
  await page.goto('/');
  for(const width of [390,1280]){
    await page.setViewportSize({width,height:width===390?844:800});
    for(const identity of identities){
      for(const mode of modes){
        await page.evaluate(({identity,mode})=>{
          localStorage.setItem('arrow_os_adapt_v1',identity);
          localStorage.setItem('arrow_os_theme_v1',mode);
          localStorage.setItem('arrow-orbit-adapt-view-v1:guest','widgets');
        },{identity,mode});
        await page.reload();
        const app=page.locator('.orbit-app');
        await expect(app).toHaveAttribute('data-orbit-adapt',identity);
        const dashboard=page.locator('.adapt-dashboard');
        await expect(dashboard).toBeVisible();
        await expect(page.getByRole('heading',{name:'Dashboard',exact:true})).toBeVisible();
        const bounds=await dashboard.locator('.adapt-dashboard-inner').boundingBox();
        expect(bounds,identity+' '+mode+' '+width).not.toBeNull();
        expect(bounds!.x,identity+' '+mode+' '+width).toBeGreaterThanOrEqual(-5);
        expect(bounds!.x+bounds!.width,identity+' '+mode+' '+width).toBeLessThanOrEqual(width+5);
        const headerControls=await page.locator('.orbit-header').evaluate(element=>{
          const brand=element.querySelector('.suite-lockup');
          const right=element.querySelector('.orbit-header-right');
          return {brandLeft:brand?.getBoundingClientRect().left ?? 0,
            rightEdge:right?.getBoundingClientRect().right ?? 0,
            viewport:window.innerWidth};
        });
        expect(headerControls.brandLeft,identity+' '+mode+' '+width+' brand left').toBeGreaterThanOrEqual(-1);
        expect(headerControls.rightEdge,identity+' '+mode+' '+width+' header right').toBeLessThanOrEqual(width+1);
        const appearance=await page.evaluate(()=>{
          const root=document.documentElement;
          const surface=document.querySelector('.adapt-dashboard');
          if(!(surface instanceof HTMLElement))return null;
          const style=getComputedStyle(surface);
          return {theme:root.dataset.arrowTheme,ink:style.color,muted:style.getPropertyValue('--adapt-muted').trim()};
        });
        expect(appearance?.theme,identity+' '+mode).toBe(mode);
        expect(appearance?.ink).toBeTruthy();
        await page.screenshot({path:'test-results/arrow-visual-qa/'+identity+'-'+mode+'-'+width+'.png',animations:'disabled'});
      }
    }
  }
});
