require('ts-node/register/transpile-only');
const fs=require('fs'),path=require('path'),{Client}=require('pg');
const {runMigrations}=require('../../src/core/database/migration-runner');
const target=process.env.DORI_AUDIT_TARGET||'configured database';
const client=new Client({connectionString:require('./audit-database.cjs')(),statement_timeout:120000});
(async()=>{await client.connect();try{
const prior=await client.query('SELECT filename FROM dorify.dori_schema_migration ORDER BY filename');
if(!prior.rows.some(r=>r.filename==='015_rename_free_tier_basic.sql'))throw Error('Migration 015 must already be registered; no initialization or seeding allowed');
const connection={query:async(sql,args)=>(await client.query(sql,args)).rows,transaction:async work=>{await client.query('BEGIN');try{const result=await work(connection);await client.query('COMMIT');return result}catch(e){await client.query('ROLLBACK');throw e}}};
const applied=[];await runMigrations(connection,path.resolve('src/core/database/sql/migrations'),message=>applied.push(message));
const result={target,applied,migrations:(await client.query('SELECT filename FROM dorify.dori_schema_migration ORDER BY filename')).rows.map(r=>r.filename),contract:(await client.query("SELECT to_regprocedure('dorify_agent.refresh_tracking(timestamp with time zone)') IS NOT NULL AS ready")).rows[0].ready,extensionInstalled:(await client.query("SELECT EXISTS(SELECT 1 FROM pg_extension WHERE extname='pg_stat_statements') AS ready")).rows[0].ready};
try{result.queryStatisticsAvailable=(await client.query('SELECT COUNT(*)::int AS n FROM public.pg_stat_statements')).rows[0].n>=0}catch{result.queryStatisticsAvailable=false}
fs.writeFileSync('ai/audits/migrations-'+target+'-validation-2026-11-01.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}finally{await client.end()}})().catch(e=>{console.error('Migration validation failed: '+(e.code||e.message));process.exitCode=1});
