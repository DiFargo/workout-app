const $ = (selector) => document.querySelector(selector);
const icon = (name, className = '') => `<svg class="${className}" aria-hidden="true"><use href="#${name}"/></svg>`;
const escapeHtml = (text) => String(text).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const steps = [
  { key: 'goal', label: 'Цель', title: 'Для чего тебе<br>нужен план?', intro: 'Начнём с того, что важно именно тебе.', hint: 'Перетащи бегунок или нажми на отметку.', options: [
    { value: 'general_fitness', title: 'Хорошая форма', short: 'Форма', description: 'Сила, выносливость и хорошее самочувствие.', icon: 'heart' },
    { value: 'fat_loss', title: 'Снижение веса', short: 'Вес', description: 'Больше движения и посильная регулярная нагрузка.', icon: 'target' },
    { value: 'muscle', title: 'Набор мышц', short: 'Мышцы', description: 'Силовые упражнения и постепенное увеличение объёма.', icon: 'dumbbell' },
    { value: 'strength', title: 'Стать сильнее', short: 'Сила', description: 'Базовые движения и уверенная техника.', icon: 'chart' }
  ] },
  { key: 'level', label: 'Опыт', title: 'Какой у тебя опыт?', intro: 'Подберём понятный уровень нагрузки.', options: [
    { value: 'beginner', title: 'Я новичок', short: 'Новичок', description: 'Только начинаю или почти не тренировался раньше.', icon: 'sparkles' },
    { value: 'returning', title: 'Возвращаюсь', short: 'После паузы', description: 'Опыт есть, но сейчас возвращаюсь после перерыва.', icon: 'calendar' },
    { value: 'experienced', title: 'Есть опыт', short: 'Есть опыт', description: 'Регулярно тренируюсь и знаком с основными упражнениями.', icon: 'dumbbell' }
  ] },
  { key: 'location', label: 'Место', title: 'Где будем<br>тренироваться?', intro: 'Упражнения под доступное оборудование.', options: [
    { value: 'gym', title: 'В тренажёрном зале', short: 'В зале', description: 'Тренажёры, гантели и штанги под рукой.', icon: 'dumbbell' },
    { value: 'home', title: 'Дома', short: 'Дома', description: 'Вес тела, гантели или минимум оборудования.', icon: 'home' }
  ] },
  { key: 'days', label: 'Ритм', title: 'Сколько раз<br>в неделю?', intro: 'Выбери ритм, который легко поддерживать.', numeric: true, hint: 'Дни в календаре можно будет выбрать после подбора.', options: [1, 2, 3, 4, 5].map((n, i) => ({ value: String(n), title: `${n} ${n === 1 ? 'раз' : n === 5 ? 'раз' : 'раза'} в неделю`, short: String(n), number: n, unit: n === 1 || n === 5 ? 'раз' : 'раза', icon: 'calendar', description: ['Одно занятие в неделю — тоже начало.', 'Два занятия с перерывами между ними.', 'Три занятия, встроенные в твою неделю.', 'Четыре занятия с распределённой нагрузкой.', 'Пять занятий — план учтёт этот ритм.'][i] })) },
  { key: 'duration', label: 'Время', title: 'Сколько времени<br>на тренировку?', intro: 'Уложим занятие в твой график.', numeric: true, options: [30, 45, 60, 90].map((n) => ({ value: String(n), title: `${n} минут`, short: `${n} мин`, number: n, unit: 'мин', icon: 'clock', description: ({ 30: 'Короткое занятие с основными упражнениями.', 45: 'Время на разминку, упражнения и отдых.', 60: 'Полноценное занятие без лишней спешки.', 90: 'Больше времени на упражнения и отдых.' })[n] })) },
  { key: 'restrictions', label: 'Ограничения', title: 'Есть ли ограничения?', intro: 'При ограничениях нужен подбор с тренером.', options: [
    { value: 'none', title: 'Нет ограничений', description: 'Могу выполнять базовые упражнения' },
    { value: 'back', title: 'Спина', description: 'Нужен подбор с тренером' },
    { value: 'knees', title: 'Колени', description: 'Нужен подбор с тренером' },
    { value: 'shoulders', title: 'Плечи', description: 'Нужен подбор с тренером' },
    { value: 'other', title: 'Другое', description: 'Можно кратко описать ниже' }
  ] },
  { key: 'preferences', label: 'Пожелания', title: 'На чём сделать акцент?', intro: 'Выбери фокус. Остальное мы учтём в плане.' }
];
const emphasis = [
  { value: 'balanced', title: 'Всё тело', icon: 'target', hint: 'Равномерная работа на ноги и верх тела.' },
  { value: 'lower', title: 'Ноги и ягодицы', icon: 'dumbbell', hint: 'Больше внимания ногам и ягодицам. Верх тела остаётся в плане.' },
  { value: 'upper', title: 'Верх тела', icon: 'chart', hint: 'Больше внимания груди, спине и плечам. Ноги остаются в плане.' },
  { value: 'classic', title: 'По группам мышц', icon: 'calendar', hint: 'Отдельные мышечные группы в разные дни.' }
];
const defaults = { goal: 'general_fitness', level: 'beginner', location: 'gym', days: '3', duration: '45', restrictions: 'none', restrictionDetails: '', emphasis: 'balanced', preferences: '', twoDayStructure: 'recovery_split', specialStatus: '' };
let answers = { ...defaults };
let current = Math.max(0, Math.min(8, Number(new URLSearchParams(location.search).get('step')) - 1 || 0));
let editing = false;
let toastTimer;
const optionFor = (key) => steps.find((step) => step.key === key)?.options?.find((option) => option.value === answers[key]);
const focusOption = () => emphasis.find((option) => option.value === answers.emphasis);
const restricted = () => answers.restrictions !== 'none' || ['pregnant', 'postpartum', 'medical'].includes(answers.specialStatus);

