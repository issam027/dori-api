const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'../../..'),out={};
for(const name of ['dori-api','dori-web','dori-agent']){
const dir=path.join(root,name),pkg=JSON.parse(fs.readFileSync(path.join(dir,'package.json'),'utf8')),files=[];
function walk(d){for(const e of fs.readdirSync(d,{withFileTypes:true})){if(['node_modules','.git','dist','coverage','playwright-report','test-results','ai','todo','specifications'].includes(e.name))continue;const f=path.join(d,e.name);if(e.isDirectory())walk(f);else if(/\.(?:[cm]?[jt]sx?|json|ya?ml|html)$/.test(f)&&!['package-lock.json','package.json'].includes(e.name))files.push(f)}}walk(dir);
out[name]=Object.keys(pkg.dependencies||{}).map(dep=>({dependency:dep,references:files.filter(f=>fs.readFileSync(f,'utf8').includes(dep)).map(f=>path.relative(dir,f).replaceAll('\\','/'))}));console.log(name,JSON.stringify(out[name].filter(x=>!x.references.length)));
}
fs.writeFileSync(path.join(__dirname,'dependances-references-2026-11-01.json'),JSON.stringify(out,null,2));
