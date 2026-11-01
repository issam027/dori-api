const fs=require('fs'),path=require('path'),Module=require('module');
const web=path.resolve(__dirname,'../../../dori-web'),ts=require(path.join(web,'node_modules/typescript'));
const {chromium}=require(path.join(web,'node_modules/playwright'));
const AxeBuilder=require(path.join(web,'node_modules/@axe-core/playwright')).default;
const fp=path.join(web,'e2e/support/scenario-fixtures.ts'),m=new Module(fp,module);
m.filename=fp;m.paths=Module._nodeModulePaths(path.dirname(fp));m._compile(ts.transpileModule(fs.readFileSync(fp,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,fp);
const {installApiScenario,activateSite}=m.exports;
(async()=>{
const browser=await chromium.launch({headless:true});const context=await browser.newContext({baseURL:'http://localhost:18080',locale:'fr-FR'});
const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(String(e)));
await installApiScenario(page);await activateSite(page);
const out=[];fs.mkdirSync(path.join(__dirname,'uix-captures'),{recursive:true});
for(const width of [1440,1024,768,390,320]){
await page.setViewportSize({width,height:width>768?900:844});
for(const route of ['/desk','/my-queues','/persons','/appointments','/control-room','/reports','/notifications','/portfolio','/settings/sites','/settings/queues','/settings/tiers','/admin/users','/admin/translations','/audit','/profile','/onboarding','/kiosk']){
try{
await page.goto(route);await page.locator('main').waitFor({timeout:12000});await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(160);
const metrics=await page.evaluate(()=>{
const visible=e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0&&getComputedStyle(e).visibility!=='hidden'};
const controls=[...document.querySelectorAll('button,a,input,select,summary')].filter(visible);
return {url:location.pathname,viewport:innerWidth,scrollWidth:document.documentElement.scrollWidth,headings:[...document.querySelectorAll('main h1,main h2')].map(e=>e.textContent),smallTargets:controls.map(e=>{const r=e.getBoundingClientRect();return {label:(e.getAttribute('aria-label')||e.textContent||'').trim().slice(0,90),w:Math.round(r.width),h:Math.round(r.height),tag:e.tagName}}).filter(r=>r.w<44||r.h<44),horizontalRegions:[...document.querySelectorAll('main *')].filter(e=>visible(e)&&e.scrollWidth>e.clientWidth+2&&['auto','scroll'].includes(getComputedStyle(e).overflowX)).map(e=>({class:String(e.className),client:e.clientWidth,scroll:e.scrollWidth})),smallInputFonts:[...document.querySelectorAll('main input,main select,main textarea')].filter(e=>visible(e)&&parseFloat(getComputedStyle(e).fontSize)<16).map(e=>({label:e.getAttribute('aria-label')||e.name,font:getComputedStyle(e).fontSize}))};
});
if([1440,768,390].includes(width)&&['/reports','/settings/tiers','/appointments','/persons','/desk'].includes(route))await page.screenshot({path:path.join(__dirname,'uix-captures',route.slice(1).replaceAll('/','-')+'-'+width+'.png'),fullPage:true,animations:'disabled'});
if(width===390||width===1440){const a=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze();metrics.accessibility=a.violations.map(v=>({id:v.id,impact:v.impact,description:v.description,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary})).slice(0,12)}));}
out.push({route,width,...metrics});console.log(width,route,'overflow',metrics.scrollWidth>width,'small',metrics.smallTargets.length,'axe',metrics.accessibility?.length??'-');
}catch(e){out.push({route,width,error:String(e)});console.log('ERROR',width,route,String(e).slice(0,100));}
}
fs.writeFileSync(path.join(__dirname,'mesures-uix-2026-11-01.json'),JSON.stringify({baseURL:'http://localhost:18080',mockedAPI:true,errors,results:out},null,2));
}
await browser.close();
})().catch(e=>{console.error(e);process.exitCode=1});

