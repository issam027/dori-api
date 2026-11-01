process.env.TZ='UTC';
const fs=require('fs'),ts=require('typescript'),Module=require('module'),path=require('path'),{Pool}=require('pg'),{performance}=require('perf_hooks');
require('ts-node/register/transpile-only');
const text=fs.readFileSync('src/modules/monitoring/reports.repository.ts','utf8');
const sourceFilename=path.resolve('src/modules/monitoring/reports.repository.ts');
const mod=new Module(sourceFilename,module);mod.filename=sourceFilename;mod.paths=Module._nodeModulePaths(path.dirname(sourceFilename));mod._compile(ts.transpileModule(text,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2021,experimentalDecorators:true,emitDecoratorMetadata:true}}).outputText,sourceFilename);
const Before=require('./initial-reports-repository.cjs').ReportsRepository,After=mod.exports.ReportsRepository;
const pool=new Pool({connectionString:require('./audit-database.cjs')(),max:10,options:'-c default_transaction_read_only=on -c statement_timeout=30000'});
function normalize(value,key=''){if(value instanceof Date)return value.toISOString();if(Array.isArray(value))return value.map(v=>normalize(v));if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(k=>[k,normalize(value[k],k)]));if(typeof value==='string'&&/^-?\d+(?:\.\d+)?$/.test(value))return Number(value);return value}
(async()=>{try{const q=await pool.query('SELECT queue_id FROM dorify.dori_queue ORDER BY queue_id LIMIT 4');const queueIds=q.rows.map(r=>r.queue_id);const result=[];
for(const bucket of ['hour','day','week','month']){const input={queueIds,from:'2026-10-01T00:00:00Z',to:bucket==='hour'?'2026-10-03T00:00:00Z':'2026-11-01T00:00:00Z',bucket,timezone:bucket==='day'?'Europe/Paris':'Africa/Tunis'};
let count=0;const ds={query:async(sql,args)=>{count++;return(await pool.query(sql,args)).rows}};const start=performance.now();const before=await new Before(ds).getMonitoringSeries(input);const mid=performance.now();const beforeQueries=count;count=0;const after=await new After(ds).getMonitoringSeries(input);const end=performance.now();
const equal=JSON.stringify(normalize(before))===JSON.stringify(normalize(after));result.push({bucket,equal,beforeMs:mid-start,afterMs:end-mid,beforeQueries,afterQueries:count});if(!equal){fs.writeFileSync('ai/audits/reports-difference.json',JSON.stringify({before:normalize(before),after:normalize(after)},null,2));throw Error('Report results differ for '+bucket)}
}
fs.writeFileSync('ai/audits/reports-validation-2026-11-01.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}finally{await pool.end()}})().catch(e=>{console.error(e.message);process.exitCode=1});
