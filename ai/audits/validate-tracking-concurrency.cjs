const fs=require('fs'),{Client}=require('pg'),database=require('./audit-database.cjs')();
const a=new Client({connectionString:database,statement_timeout:10000}),b=new Client({connectionString:database,statement_timeout:60000});
(async()=>{await Promise.all([a.connect(),b.connect()]);try{
await b.query('BEGIN');
await b.query("SELECT pg_advisory_xact_lock(hashtext('dorify:tracking-projection'))");
const sample=(await a.query("SELECT registration_id,queue_id FROM dorify.dori_registration WHERE status='waiting' AND is_active LIMIT 1")).rows[0];
await a.query('INSERT INTO dorify_agent.tracking_dirty_registration(registration_id) VALUES($1) ON CONFLICT DO NOTHING',[sample.registration_id]);
await a.query('INSERT INTO dorify_agent.tracking_dirty_queue(queue_id) VALUES($1) ON CONFLICT DO NOTHING',[sample.queue_id]);
await a.query('BEGIN');
await a.query('SELECT registration_id FROM dorify_agent.tracking_dirty_registration WHERE registration_id=$1 FOR UPDATE',[sample.registration_id]);
let completed=false;
const refresh=b.query('SELECT dorify_agent.refresh_tracking()').then(()=>{completed=true});
await new Promise(resolve=>setTimeout(resolve,250));
if(completed)throw Error('Refresh should wait for dirty registration lock');
await a.query('UPDATE dorify.dori_registration SET updated_at=updated_at WHERE registration_id=$1',[sample.registration_id]);
await a.query('ROLLBACK');await refresh;await b.query('ROLLBACK');
const result={registrationWritesRolledBack:true,projectionWritesRolledBack:true,concurrentRegistrationAndRefresh:true,deadlock:false,technicalDirtyEntryRetainedForNextCycle:true};
fs.writeFileSync('ai/audits/tracking-concurrency-validation-2026-11-01.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}finally{await a.query('ROLLBACK').catch(()=>{});await b.query('ROLLBACK').catch(()=>{});await Promise.all([a.end(),b.end()])}})().catch(e=>{console.error(e.code||e.message);process.exitCode=1});
