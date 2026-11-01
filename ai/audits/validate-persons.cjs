require('ts-node/register/transpile-only');
const fs=require('fs'),path=require('path'),Module=require('module'),ts=require('typescript'),{Client}=require('pg'),{execFileSync}=require('child_process');
const {PersonsRepository:After}=require('../../src/modules/persons/persons.repository');
const filename=path.resolve('src/modules/persons/persons.repository.before.cjs'),mod=new Module(filename,module);mod.filename=filename;mod.paths=Module._nodeModulePaths(path.dirname(filename));
mod._compile(ts.transpileModule(execFileSync('git',['show','d113ad64ddc043f00df823eba1c0faafb340eb9d:src/modules/persons/persons.repository.ts'],{encoding:'utf8'}),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2021,experimentalDecorators:true,emitDecoratorMetadata:true}}).outputText,filename);
const Before=mod.exports.PersonsRepository,client=new Client({connectionString:require('./audit-database.cjs')(),options:'-c default_transaction_read_only=on'});
(async()=>{await client.connect();try{
const siteId=(await client.query('SELECT site_id FROM dorify.dori_person GROUP BY site_id ORDER BY COUNT(*) DESC LIMIT 1')).rows[0].site_id;
const ds={query:async(sql,args)=>(await client.query(sql,args)).rows},results=[];
for(const [isActive,search,offset]of [[true,undefined,0],[false,undefined,0],[undefined,undefined,25],[true,'PERF',0],[true,'never_matches_audit_xyz',0]]){
const q={siteId,isActive,search,sortField:'person_id',sortOrder:'ASC',pageSize:25,offset};
const before=await new Before(ds).findPersons(q),after=await new After(ds).findPersons(q);
if(JSON.stringify(before)!==JSON.stringify(after))throw Error('Person list differs');
results.push({isActive,searchUsed:Boolean(search),offset,total:after.total,returned:after.items.length,equal:true});
}
fs.writeFileSync('ai/audits/persons-validation-2026-11-01.json',JSON.stringify({readOnly:true,results},null,2));console.log(JSON.stringify(results));
}finally{await client.end()}})().catch(e=>{console.error(e.message);process.exitCode=1});
