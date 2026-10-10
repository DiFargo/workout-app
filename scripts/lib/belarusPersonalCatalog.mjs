// Shared by the standalone catalogue and its focused tests. No network calls.
export const brandGroups = [
  ['савушкин', 'савушкин продукт', 'savushkin'], ['теос', 'teos'],
  ['экспонента', 'exponenta'], ['брест литовск', 'брест литовский', 'brest litovsk'],
  ['санта бремор', 'santa bremor'], ['коммунарка', 'kommunarka'],
  ['спартак', 'spartak'], ['бонфесто', 'bonfesto'], ['камако', 'kamako'],
  ['абс', 'авс', 'abc'], ['бабушкина крынка', 'babushkina krynka'],
  ['молочный мир', 'molochny mir'], ['беллакт', 'bellakt'], ['петруха', 'petruha'],
  ['онега', 'onega'], ['рогачев', 'рогачевъ', 'rogachev'], ['витьба', 'vitba'],
  ['кофе саунд', 'кофесаунд', 'coffeesound'], ['параграф', 'paragraph'],
];
export function normalize(value) {
  return String(value ?? '').normalize('NFKC').toLowerCase().replaceAll('ё', 'е')
    .replace(/(\d),(\d)/g, '$1.$2').replace(/[^\p{L}\p{N}.%]+/gu, ' ').trim().replace(/\s+/g, ' ');
}
export function canonicalBrand(value) {
  const n = normalize(value);
  return brandGroups.find(g => g.includes(n))?.[0] ?? n;
}
export function identity(row) {
  // Pack variants share a card; member records retain their sizes and original nutrition.
  // This grouping does not infer or change the nutrition basis.
  let name = normalize(row.name);
  name = name.replace(/\b\d+(?:\.\d+)?\s*(?:кг|мл|гр|г|л)(?=\s|$)/g, '').replace(/(?:^|\s)(?:упаковка|упаковке|фасовка|фасовке)(?=\s|$)/g,'');
  const brand = canonicalBrand(row.brand);
  for (const word of brand.split(' ').filter(Boolean)) name = name.split(' ').filter(t => t !== word).join(' ');
  return `${brand}|${name.replace(/\s+/g, ' ').trim()}`;
}
const categories = [
  ['Детское питание', /детск|малыш|фрутонян|топтыш|агуша|прикорм/],
  ['Спортивное питание', /протеин|protein|гейнер|изолят|bcaa/],
  ['Кофе и чай', /кофе|капуч|латте|эспресс|американо|раф |цикор|чай |матча/],
  ['Рыба и морепродукты', /рыб|треск|скумбр|сельд|селед|лосос|семг|горбуш|тунец|тунца|минта|кильк|шпрот|икра (?!из|кабач|баклаж)|мид|кревет|кальмар|хек|форель|морепродукт|краб|сардин|сайр|мойв|судак|окун/],
  ['Мясо и птица', /мяс|кури|цыпл|индей|индюш|говяд|свин|свини|ветчин|колбас|сосиск|сардель|полендв|балык|бекон|паштет|баран|крол|фарш|грудк|бужен/],
  ['Молочные продукты и сыры', /молок|молоч|кефир|йогурт|творо|сыр|сметан|сливк|сливочн.*масло|масло.*сливочн|ряжен|простокваш|айран|тан |рикотт|моцарел|маскарпон|брынз|скыр/],
  ['Хлеб и выпечка', /хлеб|булк|булоч|батон|лаваш|багет|круассан|сдоба|сушк|баранк/],
  ['Крупы, макароны и бакалея', /круп|хлопь|геркулес|овсян|греч|рис|макарон|спагет|паст[аы] |мука|муки|кускус|булгур|перлов|киноа|манн|мюсли|гранол|крахмал|отруб|сахар|соль|соли|пшен|чечевиц/],
  ['Овощи, грибы и зелень', /овощ|капуст|картоф|морков|свекл|огур|томат|помидор|кабач|баклаж|брокк|шампин|гриб|шпинат|петруш|укроп|зелень|тыкв|сельдер|лук |перец/],
  ['Фрукты и ягоды', /яблок|банан|апельсин|мандарин|авокад|лимон|груш|киви|манго|ананас|ягод|клубник|малин|черник|голубик|клюкв|виноград|абрикос|персик/],
  ['Орехи, семена и сухофрукты', /орех|семеч|семен|арахис|фисташ|миндал|фундук|кунжут|урбеч|кешью|сухофрукт|кураг|изюм|финик|чернослив/],
  ['Яйца и масла', /яйц|яич|масло|маргарин/],
  ['Напитки', /сок|нектар|вод[аы]|квас|лимонад|напиток|напитк|кола|энергет|компот|морс|кисель/],
  ['Соусы и приправы', /соус|кетчуп|майонез|горчиц|хрен|приправ|специ|уксус|паприк/],
  ['Сладости и десерты', /шоколад|конфет|печенье|печенья|вафл|зефир|пастил|мармелад|халв|козинак|морожен|пирож|торт|кекс|пряник|карамел|ирис|драже|десерт|джем|варенье|мед|батончик/],
  ['Снеки', /чипс|сухарик|крекер|попкорн|снек|палочк|соломк/],
];
export function categorize(name, original = '') {
  const n = normalize(name);
  if (/пицц|ролл|бургер|шаурм|суши|додстер|воппер|твистер/.test(n)) return 'Рестораны и фастфуд';
  if (/горошек|кукуруз.*консерв|фасоль.*соус|лечо|аджик/.test(n)) return 'Овощные консервы';
  if (/сервелат|салями|сальтисон/.test(n)) return 'Мясо и птица';
  if (/суп |борщ|солянк|рассольник|котлет|запекан|салат|плов|омлет|блин|пельмен|вареник|драник|сырник/.test(n)) return 'Блюда и полуфабрикаты';
  if (/морожен|десерт|пирож|торт|печенье|печенья|конфет|шоколад|вафл|зефир|мармелад|пастил/.test(n)) return 'Сладости и десерты';
  if (/^(сок|нектар|напиток|коктейль|вода|квас)\s/.test(n) && !/кисломолоч|йогурт|молоч|protein/.test(n)) return 'Напитки';
  if (/^(соус|майонез|кетчуп|горчица|хрен)\s/.test(n)) return 'Соусы и приправы';
  if (/орех|семеч|семена|арахис|фисташ|миндаль|фундук|кунжут|урбеч|кешью/.test(n) && !/сыр|хлеб|молок/.test(n)) return 'Орехи, семена и сухофрукты';
  return categories.find(([, re]) => re.test(n))?.[0] ?? (/готов|домашн/.test(normalize(original)) ? 'Блюда и полуфабрикаты' : 'Другие продукты');
}
export function validGtin(code) {
  return /^(\d{8}|\d{12}|\d{13}|\d{14})$/.test(code) && Number(code.at(-1)) ===
    (10 - [...code.slice(0, -1)].reverse().reduce((s, d, i) => s + Number(d) * (i % 2 ? 1 : 3), 0) % 10) % 10;
}
export function nutritionProblems(n) {
  const v = [n.kcal, n.protein, n.fat, n.carbs];
  if (!v.every(x => Number.isFinite(x) && x >= 0)) return ['invalid_number'];
  if (n.basis === 'unknown') return [];
  const issues = [];
  if (n.kcal > 950 || v.slice(1).some(x => x > 100) || v.slice(1).reduce((a, b) => a + b, 0) > 105) issues.push('impossible_per_100');
  if (Math.abs(4*n.protein + 9*n.fat + 4*n.carbs - n.kcal) > Math.max(60, n.kcal * 0.3)) issues.push('energy_outlier');
  return issues;
}
export function portionNutrition(row, amount) {
  if (row.nutrition.basis === 'unknown' || row.nutritionConflict || !Number.isFinite(amount) || amount <= 0) return null;
  return Object.fromEntries(['kcal','protein','fat','carbs'].map(k => [k, Math.round(row.nutrition[k] * amount) / 100]));
}
const equivalents = [
  ...brandGroups, ['курица','куриная','куриный','куриного','цыпленка','цыпленок'],
  ['грудка','грудки','грудку'], ['гречка','гречневая','гречневые','гречневая'],
  ['овсянка','овсяные','овсяная','геркулес'], ['творог','творога','творожный'],
  ['сырой','сырое','сырая','сырые'], ['вареный','вареное','отварной','отварная','отварное'],
  ['готовый','готовая','готовое','готовые'], ['арахис','арахисовая','арахисовый'],
];
function expandTokens(text) {
  let n = normalize(text);
  for (const g of equivalents) if (g.some(s => (` ${n} `).includes(` ${s} `))) n += ` ${g.join(' ')}`;
  return [...new Set(n.split(' ').filter(Boolean))];
}
function keyboard(text) {
  const en = 'qwertyuiop[]asdfghjkl;\'zxcvbnm,.';
  const ru = 'йцукенгшщзхъфывапролджэячсмитьбю';
  return text.toLowerCase().split('').map(c => en.includes(c) ? ru[en.indexOf(c)] : c).join('');
}
function oneTypo(a,b) {
  if (Math.abs(a.length-b.length)>1) return false;
  let i=0,j=0,errors=0;
  while(i<a.length && j<b.length) { if(a[i]===b[j]) {i++;j++;continue;} if(++errors>1)return false;
    if(a.length===b.length){ if(a[i]===b[j+1]&&a[i+1]===b[j]){i+=2;j+=2;} else {i++;j++;} }
    else if(a.length>b.length)i++;else j++;
  }
  return errors+(i<a.length||j<b.length?1:0)<=1;
}
export function createSearch(rows) {
  const index = new Map(), prefixes = new Map(), barcodeIndex=new Map();
  const docs = rows.map((r,i) => {
    const tokens = expandTokens([r.name,r.brand,...r.aliases].join(' '));
    for(const token of tokens){
      if(!index.has(token))index.set(token,new Set());index.get(token).add(i);
      for(let length=1;length<=Math.min(8,token.length);length++){
        const prefix=token.slice(0,length);if(!prefixes.has(prefix))prefixes.set(prefix,new Set());prefixes.get(prefix).add(i);
      }
    }
    for(const code of r.barcodes)barcodeIndex.set(code,i);
    return {tokens, text:normalize(`${r.name} ${r.brand}`)};
  });
  const vocabulary=[...index.keys()],cache=new Map();
  return (query='', {category='',market='',source='',limit=40,offset=0}={}) => {
    const raw=normalize(query).slice(0,128), q=raw.split(' ').filter(Boolean);
    const passes = r => (!category||r.category===category)&&(!market||r.market===market)&&(!source||r.sourceType===source);
    if (/^\d{8,14}$/.test(raw)) {const r=rows[barcodeIndex.get(raw)]; return {total:r&&passes(r)?1:0,items:r&&passes(r)?[r]:[],corrected:false};}
    const scoreMatches=(tokens, fuzzy=false)=>{
      let candidates=null;
      for(const token of tokens) {
        const ids=new Set();
        const alternatives=expandTokens(token);
        for(const a of alternatives) {
          const matches=prefixes.get(a.slice(0,8))??[];
          for(const i of matches) if(a.length<=8||docs[i].tokens.some(t=>t.startsWith(a)))ids.add(i);
          if(fuzzy&&a.length>=5) for(const t of vocabulary) if(oneTypo(a,t))for(const i of index.get(t))ids.add(i);
        }
        candidates=candidates===null?ids:new Set([...candidates].filter(i=>ids.has(i)));
        if(!candidates.size)break;
      }
      return [...(candidates??rows.map((_,i)=>i))].filter(i=>passes(rows[i]));
    };
    const cacheKey=JSON.stringify([raw,category,market,source]);
    if(cache.has(cacheKey)){const {candidates,corrected}=cache.get(cacheKey);return {total:candidates.length,items:candidates.slice(offset,offset+limit).map(i=>rows[i]),corrected};}
    let candidates=scoreMatches(q),corrected=false;
    if(!candidates.length && raw) {const k=normalize(keyboard(query)).split(' ');candidates=scoreMatches(k);corrected=!!candidates.length;}
    if(!candidates.length && raw) {candidates=scoreMatches(q,true);corrected=!!candidates.length;}
    const score=i=>(raw&&docs[i].text.startsWith(raw)?150:0)+(raw&&docs[i].text.includes(raw)?80:0)+q.filter(t=>docs[i].tokens.includes(t)).length*30+(rows[i].market==='BY'?25:0)+(rows[i].sourceType==='openfoodfacts'?4:0)-rows[i].name.length/100;
    const scores=new Map(candidates.map(i=>[i,score(i)]));
    candidates.sort((a,b)=>scores.get(b)-scores.get(a)||rows[a].id.localeCompare(rows[b].id));
    if(cache.size>=150)cache.delete(cache.keys().next().value);cache.set(cacheKey,{candidates,corrected});
    return {total:candidates.length,items:candidates.slice(offset,offset+limit).map(i=>rows[i]),corrected};
  };
}
