const fs=require('fs'),path=require('path'),root=path.resolve(__dirname,'../../../dori-web'),files=[];
function walk(d){for(const e of fs.readdirSync(d,{withFileTypes:true})){const f=path.join(d,e.name);if(e.isDirectory())walk(f);else files.push(f)}}walk(path.join(root,'src'));
const code=files.filter(f=>/\.[jt]sx?$/.test(f)&&!/\.(test|spec)\./.test(f)).map(f=>fs.readFileSync(f,'utf8')).join('\n');
const out=[];for(const f of files.filter(f=>f.endsWith('.css'))){const text=fs.readFileSync(f,'utf8').replace(/\/\*[\s\S]*?\*\//g,'');for(const name of new Set([...text.matchAll(/\.([a-zA-Z_][\w-]*)/g)].map(m=>m[1]))){if(!new RegExp('(^|[^\\w-])'+name+'([^\\w-]|$)').test(code))out.push({file:path.relative(root,f).replaceAll('\\','/'),class:name});}}
const result={warning:"Candidats seulement : classes construites dynamiquement, bibliothèques, sélecteurs de fichiers et sorties de génération doivent être vérifiés. Aucun sélecteur n'a été supprimé.",candidates:out};
fs.writeFileSync(path.join(__dirname,'css-candidats-2026-11-01.json'),JSON.stringify(result,null,2));console.log('CSS candidate occurrences',out.length);

