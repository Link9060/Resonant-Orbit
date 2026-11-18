import {expect,test} from '@playwright/test';

const forecast = {
  current:{time:'2026-11-10T11:00',temperature_2m:51,apparent_temperature:47,
    relative_humidity_2m:58,wind_speed_10m:9,weather_code:2},
  hourly:{
    time:Array.from({length:24},(_,i)=>'2026-11-10T'+String(i).padStart(2,'0')+':00'),
    temperature_2m:Array.from({length:24},(_,i)=>49+i/2),
    precipitation_probability:Array.from({length:24},(_,i)=>i),
    weather_code:Array.from({length:24},()=>2),
  },
  daily:{
    time:['2026-11-10','2026-11-11','2026-11-12','2026-11-13','2026-11-14','2026-11-15','2026-11-16'],
    temperature_2m_max:Array(7).fill(59),
    temperature_2m_min:Array(7).fill(39),
    precipitation_probability_max:Array(7).fill(22),
    sunrise:Array(7).fill('2026-11-10T07:03'),
    sunset:Array(7).fill('2026-11-10T17:08'),
    uv_index_max:Array(7).fill(3),
    weather_code:Array(7).fill(2),
  },
};

test('weather city picker and forecast are navigable without geolocation permission',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.addInitScript(()=>{
    localStorage.setItem('arrow-dev-auth-bypass-v1','1');
    localStorage.setItem('orbit-startup-seen-v2','1');
    localStorage.setItem('sb-cnorozrjugxpanpfmssa-auth-token',JSON.stringify({
      user:{id:'test-weather-user'},access_token:'mock-test-token',
    }));
    localStorage.setItem('arrow-orbit-adapt-view-v1:test-weather-user','widgets');
    localStorage.setItem('arrow-orbit-dashboard-layout-v2:test-weather-user',JSON.stringify([
      {id:'weather',size:'large',visible:true,cols:8,rows:4,x:0,y:0},
      {id:'tasks',size:'medium',visible:false,cols:6,rows:2},
    ]));
  });
  await page.route('https://geocoding-api.open-meteo.com/v1/search?**',route=>route.fulfill({
    status:200,contentType:'application/json',
    body:JSON.stringify({results:[{
      name:'Lenexa',admin1:'Kansas',country:'United States',latitude:38.95,longitude:-94.74,
    }]}),
  }));
  await page.route('https://api.open-meteo.com/v1/forecast?**',route=>route.fulfill({
    status:200,contentType:'application/json',body:JSON.stringify(forecast),
  }));
  await page.goto('/');
  await expect(page.locator('.adapt-dashboard')).toBeVisible();
  await page.getByRole('button',{name:'Choose weather location'}).click();
  const chooser=page.getByRole('dialog',{name:'Choose a weather location'});
  await expect(chooser).toBeVisible();
  await chooser.getByRole('textbox',{name:'Weather city search'}).fill('Lenexa');
  await chooser.getByRole('button',{name:'Search',exact:true}).click();
  const match=chooser.getByRole('button',{name:/Lenexa, Kansas, United States/});
  await expect(match).toBeVisible();
  await match.click();
  await expect(chooser.getByRole('status')).toHaveCount(0);
  await chooser.getByRole('button',{name:'Close weather location picker'}).click();
  await expect(page.getByRole('button',{name:'View detailed forecast'})).toBeVisible();
  await page.getByRole('button',{name:'View detailed forecast'}).click();
  const details=page.getByRole('dialog',{name:/Detailed weather forecast for Lenexa/});
  await expect(details).toBeVisible();
  await expect(details.getByRole('heading',{name:'Next 12 hours'})).toBeVisible();
  await expect(details.getByRole('heading',{name:'Seven-day forecast'})).toBeVisible();
  await expect(details.locator('.orbit-weather-hour')).toHaveCount(12);
  await expect(details.locator('.orbit-weather-day')).toHaveCount(7);
  await details.getByRole('button',{name:'Change location'}).click();
  await expect(page.getByRole('dialog',{name:'Choose a weather location'})).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog',{name:'Choose a weather location'})).toHaveCount(0);
});
