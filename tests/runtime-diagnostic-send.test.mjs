import test from "node:test";
import assert from "node:assert/strict";
import {installRuntimeImports} from "./helpers/runtime-imports.mjs";
import {createRuntimeDiagnostic} from "../src/utils/runtimeDiagnostics.js";

test("отчёт отправляется только от исходного аккаунта, повторы не меняют обработанный отчёт",async()=>{
  const auth={currentUser:{uid:"client-a"}},writes=[];
  let exists=false, switchAccount=false;
  const cleanup=installRuntimeImports({"/firebase.js":{auth,db:{}},"firebase/firestore":{
    doc:(_db,...segments)=>segments.join("/"),
    getDoc:async()=>{if(switchAccount)auth.currentUser={uid:"client-b"};return{exists:()=>exists};},
    setDoc:async(path,value)=>{writes.push({path,value});exists=true;}
  }});
  try{
    const {sendRuntimeDiagnostic}=await import("../src/utils/sendRuntimeDiagnostic.js");
    const diagnostic=createRuntimeDiagnostic(new TypeError("Cannot read properties of null (reading 'foods')"),{feature:"nutrition",version:"3.0.929",id:"same-report"});
    await sendRuntimeDiagnostic(diagnostic,"client-a");
    await sendRuntimeDiagnostic(diagnostic,"client-a");
    assert.equal(writes.length,1);assert.equal(writes[0].path,"users/client-a/feedback/runtime_same-report");
    assert.equal(writes[0].value.recipient,"admin");assert.equal(writes[0].value.source,"runtime-error-report");
    assert.equal(writes[0].value.email,"");assert.deepEqual(writes[0].value.attachments,[]);
    auth.currentUser={uid:"client-b"};await assert.rejects(sendRuntimeDiagnostic(diagnostic,"client-a"));assert.equal(writes.length,1);
    auth.currentUser={uid:"client-a"};exists=false;switchAccount=true;
    await assert.rejects(sendRuntimeDiagnostic(diagnostic,"client-a"));assert.equal(writes.length,1);
  }finally{cleanup();}
});
