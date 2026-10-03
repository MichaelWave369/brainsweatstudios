import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
const base=process.env.TEST_BASE_URL||'http://127.0.0.1:5173/';
await mkdir('docs/screenshots/v4',{recursive:true});
const browser=await chromium.launch({args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
  const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage();
  await page.addInitScript(()=>{if(!localStorage.getItem('brain-sweat-studio:v1'))localStorage.setItem('brain-sweat-studio:v1',JSON.stringify({version:2,difficulty:'explorer',records:{},daily:{},checkpoints:{},classes:{},settings:{music:0,effects:0,muted:true,reducedMotion:true,highContrast:false,tutorials:false,locale:'en',haptics:false,botControl:false,labPalette:'green'},selectedDifficulty:true}));});
  for(const[name,route]of[['studio','/'],['classes','/classes'],['road-class','/class/road-space'],['trade','/game/trade'],['circuit','/game/electric'],['line-crew','/game/lines'],['fire','/game/fire'],['sport-agent','/game/sports'],['space-agent','/game/space'],['retro','/lab/space'],['online','/online']]){
    await page.goto(base+'#'+route);await page.locator('main h1').waitFor();
    if(route.includes('/game/')||route.includes('/lab/'))await page.locator('.game-controls').waitFor();
    if(name==='sport-agent'||name==='space-agent'||name==='retro'){
      await page.getByRole('button',{name:'Load a worked controller',exact:true}).click();
      await page.getByRole('button',{name:'Run full episode',exact:true}).click();
    }
    if(name==='circuit'){
      for(const part of ['Virtual battery','Load A','Load B','Virtual meter','Protection module'])await page.locator('.part-chip').filter({hasText:part}).click();
      await page.getByRole('button',{name:'Energize virtual board',exact:true}).click();
      await page.getByRole('button',{name:'Read virtual meter',exact:true}).click();
    }
    await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:'docs/screenshots/v4/'+name+'.png'});
  }
  await page.setViewportSize({width:390,height:844});await page.goto(base+'#/lab/space');await page.locator('.game-controls').waitFor();
  await page.screenshot({path:'docs/screenshots/v4/mobile-retro.png'});await context.close();
  console.log('Version 4 review screenshots captured.');
}finally{await browser.close();}