function toast(message) {
  clearTimeout(toastTimer);
  $('#toast').textContent = message;
  $('#toast').hidden = false;
  toastTimer = setTimeout(() => { $('#toast').hidden = true; }, 3000);
}
function dialog(title, text, action, actionLabel = 'Понятно') {
  $('#dialog-content').innerHTML = `<button class="icon-button dialog-close" data-close-dialog aria-label="Закрыть окно">${icon('close')}</button><h2>${title}</h2><p>${text}</p><button class="primary" id="dialog-confirm">${actionLabel}</button><button class="secondary" data-close-dialog>Отмена</button>`;
  $('#dialog-confirm').onclick = () => { $('#dialog').close(); action?.(); };
  $('#dialog').showModal();
}
function goTo(index, fromReview = false) {
  editing = fromReview;
  current = index;
  render();
  $('#content').scrollTop = 0;
  $('#content h2')?.focus({ preventScroll: true });
}
function heading(step) {
  return `<div class="question-heading"><h2 tabindex="-1">${step.title}</h2><p>${step.intro}</p></div>`;
}
function sliderScreen(step) {
  const index = step.options.findIndex((option) => option.value === answers[step.key]);
  const selected = step.options[index];
  return `${heading(step)}<section class="answer-card ${step.numeric ? 'numeric' : step.key}" aria-label="Выбор ответа">
    <div class="answer-icon" id="answer-icon">${icon(selected.icon)}</div>
    <div id="answer-output" aria-live="polite" aria-atomic="true">${answerMarkup(step, selected)}</div>
    <div class="choice-slider" style="--fill:${index / (step.options.length - 1) * 100}%"><div class="slider-rail"></div><div class="slider-ticks" aria-hidden="true">${step.options.map((_, i) => `<i data-passed="${i <= index}"></i>`).join('')}</div><input type="range" min="0" max="${step.options.length - 1}" step="1" value="${index}" aria-label="${step.title.replace('<br>', ' ')}" aria-valuetext="${selected.title}" id="answer-slider"></div>
    <div class="stop-labels" style="--stops:${step.options.length}" role="group" aria-label="Варианты ответа">${step.options.map((option, i) => `<button data-stop="${i}" aria-label="${option.title}" aria-pressed="${i === index}">${option.short}</button>`).join('')}</div>
  </section>${step.hint ? `<p class="hint-line">${icon(step.key === 'days' ? 'calendar' : 'check')}<span>${step.hint}</span></p>` : ''}`;
}
function answerMarkup(step, option) {
  return `<div class="${step.numeric ? 'answer-number' : 'answer-title'}">${step.numeric ? `${option.number}<small>${option.unit}</small>` : option.title}</div><p class="answer-description">${option.description}</p>`;
}
function setSliderValue(index) {
  const step = steps[current];
  const option = step.options[index];
  answers[step.key] = option.value;
  $('#answer-slider').value = index;
  $('#answer-slider').setAttribute('aria-valuetext', option.title);
  $('#answer-icon').innerHTML = icon(option.icon);
  $('#answer-output').innerHTML = answerMarkup(step, option);
  $('.choice-slider').style.setProperty('--fill', `${index / (step.options.length - 1) * 100}%`);
  document.querySelectorAll('[data-stop]').forEach((button, i) => button.setAttribute('aria-pressed', String(i === index)));
  document.querySelectorAll('.slider-ticks i').forEach((tick, i) => { tick.dataset.passed = String(i <= index); });
}
function restrictionScreen() {
  const step = steps[5];
  return `${heading(step)}<div class="options" role="group" aria-label="Ограничения">${step.options.map((option) => `<button class="restriction" data-restriction="${option.value}" aria-pressed="${answers.restrictions === option.value}"><strong>${option.title}</strong><small>${option.description}</small>${answers.restrictions === option.value ? icon('check') : ''}</button>`).join('')}</div>${answers.restrictions === 'other' ? `<label class="field"><span class="field-label">Кратко опиши ограничение</span><textarea id="restriction-details" maxlength="180" required placeholder="Что важно учесть?">${escapeHtml(answers.restrictionDetails)}</textarea></label>` : ''}`;
}
function preferenceScreen() {
  return `${heading(steps[6])}<div class="preference-grid" role="group" aria-label="Акцент программы">${emphasis.map((option) => `<button class="preference" data-emphasis="${option.value}" aria-pressed="${answers.emphasis === option.value}">${icon(option.icon)}<strong>${option.title}</strong>${answers.emphasis === option.value ? icon('check', 'tiny-check') : ''}</button>`).join('')}</div><p class="preference-help" id="preference-help" aria-live="polite">${focusOption().hint}</p>
    ${answers.days === '2' && answers.emphasis === 'classic' ? `<label class="compact-select">Распределение двух тренировок<select id="two-day"><option value="recovery_split" ${answers.twoDayStructure === 'recovery_split' ? 'selected' : ''}>Больше восстановления</option><option value="balanced_full_body" ${answers.twoDayStructure === 'balanced_full_body' ? 'selected' : ''}>Всё тело в обе тренировки</option></select></label>` : ''}
    <label class="field"><span class="field-label">Что ещё учесть?<small>Необязательно</small></span><textarea id="preferences" maxlength="280" placeholder="Например, люблю тренажёры и гантели">${escapeHtml(answers.preferences)}</textarea></label><p class="hint-line">${icon('shield')}<span>Не добавляй личные контакты. Об ограничениях расскажи на предыдущем шаге.</span></p>`;
}
function reviewRow(label, value, index) {
  return `<button class="review-row" data-edit="${index}" aria-label="Изменить: ${label}"><span>${label}</span><strong>${escapeHtml(value)}</strong>${icon('chevron-right')}</button>`;
}
function reviewScreen() {
  return `${heading({ title: 'Всё верно?', intro: 'Нажми на ответ, если хочешь его изменить.' })}
    <div class="review-stats"><button class="stat" data-edit="3" aria-label="Изменить: Частота">${icon('edit')}<strong>${answers.days} ${answers.days === '1' || answers.days === '5' ? 'раз' : 'раза'}</strong><small>в неделю</small></button><button class="stat" data-edit="4" aria-label="Изменить: Время">${icon('edit')}<strong>${answers.duration} мин</strong><small>на тренировку</small></button></div>
    <div class="review-list">${reviewRow('Цель', optionFor('goal').title, 0)}${reviewRow('Опыт', optionFor('level').title, 1)}${reviewRow('Место', optionFor('location').short, 2)}${reviewRow('Акцент', focusOption().title, 6)}${reviewRow('Ограничения', optionFor('restrictions').title, 5)}${answers.preferences.trim() ? reviewRow('Пожелание', answers.preferences.trim(), 6) : ''}</div>
    <details class="profile"><summary>${icon('user')}<span><strong>Учтём данные профиля</strong><small>Пример: женщина · 29 лет · 168 см · 64 кг</small></span>${icon('chevron-right')}</summary><p>Это демонстрационные данные. В приложении здесь будут твой профиль и доступная история тренировок.</p><button class="secondary" id="edit-profile">Изменить данные профиля</button><label class="compact-select">Особые состояния<select id="special-status"><option value="">Не указано</option><option value="none">Нет</option><option value="pregnant">Беременность</option><option value="postpartum">Восстановление после родов</option><option value="medical">Ограничения врача / восстановление</option></select></label><p>Подбор использует профиль, ответы и историю упражнений. Имя, контакты, фотографии и переписка не передаются Gemini.</p></details>
    ${restricted() ? '<p class="warning">При этих ограничениях план нужно согласовать с тренером.</p>' : '<p class="privacy">Сначала покажем программу. Сохранение — отдельным шагом.</p>'}`;
}
function resultScreen() {
  const totalWorkouts = Number(answers.days) * 4;
  const workoutLabel = totalWorkouts === 4 ? 'тренировки' : 'тренировок';
  return `<div class="result-hero"><p class="demo-label">ПРИМЕР РЕЗУЛЬТАТА</p><div class="answer-icon">${icon('check')}</div><h2 tabindex="-1">Твой новый ритм</h2><p>Так будет выглядеть обзор программы после подбора.</p><div class="result-pill">${icon('calendar')}4 недели · ${totalWorkouts} ${workoutLabel}</div></div><section class="week-card"><strong>Твоя неделя</strong>${Array.from({ length: Number(answers.days) }, (_, i) => `<div class="week-row"><b>${i + 1}</b><span>Тренировка ${i + 1}</span><small>${answers.duration} мин</small></div>`).join('')}</section><p class="hint-line">${icon('shield')}<span>Это только макет обзора. Упражнения не генерировались, программа не сохранена.</span></p><button class="secondary" data-go-review>Изменить ответы</button>`;
}
function render() {
  $('#content').className = `content ${current === 6 ? 'preferences' : current === 7 ? 'review' : current === 8 ? 'result' : ''}`;
  $('#progress-wrap').hidden = current === 8;
  $('#step-label').textContent = current < 7 ? steps[current].label : 'Проверка ответов';
  $('#step-count').textContent = current < 7 ? `${current + 1} из 7` : 'Все ответы собраны';
  $('#progress-fill').style.width = `${Math.min(1, (current + 1) / 7) * 100}%`;
  $('#content').innerHTML = current < 5 ? sliderScreen(steps[current]) : current === 5 ? restrictionScreen() : current === 6 ? preferenceScreen() : current === 7 ? reviewScreen() : resultScreen();
  $('#footer-note').textContent = current === 6 ? 'Пожелание можно оставить пустым' : current === 7 ? 'Макет · без запроса к ИИ' : current === 8 ? 'Демонстрация · ничего не сохраняется' : '';
  $('#next').innerHTML = editing ? 'Сохранить ответ' : current < 6 ? `Далее ${icon('chevron-right')}` : current === 6 ? 'Проверить ответы' : current === 7 ? restricted() ? 'Обсудить с тренером' : `${icon('sparkles')} Посмотреть пример плана` : 'Завершить просмотр';
  $('#next').disabled = current === 5 && answers.restrictions === 'other' && !answers.restrictionDetails.trim();
  $('#route-nav').innerHTML = [...steps.map((step) => step.label), 'Проверка', 'Пример результата'].map((label, index) => `<button class="route-button" data-route="${index}" ${current === index ? 'aria-current="step"' : ''}><b>${String(index + 1).padStart(2, '0')}</b>${label}</button>`).join('');
  if ($('#special-status')) $('#special-status').value = answers.specialStatus;
}

