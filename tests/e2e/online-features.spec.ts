import { test, expect, type Browser, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { freshSave } from '../../src/systems/progress';
test.describe.configure({mode:'parallel'});
async function prepare(page:Page){
  const s=freshSave();s.selectedDifficulty=true;s.settings.tutorials=false;s.settings.reducedMotion=true;
  await page.addInitScript(save=>{if(!localStorage.getItem('brain-sweat-studio:v1'))localStorage.setItem('brain-sweat-studio:v1',JSON.stringify(save));},s);
  await page.route('**/online-service.json',route=>route.fulfill({json:{endpoint:'http://127.0.0.1:5173/__online-test',publishableKey:''}}));
  await page.goto('/#/online');await page.getByRole('button',{name:'Connect online',exact:true}).click();
  await expect(page.getByRole('button',{name:'Create room',exact:true})).toBeVisible();
}
async function pair(browser:Browser){
  const options={baseURL:process.env.TEST_BASE_URL||'http://127.0.0.1:5173',viewport:{width:1440,height:1000}};
  const contexts=await Promise.all([browser.newContext(options),browser.newContext(options)]);
  const pages=await Promise.all(contexts.map(c=>c.newPage()));await Promise.all(pages.map(prepare));return{contexts,pages};
}
const group=(page:Page)=>page.locator('.private-group').first();
async function join(host:Page,guest:Page,tab:'Rooms'|'Clans'|'Tournaments',createName:string,joinName:string){
  await host.getByRole('button',{name:tab,exact:true}).click();await guest.getByRole('button',{name:tab,exact:true}).click();
  await host.getByRole('button',{name:createName,exact:true}).click();await expect(group(host)).toBeVisible();
  const code=await group(host).locator('.invite-code input').inputValue();
  await guest.getByLabel('Invitation code',{exact:true}).fill(code);await guest.getByRole('button',{name:joinName,exact:true}).click();
  await expect(group(guest)).toBeVisible();
  await expect(group(host).locator('.online-roster').first().locator('li')).toHaveCount(2,{timeout:12000});
}
async function start(host:Page,guest:Page){
  await group(host).getByRole('button',{name:'Ready to play',exact:true}).click();
  await expect(group(host).getByRole('button',{name:'Return to preparing',exact:true})).toBeEnabled();
  const version=await group(host).getAttribute('data-online-version');
  await expect(group(guest)).toHaveAttribute('data-online-version',version!,{timeout:12000});
  await group(guest).getByRole('button',{name:'Ready to play',exact:true}).click();
  await expect(group(guest).getByRole('button',{name:'Return to preparing',exact:true})).toBeEnabled();
  await expect(group(host).getByRole('button',{name:'Start event',exact:true})).toBeEnabled({timeout:12000});
  await group(host).getByRole('button',{name:'Start event',exact:true}).click();
}
test('two separate browser identities cooperate through shared server turns and stay outside local XP',async({browser})=>{
  test.setTimeout(90000);const{contexts,pages:[host,guest]}=await pair(browser);
  try{
    await join(host,guest,'Rooms','Create room','Join room');await start(host,guest);
    for(let i=0;i<9;i++){
      const player=i%2?guest:host;
      const button=group(player).getByRole('button',{name:['Log observation','Confirm protected zone','Dispatch qualified response'][i%3],exact:true});
      await expect(button).toBeEnabled({timeout:12000});await button.click();
    }
    for(const p of[host,guest]){
      await expect(p.getByText('Team objective complete.',{exact:false})).toBeVisible({timeout:12000});
      expect(await p.evaluate(()=>JSON.parse(localStorage.getItem('brain-sweat-studio:v1')!).xp)).toBe(0);
    }
    const scan=await new AxeBuilder({page:host}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze();
    expect(scan.violations).toEqual([]);
    if(test.info().project.name==='chromium')await group(host).screenshot({path:'docs/screenshots/v4/online-room.png'});
    await host.setViewportSize({width:320,height:844});
    await expect.poll(async()=>{
      const layout=await host.evaluate(()=>({width:document.documentElement.scrollWidth,spill:[...document.querySelectorAll('body *')].filter(e=>e.getBoundingClientRect().right>322).slice(0,12).map(e=>({tag:e.tagName,class:e.className,right:e.getBoundingClientRect().right}))}));
      return layout.width===320?'fits':JSON.stringify(layout);
    },{message:'The connected commons fits the phone viewport after resize',timeout:5000}).toBe('fits');
  }finally{await Promise.all(contexts.map(c=>c.close()));}
});
test('clans, host transfer, shared tournament evaluation, reconnect, and deletion work end to end',async({browser})=>{
  test.setTimeout(120000);const{contexts,pages:[host,guest]}=await pair(browser);
  try{
    await join(host,guest,'Clans','Create clan','Join clan');
    await group(host).getByRole('button',{name:'Good round',exact:true}).click();
    await expect(group(guest).getByText('good-round',{exact:false})).toBeVisible({timeout:12000});
    await group(host).getByLabel('Next group host',{exact:true}).selectOption({index:1});
    await group(host).getByRole('button',{name:'Transfer host role',exact:true}).click();
    await expect(group(guest).getByRole('button',{name:'Transfer host role',exact:true})).toBeVisible({timeout:12000});
    await join(host,guest,'Tournaments','Create tournament','Join tournament');await start(host,guest);
    await expect(group(guest).getByRole('button',{name:'Lock and evaluate controller',exact:true})).toBeVisible({timeout:12000});
    await group(guest).getByLabel('Competition controller',{exact:true}).fill(JSON.stringify({version:1,kind:'sports',rules:[{when:'always',action:'coast'}]}));
    await group(guest).getByRole('button',{name:'Lock and evaluate controller',exact:true}).click();
    await expect(group(guest).getByRole('button',{name:'Lock and evaluate controller',exact:true})).toHaveCount(0);
    await expect(group(host)).toHaveAttribute('data-online-version',(await group(guest).getAttribute('data-online-version'))!,{timeout:12000});
    await group(host).getByRole('button',{name:'Lock and evaluate controller',exact:true}).click();
    await expect(group(host).getByRole('heading',{name:'Final standings',exact:true})).toBeVisible();
    await expect(group(guest).getByRole('heading',{name:'Final standings',exact:true})).toBeVisible({timeout:12000});
    await expect(group(host).locator('tbody tr').first()).toContainText('100/100');
    await expect(group(host).locator('tbody tr').last()).toContainText('0/100');
    const audit=await new AxeBuilder({page:host}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze();expect(audit.violations).toEqual([]);
    if(test.info().project.name==='chromium')await group(host).screenshot({path:'docs/screenshots/v4/online-tournament.png'});
    await host.reload();await host.getByRole('button',{name:'Connect online',exact:true}).click();
    await host.getByRole('button',{name:'Tournaments',exact:true}).click();
    await expect(group(host).getByRole('heading',{name:'Final standings',exact:true})).toBeVisible();
    await host.getByRole('button',{name:'Delete my online identity',exact:true}).click();
    await host.getByRole('button',{name:'Delete online identity',exact:true}).click();
    await expect(host.getByRole('button',{name:'Connect online',exact:true})).toBeVisible();
    expect(await host.evaluate(()=>Object.keys(localStorage).filter(k=>k.startsWith('brain-sweat-studio:online:')).length)).toBe(0);
    expect(await host.evaluate(()=>JSON.parse(localStorage.getItem('brain-sweat-studio:v1')!).xp)).toBe(0);
  }finally{await Promise.all(contexts.map(c=>c.close()));}
});
test('online stays opt-in and the published setup state is clear in both languages',async({page})=>{
  const requests:string[]=[];page.on('request',r=>{if(r.url().includes('supabase')||r.url().endsWith('online-service.json'))requests.push(r.url());});
  await page.goto('/#/online');await expect(page.getByRole('button',{name:'Connect online',exact:true})).toBeVisible();expect(requests).toEqual([]);
  await page.getByRole('button',{name:'Connect online',exact:true}).click();
  await expect(page.getByText('Online service setup is pending. The offline games and classes are ready.')).toBeVisible();
  await page.getByLabel('Language',{exact:true}).selectOption('es');
  await expect(page.getByRole('heading',{name:'La zona en línea.',exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Conectar en línea',exact:true})).toBeVisible();
  expect(await page.evaluate(()=>Object.keys(localStorage).filter(k=>k.startsWith('brain-sweat-studio:online:')).length)).toBe(0);
});
