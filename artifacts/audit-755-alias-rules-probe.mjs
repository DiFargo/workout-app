import fs from 'node:fs/promises';
import {initializeTestEnvironment} from '@firebase/rules-unit-testing';
import {doc,setDoc,updateDoc} from 'firebase/firestore';
const env=await initializeTestEnvironment({projectId:'demo-workout-audit',firestore:{host:'127.0.0.1',port:8080,rules:await fs.readFile('firestore.rules','utf8')}});
try {
  await env.withSecurityRulesDisabled(async ctx=>setDoc(doc(ctx.firestore(),'users/alias-audit'),{role:'client',active:true,loginLower:'own-alias'}));
  await updateDoc(doc(env.authenticatedContext('alias-audit').firestore(),'users/alias-audit'),{loginLower:'victim-alias',accountProfile:{login:'victim-alias'}});
  console.log(JSON.stringify({id:'ALIAS-OWNER-WRITE',allowed:true,environment:'emulator only'}));
} finally {await env.cleanup();}
