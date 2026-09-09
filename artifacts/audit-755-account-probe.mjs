import fs from 'node:fs/promises';
import vm from 'node:vm';
const source=await fs.readFile('functions/index.js','utf8');
const start=source.indexOf('export const profileUpdateEmail =');
const end=source.indexOf('\nexport const ',start+1);
let changed=null;const writes=[];
const database={collection:name=>({doc:id=>({name,id})}),batch:()=>({set:(ref,data)=>writes.push({ref,data}),delete:ref=>writes.push({delete:ref}),commit:async()=>{}})};
const ctx=vm.createContext({console,Date,Map,Set,Promise,
  onRequest:(_,fn)=>fn,json:(_,status,data)=>({status,data}),
  requireActiveMember:async()=>({uid:'synthetic-user',token:{auth_time:1},userData:{email:'old@example.test',loginLower:'old',accountProfile:{}}}),
  enforceRateLimit:async()=>{},normalizeAccountEmail:x=>String(x||'').toLowerCase(),normalizeLoginAlias:x=>String(x||'').toLowerCase(),getDefaultLoginAliasForEmail:x=>x.split('@')[0],getHttpErrorStatus:()=>500,
  admin:{auth:()=>({getUser:async()=>({email:'old@example.test'}),getUserByEmail:async()=>null,updateUser:async(uid,data)=>{changed={uid,...data};}}),firestore:()=>database}
});
vm.runInContext(source.slice(start,end).replace('export const','var'),ctx);
const result=await ctx.profileUpdateEmail({method:'POST',body:{email:'new@example.test'}},{});
const accessStart=source.indexOf('function isAssignedTrainerData(');
const accessEnd=source.indexOf('\nfunction normalizeAdminUserId',accessStart);
vm.runInContext(source.slice(accessStart,accessEnd),ctx);
const revokedAllowed=ctx.isAssignedTrainerData({trainerAssignmentState:'revoked',createdByUid:'old-trainer'},'old-trainer');
const output={environment:'synthetic; no network/production writes',oldAuthTime:1,response:result.status,accountChanged:Boolean(changed),revokedLegacyTrainerAllowed:revokedAllowed};
await fs.writeFile('artifacts/audit-755-account-results.json',JSON.stringify(output,null,2));console.log(JSON.stringify(output,null,2));