document.addEventListener('keydown', () => { document.documentElement.dataset.input = 'keyboard'; });
document.addEventListener('pointerdown', () => { document.documentElement.dataset.input = 'pointer'; });
document.addEventListener('input', (event) => {
  if (event.target.id === 'answer-slider') setSliderValue(Number(event.target.value));
  if (event.target.id === 'preferences') answers.preferences = event.target.value;
  if (event.target.id === 'restriction-details') { answers.restrictionDetails = event.target.value; $('#next').disabled = !event.target.value.trim(); }
});
document.addEventListener('change', (event) => {
  if (event.target.id === 'two-day') answers.twoDayStructure = event.target.value;
  if (event.target.id === 'special-status') { answers.specialStatus = event.target.value; const top = $('#content').scrollTop; render(); $('.profile').open = true; $('#content').scrollTop = top; $('#special-status').focus({ preventScroll: true }); }
});
document.addEventListener('click', (event) => {
  const button = event.target.closest('button');
  if (!button) return;
  if (button.hasAttribute('data-stop')) setSliderValue(Number(button.dataset.stop));
  if (button.hasAttribute('data-route')) goTo(Number(button.dataset.route));
  if (button.hasAttribute('data-edit')) goTo(Number(button.dataset.edit), true);
  if (button.hasAttribute('data-go-review')) goTo(7);
  if (button.hasAttribute('data-restriction')) { answers.restrictions = button.dataset.restriction; render(); document.querySelector(`[data-restriction="${answers.restrictions}"]`).focus({ preventScroll: true }); }
  if (button.hasAttribute('data-emphasis')) { answers.emphasis = button.dataset.emphasis; render(); document.querySelector(`[data-emphasis="${answers.emphasis}"]`).focus({ preventScroll: true }); }
  if (button.hasAttribute('data-close-dialog')) $('#dialog').close();
  if (button.hasAttribute('data-destination')) toast(`В макете показан только подбор программы. Раздел «${button.dataset.destination}» не открывается.`);
  if (button.id === 'edit-profile') dialog('Данные профиля', 'В приложении здесь откроется твой профиль. Макет не использует и не меняет реальные данные.');
});
$('#next').onclick = () => {
  if (editing) return goTo(7);
  if (current === 7 && restricted()) return dialog('План с тренером', 'В приложении здесь можно будет перейти к обсуждению ограничений с тренером. В макете сообщение не отправляется.');
  if (current === 8) return dialog('Маршрут пройден', 'Это интерактивный макет. Ответы и программа не были сохранены.', () => goTo(0), 'Посмотреть ещё раз');
  goTo(current + 1);
};
$('#back').onclick = () => {
  if (editing) return goTo(7);
  if (current > 0) return goTo(current - 1);
  dialog('Выйти из анкеты?', 'В приложении ты вернёшься к выбору режима тренировки. Здесь можно продолжить просмотр макета.', () => toast('В макете открыт маршрут «План на 4 недели».'), 'К выбору режима');
};
$('#reset').onclick = () => dialog('Начать сначала?', 'Выбранные в макете ответы сбросятся. Реальные данные приложения не затрагиваются.', () => { answers = { ...defaults }; goTo(0); }, 'Начать сначала');
$('#dialog').addEventListener('click', (event) => { if (event.target === $('#dialog')) { const r = $('#dialog').getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) $('#dialog').close(); } });
render();
