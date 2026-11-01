require('ts-node/register/transpile-only');
const fs=require('fs'),{Client}=require('pg');
const {NotificationWorkerRepository}=require('../../src/workers/notification-worker/notification-worker.repository');
const client=new Client({connectionString:require('./audit-database.cjs')(),statement_timeout:30000});
(async()=>{await client.connect();try{
let statement;await new NotificationWorkerRepository({transaction:async work=>work({query:async(sql,params)=>{statement={sql,params};return[]}})}).claimPending(new Date());
await client.query('BEGIN');await client.query('DROP INDEX dorify.idx_notification_direct_pending');await client.query('SAVEPOINT sample');
const before=(await client.query('EXPLAIN (ANALYZE,BUFFERS,FORMAT JSON) '+statement.sql,statement.params)).rows[0]['QUERY PLAN'][0];
await client.query('ROLLBACK TO SAVEPOINT sample');
await client.query(fs.readFileSync('src/core/database/sql/migrations/016_audit_operational_indexes.sql','utf8'));
const after=(await client.query('EXPLAIN (ANALYZE,BUFFERS,FORMAT JSON) '+statement.sql,statement.params)).rows[0]['QUERY PLAN'][0];
const summarize=p=>({executionMs:p['Execution Time'],returned:p.Plan['Actual Rows'],sharedHitBlocks:p.Plan['Shared Hit Blocks'],indexes:JSON.stringify(p).match(/idx_notification[^" ]+/g)||[]});
if(!JSON.stringify(after).includes('idx_notification_direct_pending'))throw Error('Claim query did not use targeted index');
const result={transactionRolledBack:true,query:'actual claimPending with SKIP LOCKED and processing lease',before:summarize(before),after:summarize(after)};
await client.query('ROLLBACK');fs.writeFileSync('ai/audits/notification-claim-validation-2026-11-01.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}catch(e){await client.query('ROLLBACK');throw e}finally{await client.end()}})().catch(e=>{console.error(e.code||e.message);process.exitCode=1});
