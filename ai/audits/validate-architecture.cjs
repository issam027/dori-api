const fs=require('fs'),path=require('path'),base=path.resolve(__dirname,'../../..'),out={};
for(const name of ['dori-api','dori-web','dori-agent']){
const root=path.join(base,name),ts=require(path.join(root,'node_modules/typescript'));
const cf=ts.readConfigFile(path.join(root,name==='dori-web'?'tsconfig.app.json':'tsconfig.json'),ts.sys.readFile),cfg=ts.parseJsonConfigFileContent(cf.config,ts.sys,root);
const files=[];function walk(d){for(const e of fs.readdirSync(d,{withFileTypes:true})){const f=path.join(d,e.name);if(e.isDirectory()){if(e.name!=='generated')walk(f)}else if(/\.tsx?$/.test(f)&&!/\.(spec|test)\./.test(f))files.push(path.resolve(f))}}walk(path.join(root,'src'));
const graph=new Map(),cross=[];
const rel=f=>path.relative(root,f).replaceAll('\\','/');
for(const f of files){const sf=ts.createSourceFile(f,fs.readFileSync(f,'utf8'),ts.ScriptTarget.Latest,true),edges=[];
for(const n of sf.statements){if(!ts.isImportDeclaration(n)||!ts.isStringLiteral(n.moduleSpecifier)||n.importClause?.isTypeOnly)continue;
const clause=n.importClause;if(clause?.namedBindings&&ts.isNamedImports(clause.namedBindings)&&!clause.name&&clause.namedBindings.elements.length&&clause.namedBindings.elements.every(x=>x.isTypeOnly))continue;
const resolved=ts.resolveModuleName(n.moduleSpecifier.text,f,cfg.options,ts.sys).resolvedModule;if(!resolved)continue;
const d=path.resolve(resolved.resolvedFileName);if(!files.includes(d))continue;edges.push(d);
const from=rel(f),to=rel(d),a=from.match(/^src\/features\/([^/]+)/),b=to.match(/^src\/features\/([^/]+)/);
if(a&&b&&a[1]!==b[1]&&!to.endsWith('/public.ts'))cross.push({from,to});
}graph.set(f,edges);}
let idx=0;const index=new Map(),low=new Map(),stack=[],on=new Set(),cycles=[];
function visit(v){index.set(v,idx);low.set(v,idx++);stack.push(v);on.add(v);for(const w of graph.get(v)||[]){if(!index.has(w)){visit(w);low.set(v,Math.min(low.get(v),low.get(w)))}else if(on.has(w))low.set(v,Math.min(low.get(v),index.get(w)))}if(low.get(v)===index.get(v)){let c=[],w;do{w=stack.pop();on.delete(w);c.push(rel(w))}while(w!==v);if(c.length>1)cycles.push(c)}}for(const f of files)if(!index.has(f))visit(f);
out[name]={files:files.length,staticValueImportCycles:cycles,crossFeatureInternals:cross};console.log(name,'cycles',cycles.length,'cross-feature internals',cross.length);}
fs.writeFileSync(path.join(__dirname,'architecture-imports-apres-2026-11-01.json'),JSON.stringify(out,null,2));
