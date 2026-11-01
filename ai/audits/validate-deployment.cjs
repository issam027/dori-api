const fs=require('fs'),http=require('http'),zlib=require('zlib'),{Client}=require('pg');
function request(url,headers={}){return new Promise((resolve,reject)=>{const req=http.get(url,{headers},res=>{const chunks=[];res.on('data',b=>chunks.push(b));res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,body:Buffer.concat(chunks)}));res.on('error',reject)});req.setTimeout(10000,()=>req.destroy(new Error('HTTP timeout')));req.on('error',reject)})}
async function streamHeaders(url,headers){return new Promise((resolve,reject)=>{const req=http.get(url,{headers},res=>{resolve({status:res.statusCode,contentType:res.headers['content-type'],encoding:res.headers['content-encoding']||null,cacheControl:res.headers['cache-control']});res.destroy();req.destroy()});req.setTimeout(20000,()=>req.destroy(new Error('SSE timeout')));req.on('error',reject)})}
(async()=>{const result={static:[],health:[],sse:null,agent:null};
for(const port of[18080,58080]){
 const base='http://localhost:'+port,html=(await request(base)).body.toString();
 const js=html.match(/<script[^>]*src="([^"]+\.js)"/)[1],css=html.match(/<link[^>]*href="([^"]+\.css)"/)[1];
 for(const asset of[js,css]){const plain=await request(base+asset,{'Accept-Encoding':'identity'}),gzip=await request(base+asset,{'Accept-Encoding':'gzip'});
  if(plain.status!==200||gzip.status!==200||gzip.headers['content-encoding']!=='gzip'||!String(gzip.headers.vary).includes('Accept-Encoding'))throw Error('Static compression or Vary missing');
  if(!zlib.gunzipSync(gzip.body).equals(plain.body))throw Error('Compressed asset differs');
  result.static.push({port,type:asset.endsWith('.js')?'javascript':'css',identityBytes:plain.body.length,gzipBytes:gzip.body.length,encoding:gzip.headers['content-encoding'],vary:gzip.headers.vary});
 }
}
for(const port of[13000,53000,18080,58080]){const response=await request('http://localhost:'+port+'/api/v1/monitoring/health');if(response.status!==200)throw Error('Unhealthy API '+port);result.health.push({port,status:response.status});}
const response=await request('http://localhost:13100/healthz');if(response.status!==200)throw Error('Agent unhealthy');const status=JSON.parse(response.body).agent;
result.agent={status:response.status,deploymentStatus:status.deploymentStatus,lastCloudError:status.lastCloudError,heartbeatAgeMs:status.heartbeatAgeMs,lastTrackingBatchCount:status.lastTrackingBatchCount,lastTrackingProjectionCount:status.lastTrackingProjectionCount,synchronization:status.synchronization};
const client=new Client({connectionString:require('./audit-database.cjs')()});await client.connect();try{
const sample=(await client.query('SELECT queue_id,registration_tracking_token FROM dorify.dori_registration WHERE registration_tracking_token_valid_until>CURRENT_TIMESTAMP AND is_active LIMIT 1')).rows[0];
if(!sample)throw Error('No valid tracking sample');
result.sse=await streamHeaders('http://localhost:18080/api/v1/realtime/queues/'+sample.queue_id+'/tracking',{'X-Registration-Token':sample.registration_tracking_token,'Accept-Encoding':'gzip'});
if(result.sse.status!==200||!result.sse.contentType?.includes('text/event-stream')||result.sse.encoding!==null)throw Error('SSE proxy compressed or unavailable');
result.queryStatisticsAvailable=(await client.query('SELECT COUNT(*)::int AS n FROM public.pg_stat_statements')).rows[0].n>=0;
}finally{await client.end()}
fs.writeFileSync('ai/audits/deployment-validation-2026-11-01.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
})().catch(e=>{console.error(e.code||e.message);process.exitCode=1});
