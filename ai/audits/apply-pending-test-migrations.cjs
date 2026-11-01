const fs=require('fs');
module.exports=async function(client){
const applied=new Set((await client.query('SELECT filename FROM dorify.dori_schema_migration')).rows.map(r=>r.filename));
for(const f of fs.readdirSync('src/core/database/sql/migrations').filter(x=>/^0(1[6-9]|2[01])_/.test(x)).sort())
 if(!applied.has(f))await client.query(fs.readFileSync('src/core/database/sql/migrations/'+f,'utf8'));
};
