const fs=require('fs'),path=require('path'),{createHash}=require('crypto'),{execSync}=require('child_process');
const web=path.resolve('../dori-web');
function fingerprint(){const hash=createHash('sha256');function walk(dir){for(const name of fs.readdirSync(dir).sort()){const f=path.join(dir,name);if(fs.statSync(f).isDirectory())walk(f);else{hash.update(path.relative(web,f));hash.update(fs.readFileSync(f));}}}walk(path.join(web,'src/api/generated'));return hash.digest('hex');}
const before=fingerprint();execSync('npm run api:generate',{cwd:web,stdio:'pipe'});const after=fingerprint();
if(before!==after)throw Error('Generated client was not synchronized');
const result={workingTreeClientMatchesSpecification:true,sha256:after};fs.writeFileSync('ai/audits/generated-client-validation-2026-11-01.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
