const fs=require('fs'),path=require('path'),Module=require('module');
const web=path.resolve(__dirname,'../../../dori-web'),ts=require(path.join(web,'node_modules/typescript'));
const {chromium}=require(path.join(web,'node_modules/playwright'));
const AxeBuilder=require(path.join(web,'node_modules/@axe-core/playwright')).default;
const fp=path.join(web,'e2e/support/scenario-fixtures.ts'),m=new Module(fp,module);
m.filename=fp;m.paths=Module._nodeModulePaths(path.dirname(fp));m._compile(ts.transpileModule(fs.readFileSync(fp,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,fp);
(async()=>{const browser=await chromium.launch();const context=await browser.newContext({baseURL:'http://localhost:18080',locale:'fr-FR'});let page=await context.newPage();
await m.exports.installApiScenario(page,{handlers:[async({path,route})=>{if(path!=='/api/v1/public/registrations/position')return false;await route.fulfill({json:m.exports.apiEnvelope({ticketNumber:'A014',position:2,estimatedWaitMinutes:8,status:'waiting',queueName:'Accueil général'})});return true}]});await m.exports.activateSite(page);
const results=[];
for(const width of [1440,1024,768,390]){
await page.setViewportSize({width,height:900});
for(const route of ['/display','/device-mode','/health','/admin/edge-installations','/legal','/track?token=audit-factice']){
try{await page.goto(route);await page.locator('main').waitFor({timeout:10000});await page.waitForTimeout(200);const axe=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze();results.push({width,route,url:new URL(page.url()).pathname,overflow:await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),violations:axe.violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary})).slice(0,8)}))});console.log(width,route,axe.violations.length);}catch(e){results.push({width,route,error:String(e)});}
}
}
await page.setViewportSize({width:1024,height:900});
for(const route of ['/appointments','/onboarding']){
await page.goto(route);await page.locator('main').waitFor();await page.waitForTimeout(250);const protrusions=await page.evaluate(()=>[...document.querySelectorAll('main *')].map(e=>({tag:e.tagName,class:String(e.className),left:e.getBoundingClientRect().left,right:e.getBoundingClientRect().right,width:e.getBoundingClientRect().width})).filter(e=>e.width>0&&e.right>innerWidth+1));results.push({route,width:1024,protrusions});await page.screenshot({path:path.join(__dirname,'uix-captures',route.slice(1)+'-1024.png'),fullPage:true});
}
const modalContext=await browser.newContext({baseURL:'http://localhost:18080',locale:'fr-FR'});page=await modalContext.newPage();await m.exports.installApiScenario(page);await m.exports.activateSite(page);
for(const width of [1440,768,390]){
await page.setViewportSize({width,height:844});await page.goto('/settings/queues');await page.locator('main').waitFor();await page.waitForTimeout(250);
const buttons=await page.getByRole('main').getByRole('button').allTextContents();results.push({width,route:'/settings/queues',buttons});
const add=page.getByRole('main').getByRole('button',{name:/créer|ajouter|nouvelle file/i}).first();
if(await add.count()){await add.click();await page.getByRole('dialog').waitFor();const d=page.getByRole('dialog');const axe=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze();results.push({width,dialog:'createQueue',bounds:await d.boundingBox(),violations:axe.violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.map(n=>n.target)})),focusInside:await d.evaluate(e=>e.contains(document.activeElement))});await page.screenshot({path:path.join(__dirname,'uix-captures','queue-dialog-'+width+'.png'),fullPage:true});await page.keyboard.press('Escape');results.push({width,escapeCloses:await d.count()===0});}
}
fs.writeFileSync(path.join(__dirname,'mesures-uix-complement-2026-11-01.json'),JSON.stringify({mockedAPI:true,results},null,2));await browser.close();})().catch(e=>{console.error(e);process.exitCode=1});
