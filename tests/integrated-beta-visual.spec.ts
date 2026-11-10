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
          const action=document.querySelector('.adapt-edit-button');
          if(!(surface instanceof HTMLElement)||!(action instanceof HTMLElement))return null;
          const style=getComputedStyle(surface);
          const actionStyle=getComputedStyle(action);
          const canvas=document.createElement('canvas');canvas.width=canvas.height=1;
          const context=canvas.getContext('2d',{willReadFrequently:true});
          if(!context)return null;
          const rgb=(css:string)=>{
            if(!CSS.supports('color',css))throw new Error('Unsupported color '+css);
            context.clearRect(0,0,1,1);context.fillStyle=css;
            context.fillRect(0,0,1,1);
            return [...context.getImageData(0,0,1,1).data].slice(0,3);
          };
          const luminosity=(color:number[])=>{
            const c=color.map(component=>{
              const value=component/255;
              return value<=.04045?value/12.92:Math.pow((value+.055)/1.055,2.4);
            });
            return .2126*c[0]+.7152*c[1]+.0722*c[2];
          };
          const front=luminosity(rgb(actionStyle.color)),back=luminosity(rgb(actionStyle.backgroundColor));
          const contrast=(Math.max(front,back)+.05)/(Math.min(front,back)+.05);
          return {theme:root.dataset.arrowTheme,ink:style.color,
            muted:style.getPropertyValue('--adapt-muted').trim(),actionContrast:contrast};
        });
        expect(appearance?.theme,identity+' '+mode).toBe(mode);
        expect(appearance?.ink).toBeTruthy();
        expect(appearance?.actionContrast,identity+' '+mode+' '+width+'px customize action').toBeGreaterThanOrEqual(4.5);
        await page.screenshot({path:'test-results/arrow-visual-qa/'+identity+'-'+mode+'-'+width+'.png',animations:'disabled'});
      }
    }
  }
});
