let sequence=0;
const records=[{id:"draft-demo",managedBy:"admin-basic-catalog",title:"Подготовка к сезону",description:"Два занятия в неделю",status:"draft",version:1,workouts:[{name:"День 1",exercises:[{name:"Приседания",sets:3,reps:12}]}],updatedAt:"2026-09-14"}];
export const collection=(parent,...parts)=>({path:[parent.path,...parts].filter(Boolean).join("/")});
export const doc=(parent,...parts)=>({path:[parent.path,...parts.length?parts:["new-"+(++sequence)]].filter(Boolean).join("/"),id:parts.at(-1)||"new-"+sequence});
export const serverTimestamp=()=>new Date().toISOString();
export const getDocs=async ref=>{
  (window.__adminReads ||= []).push(ref.path);
  const rows=ref.path.endsWith("items")?records:[];
  const docs=rows.map(row=>({id:row.id,data:()=>row}));
  return {docs,forEach:fn=>docs.forEach(fn)};
};
export const setDoc=async(ref,data)=>{(window.__adminWrites ||= []).push({path:ref.path,data})};
export const writeBatch=()=>{
  const writes=[];
  return {set:(ref,data)=>writes.push({path:ref.path,data}),commit:async()=>{(window.__adminWrites ||= []).push(...writes)}};
};
