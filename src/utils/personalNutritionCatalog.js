let worker;
let serial = 0;
const pending = new Map();
function getWorker() {
  if (!worker) {
    worker = new Worker(new URL("./personalNutritionCatalog.worker.js", import.meta.url), {type:"module"});
    worker.onmessage = ({data}) => {
      const request = pending.get(data.id);
      if (!request) return;
      if (data.error) request.reject(new Error(data.error)); else request.resolve(data.foods);
    };
    worker.onerror = () => {
      for (const request of [...pending.values()]) request.reject(new Error("Не удалось загрузить каталог"));
      worker.terminate(); worker = null;
    };
  }
  return worker;
}
export function searchPersonalNutritionCatalog(query, {signal} = {}) {
  if (signal?.aborted) return Promise.reject(new DOMException("Aborted", "AbortError"));
  return new Promise((resolve,reject) => {
    const id = ++serial;
    const finish = (fn,value) => {clearTimeout(timer);pending.delete(id);signal?.removeEventListener("abort",abort);fn(value);};
    const abort = () => {worker?.postMessage({cancel:id});finish(reject,new DOMException("Aborted", "AbortError"));};
    const timer = setTimeout(()=>finish(reject,new Error("Не удалось загрузить каталог за 12 секунд")),12000);
    pending.set(id,{resolve:value=>finish(resolve,value),reject:error=>finish(reject,error)});
    signal?.addEventListener("abort",abort,{once:true});
    try {getWorker().postMessage({id,query});} catch(error) {finish(reject,error);}
  });
}
export function warmPersonalNutritionCatalog() {return searchPersonalNutritionCatalog("").catch(()=>{});}
