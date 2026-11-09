import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

const output = path.resolve("output/playwright");
const screens = [["main", "Сегодня"], ["workouts", "Тренировки"], ["nutrition", "Питание"], ["progress", "Прогресс"], ["cabinet", "Кабинет"]];
const views = [];
for (const theme of ["light", "dark"]) {
  for (const [key, label] of screens) {
    const images = await Promise.all(["reference", "fidelity"].map(async prefix => {
      const data = await readFile(path.join(output, `${prefix}-${theme}-${key}.png`));
      return `data:image/png;base64,${data.toString("base64")}`;
    }));
    views.push(`<section data-theme="${theme}" data-screen="${key}" hidden><h2>${label} · ${theme === "dark" ? "Тёмная" : "Светлая"} тема</h2><div class="pair"><figure><figcaption>Исходный HTML-макет</figcaption><img src="${images[0]}" alt="Макет: ${label}"></figure><figure><figcaption>Работающий React-интерфейс</figcaption><img src="${images[1]}" alt="Приложение: ${label}"></figure></div></section>`);
  }
}
await mkdir(output, { recursive: true });
await writeFile(path.join(output, "client-mockup-comparison.html"), `<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Zmena — сравнение с макетом</title><style>body{margin:0;background:#e9eef2;color:#17242c;font:15px system-ui}header{padding:20px;position:sticky;top:0;background:#f8fafbeF;backdrop-filter:blur(20px);z-index:2}h1{font-size:22px;margin:0 0 8px}p{max-width:850px;line-height:1.5}nav{display:flex;gap:8px;flex-wrap:wrap}button,select{font:inherit;border:1px solid #bbcbd3;border-radius:12px;padding:10px;background:white;color:inherit}button[aria-pressed=true]{background:#326f77;color:white}main{padding:0 20px 30px}h2{font-size:19px}.pair{display:flex;gap:24px;align-items:flex-start;flex-wrap:wrap}figure{margin:0;width:402px;max-width:100%}figcaption{margin:0 0 10px;font-weight:600}img{display:block;width:100%;border-radius:16px;box-shadow:0 8px 30px #17394720}section[hidden]{display:none}</style><header><h1>Пять клиентских страниц: макет и приложение</h1><p>Снимки сделаны при одинаковом размере 402 × 874. Справа используются реальные компоненты с тестовыми данными: даты, имена, числа, задачи и состояния могут отличаться от примера в макете. Эти снимки не подтверждают остальные окна и сценарии приложения.</p><nav><select aria-label="Тема"><option value="light">Светлая</option><option value="dark">Тёмная</option></select>${screens.map(([key,label])=>`<button data-page="${key}" aria-pressed="false">${label}</button>`).join("")}</nav></header><main>${views.join("")}</main><script>let screen='main';const select=document.querySelector('select');function update(){document.querySelectorAll('section').forEach(s=>s.hidden=s.dataset.screen!==screen||s.dataset.theme!==select.value);document.querySelectorAll('[data-page]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.page===screen))}select.onchange=update;document.querySelectorAll('[data-page]').forEach(b=>b.onclick=()=>{screen=b.dataset.page;update()});update()</script></html>`);
console.log(path.join(output, "client-mockup-comparison.html"));
