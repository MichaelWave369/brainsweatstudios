import { test, expect, type Page } from '@playwright/test';
import { freshSave } from '../../src/systems/progress';
import { rungFourBotPlan } from '../../src/games/rung4/botPlans';
import { RUNG_FOUR_IDS, type RungFourId } from '../../src/games/rung4/models';
import { courses } from '../../src/data/classes';
test.describe.configure({mode:'parallel'});
async function prepare(page:Page,locale:'en'|'es'='en') {
  const s=freshSave();s.selectedDifficulty=true;s.settings.tutorials=false;s.settings.reducedMotion=true;s.settings.muted=true;s.settings.locale=locale;
  await page.addInitScript(save=>{if(!localStorage.getItem('brain-sweat-studio:v1'))localStorage.setItem('brain-sweat-studio:v1',JSON.stringify(save));},s);
}
async function saved(page:Page){return page.evaluate(()=>JSON.parse(localStorage.getItem('brain-sweat-studio:v1')!));}
async function complete(page:Page,id:RungFourId){
  for(const step of rungFourBotPlan(id,'explorer',0)){
    if(step.kind==='click')await page.getByRole('button',{name:new RegExp(step.match!)}).click();
    else if(step.kind==='input')await page.locator(step.selector!).first().fill(step.value!);
    else if(step.kind==='select')await page.locator(step.selector!).first().selectOption(step.value!);
    else if(step.kind==='check')await page.getByLabel(step.match!,{exact:true}).check();
  }
}
for(const id of RUNG_FOUR_IDS)test('rung four '+id+': player completion saves and bots remain separate',async({page})=>{
  await prepare(page);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/#/game/'+id);await expect(page.locator('.game-controls')).toBeVisible();await complete(page,id);
  await expect(page.getByText('EXPERIMENT COMPLETE',{exact:true})).toBeVisible();
  const result=await saved(page);expect(result.records[id+'/explorer/0'].score).toBe(100);expect(result.xp).toBe(100);
  expect(result.checkpoints[id+'/explorer/0']).toBeUndefined();expect(errors).toEqual([]);
});
test('agent editor imports bounded policies, pauses execution, resumes stopped, and replays a real trace',async({page})=>{
  await prepare(page);await page.goto('/#/game/outpost');
  await page.getByRole('button',{name:'Load a worked controller',exact:true}).click();
  await page.getByRole('button',{name:'Run live training',exact:true}).click();
  await expect.poll(async()=>((await saved(page)).checkpoints['outpost/explorer/0']?.state.model.episode.tick||0)).toBeGreaterThan(2);
  await page.getByRole('button',{name:'Pause',exact:true}).click();
  const tick=(await saved(page)).checkpoints['outpost/explorer/0'].state.model.episode.tick;
  await page.waitForTimeout(450);expect((await saved(page)).checkpoints['outpost/explorer/0'].state.model.episode.tick).toBe(tick);
  await page.reload();await expect(page.getByRole('button',{name:'Stop training',exact:true})).toBeDisabled();
  expect((await saved(page)).checkpoints['outpost/explorer/0'].state.model.episode.tick).toBe(tick);
  await page.getByLabel('Import agent controller',{exact:true}).setInputFiles({name:'invalid.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({version:1,kind:'outpost',rules:[{when:'always',action:'eval'}]}))});
  await expect(page.getByText('Choose a version 1 policy or compatible controller package for this arena, with 1–8 valid condition/action rules.')).toBeVisible();
  expect((await saved(page)).checkpoints['outpost/explorer/0'].state.model.episode.tick).toBe(tick);
  await page.getByRole('button',{name:'Run full episode',exact:true}).click();
  await page.getByText('Inspect and replay the episode trace',{exact:true}).click();
  await expect(page.locator('.trace-scroll tbody tr').first()).toBeVisible();
  await page.getByLabel('Replay tick',{exact:true}).fill('0');
  await expect(page.getByText('Viewed position:',{exact:false})).toBeVisible();
  await page.getByRole('link',{name:'Run in the retro lab',exact:true}).first().click();
  await expect(page.locator('.crt-screen')).toBeVisible();
  await page.getByRole('button',{name:'Submit my trained agent',exact:true}).click();
  expect((await saved(page)).records['outpost/explorer/0'].score).toBe(100);
});
test('new classes teach in both languages and keep checks outside game XP',async({page})=>{
  await prepare(page,'es');await page.goto('/#/class/road-space');
  await expect(page.getByRole('heading',{name:'Espacio vial: reacción y frenado',exact:true})).toBeVisible();
  await page.getByLabel('Velocidad (mph)',{exact:true}).fill('40');
  const c=courses.find(c=>c.id==='road-space')!;
  for(let i=0;i<3;i++)await page.locator('.knowledge-check').nth(i).locator('input').nth(c.questions[i].correct).check();
  await page.getByRole('button',{name:'Comprobar lo aprendido',exact:true}).click();
  await page.reload();expect((await saved(page)).classes['road-space'].best).toBe(100);expect((await saved(page)).xp).toBe(0);
  await page.goto('/#/game/driving');await expect(page.getByRole('button',{name:/Cinturón/})).toBeVisible();
  await page.getByLabel('Velocidad del modelo',{exact:true}).fill('30');
  await expect(page.getByRole('button',{name:'Entregar mi plan vial',exact:true})).toBeDisabled();
});
test('road and circuit gates require preparation, and unsafe model revisions remain inspectable',async({page})=>{
  await prepare(page);await page.goto('/#/game/driving');
  await expect(page.getByRole('button',{name:'Start the road scenario',exact:true})).toBeDisabled();
  await page.goto('/#/game/electric');await expect(page.getByRole('button',{name:'Energize virtual board',exact:true})).toBeDisabled();
  for(const name of['Virtual battery','Load A','Load B','Virtual meter','Protection module'])await page.locator('.part-chip').filter({hasText:name}).click();
  await page.getByLabel('Load A resistance',{exact:true}).fill('1');
  await page.getByRole('button',{name:'Energize virtual board',exact:true}).click();
  await expect(page.getByLabel('Load A resistance',{exact:true})).toBeDisabled();
  await page.getByRole('button',{name:'Read virtual meter',exact:true}).click();
  await expect(page.getByText('The protection module opened the virtual circuit. Power off and revise the loads.')).toBeVisible();
  await expect(page.getByRole('button',{name:'Submit my circuit',exact:true})).toBeDisabled();
  await page.getByRole('button',{name:'Power off and revise',exact:true}).click();
  await expect(page.getByLabel('Load A resistance',{exact:true})).toBeEnabled();
});
