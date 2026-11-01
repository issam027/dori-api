require('dotenv').config({quiet:true});
module.exports=function auditDatabase(){
 const value=process.env.DORI_AUDIT_DATABASE_URL||process.env.DATABASE_URL;
 if(!value)throw Error('Set DORI_AUDIT_DATABASE_URL or DATABASE_URL');
 const url=new URL(value);
 if(process.env.DORI_AUDIT_DATABASE_PORT)url.port=process.env.DORI_AUDIT_DATABASE_PORT;
 return url.toString();
};
