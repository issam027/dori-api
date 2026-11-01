require('ts-node/register/transpile-only');process.env.TZ='UTC';
const fs=require('fs'),{Pool}=require('pg'),{performance}=require('perf_hooks');
const Before=require('./initial-reports-repository.cjs').ReportsRepository;
const {monitoringSeriesQueries}=require('../../src/modules/monitoring/monitoring-series.query');
const pool=new Pool({connectionString:require('./audit-database.cjs')(),max:10,options:'-c default_transaction_read_only=on -c statement_timeout=30000'});
const median=a=>[...a].sort((x,y)=>x-y)[Math.floor(a.length/2)];
(async()=>{try{
const queueIds=(await pool.query('SELECT queue_id FROM dorify.dori_queue ORDER BY queue_id LIMIT 4')).rows.map(r=>r.queue_id);
const input={queueIds,from:'2026-10-01T00:00:00Z',to:'2026-11-01T00:00:00Z',bucket:'day',timezone:'Africa/Tunis'};
const baseline=[];await new Before({query:async(sql,parameters)=>{baseline.push({sql,parameters});return[]}}).getMonitoringSeries(input);
const lateral=monitoringSeriesQueries(input);
const narrow=lateral.map((q,i)=>{
 if(!q.sql.includes(', events AS ('))return q;
 const oldEvents=baseline[i].sql.match(/, events AS \([\s\S]*?\), (?:periods|counts) AS/)[0];
 return {...q,sql:q.sql.replace(/, events AS \([\s\S]*?\), (?:periods|counts) AS/,oldEvents)};
});
const variants={baseline,narrow,lateral},timings={baseline:[],narrow:[],lateral:[]};
const normalize=v=>JSON.stringify(v,(_,value)=>typeof value==='string'&&/^-?\d+(\.\d+)?$/.test(value)?Number(value):value);
let expected;
for(let round=0;round<8;round++)for(const name of (round%2?['lateral','narrow','baseline']:['baseline','narrow','lateral'])){
const start=performance.now();const result=await Promise.all(variants[name].map(async q=>(await pool.query(q.sql,q.parameters)).rows));
if(!expected)expected=normalize(result);else if(normalize(result)!==expected)throw Error('Report variant differs: '+name);
if(round)timings[name].push(performance.now()-start);
}
const plans={};for(const [name,queries]of Object.entries(variants)){plans[name]=[];for(const i of[1,3]){const p=(await pool.query('EXPLAIN (ANALYZE,BUFFERS,FORMAT JSON) '+queries[i].sql,queries[i].parameters)).rows[0]['QUERY PLAN'][0];plans[name].push({query:i,executionMs:p['Execution Time'],tempReadBlocks:p.Plan['Temp Read Blocks'],tempWrittenBlocks:p.Plan['Temp Written Blocks']});}}
const result={sameResults:true,rounds:7,mediansMs:Object.fromEntries(Object.entries(timings).map(([k,v])=>[k,median(v)])),timings,plans};
fs.writeFileSync('ai/audits/report-plan-validation-2026-11-01.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}finally{await pool.end()}})().catch(e=>{console.error(e.message);process.exitCode=1});
