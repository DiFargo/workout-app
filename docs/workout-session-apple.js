const $ = (selector) => document.querySelector(selector);
const icon = (name) => `<svg aria-hidden="true"><use href="#i-${name}"/></svg>`;
const escapeHtml = (value) => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const titles = ['Гоблет-присед с гантелью','Румынская тяга с гантелями','Выпады назад с гантелями','Тяга верхнего блока','Жим гантелей сидя','Планка'];
const assets = ['goblet_squat','db_rdl','reverse_lunge','lat_pulldown','seated_db_press','plank'];
const equipment = ['Ноги · Гантель','Ноги · Гантели','Ноги · Гантели','Спина · Блок','Плечи · Гантели','Кор · Собственный вес'];
const technique = [
  [['Гантель у груди','Держите гантель близко к корпусу.'],['Колени по линии стоп','Сохраняйте это направление во время движения.']],
  [['Таз назад','Отводите таз назад.'],['Положение спины','Не округляйте поясницу.']],
  [['Шаг назад','Сделайте контролируемый шаг назад.'],['Устойчивый корпус','Держите корпус устойчиво.']],
  [['Направление движения','Тяните рукоять к верхней части груди.'],['Положение плеч','Не поднимайте плечи.']],
  [['Опора спины','Опирайтесь на спинку.'],['Положение поясницы','Не переразгибайте поясницу.']],
  [['Ровный корпус','Держите корпус ровной линией.'],['Спокойное дыхание','Дышите спокойно.']]
];
const replacementData = {
  'Жим ногами': {asset:'leg_press',equipment:'Ноги · Тренажёр',steps:[['Опора спины','Плотно прижмите спину к опоре.'],['Направление коленей','Ведите колени по линии стоп.']]},
  'Приседания в Смите': {asset:'smith_squat',equipment:'Ноги · Машина Смита',steps:[['Устойчивая опора','Сохраняйте опору на всю стопу.'],['Глубина движения','Контролируйте глубину без боли.']]},
  'Выпады назад с гантелями': {asset:'reverse_lunge',equipment:'Ноги · Гантели',steps:technique[2]}
};
const sessionRows = titles.map((_,index)=>Array.from({length:3},()=>({weight:index===5?0:6.5,reps:index===5?30:8,done:false})));
const startingWeights=titles.map((_,index)=>({estimated:index<5,confirmed:false}));
const shownWeight=row=>row.enteredWeight??row.weight;
const shownReps=row=>row.enteredReps??row.reps;
let editDraft=null, timedSet=null;
const wheelWork=new Map();
const notes = titles.map(()=>({draft:'',saved:''}));
let rows = sessionRows[0];
let exerciseIndex = 0, currentModal = '', returnFocus = null, closeTimeout, draftNote = '', savedNote = '', chosenReplacement = '', editingSet = 0;
let seconds = 90, deadline = 0, running = false, timerVisible = false, toastTimeout;
const formatTime = (value) => `${Math.floor(Math.max(0,value)/60)}:${String(Math.max(0,value)%60).padStart(2,'0')}`;
const nextSetSummary = () => { const row=rows.find(row=>!row.done)??rows.at(-1);return exerciseIndex===5?`${shownReps(row)} секунд`:`${String(shownWeight(row)).replace('.',',')} кг × ${shownReps(row)} повторений`; };
const head = (title, subtitle = '', close = 'close') => `<header class="sheet-head"><div><h2 id="sheet-title">${title}</h2>${subtitle ? `<p>${escapeHtml(subtitle)}</p>` : ''}</div><button class="icon-button" data-close aria-label="${close === 'min' ? 'Свернуть таймер' : 'Закрыть окно'}">${icon(close)}</button></header>`;
function renderSets(){
  const firstPending = rows.findIndex(row => !row.done);
  $('#sets').innerHTML = rows.map((row,index)=>`<div class="set-row ${row.done?'done':''} ${index===firstPending?'current':''}" data-row="${index}"><span class="set-number">${index+1}</span>${exerciseIndex===5?`<button class="set-edit" data-timed-set="${index}" aria-label="${timedSet?.index===index&&timedSet.running?'Приостановить':'Запустить или продолжить'} таймер подхода ${index+1}">${icon(timedSet?.index===index&&timedSet.running?'pause':'play')}</button>`:`<button class="set-edit" data-edit="${index}" aria-label="Изменить подход ${index+1}: ${shownWeight(row)} килограмма, ${shownReps(row)} повторений">${icon('edit')}</button>`}<div class="set-values">${exerciseIndex===5?`<b><span data-set-time="${index}">${timedSet?.index===index?timedSet.seconds:shownReps(row)}</span> <small>сек</small></b>`:`<b>${String(shownWeight(row)).replace('.',',')} <small>кг</small></b><span class="times">×</span><b>${shownReps(row)}</b>`}</div><button class="set-done" data-complete="${index}" aria-pressed="${row.done}" aria-label="${row.done?'Отменить выполнение':'Отметить выполненным'} подхода ${index+1}">${icon('check')}</button></div>`).join('');
  $('#completed-label').textContent = `${rows.filter(row=>row.done).length} из 3`;
  renderStartingWeight();
}
function renderStartingWeight(){
  const state=startingWeights[exerciseIndex],awaiting=state.estimated&&!state.confirmed&&rows[0].done;
  $('.effort').hidden=!awaiting;
  const hint=$('#starting-weight-hint');hint.hidden=awaiting;
  hint.textContent=state.confirmed?`Плановый вес уточнён: ${String(rows[1].weight).replace('.',',')} кг. Изменения сохранены в макете.`:state.estimated?'Стартовый вес по анкете — скорректируй после первого подхода':'Подход на время — запусти таймер кнопкой ▶';
}
function confirmStartingWeight(feedback){
  const state=startingWeights[exerciseIndex],initial=Number(shownWeight(rows[0]));
  if(!rows[0].done||!state.estimated||state.confirmed||initial<=0)return;
  // Mirrors applyBasicWorkoutStartingWeightFeedback: ±10%, 0.5 kg rounding,
  // preserve the first completed set and all explicitly entered values.
  const multiplier=feedback==='easy'?1.1:feedback==='hard'?.9:1;
  const nextWeight=Math.round(Math.max(.5,initial*multiplier)*2)/2;
  const name=titles[exerciseIndex].toLocaleLowerCase('ru').replace(/ё/g,'е').trim();
  titles.forEach((title,index)=>{if(title.toLocaleLowerCase('ru').replace(/ё/g,'е').trim()!==name)return;
    sessionRows[index].forEach((row,setIndex)=>{if(index!==exerciseIndex||setIndex!==0||!row.done)row.weight=nextWeight;});
    startingWeights[index]={estimated:false,confirmed:true,feedback};
  });
  renderSets();$('#starting-weight-hint').focus({preventScroll:true});showToast(`Плановый вес: ${String(nextWeight).replace('.',',')} кг`);
}
function toggleSet(index){
  if(timedSet?.index===index)timedSet=null;
  const row=rows[index];row.done=!row.done;renderSets();
  if(row.done){startTimer();openModal('timer',$(`[data-complete="${index}"]`));}
  else{showToast('Отметка подхода отменена');$(`[data-complete="${index}"]`).focus({preventScroll:true});}
}
function toggleTimedSet(index){
  if(timedSet?.index===index&&timedSet.running){timedSet.seconds=Math.max(0,Math.ceil((timedSet.deadline-Date.now())/1000));timedSet.running=false;}
  else{const duration=timedSet?.index===index?timedSet.seconds:Math.min(600,Math.max(10,shownReps(rows[index])));timedSet={index,seconds:duration,deadline:Date.now()+duration*1000,running:true};}
  renderSets();$(`[data-timed-set="${index}"]`).focus({preventScroll:true});
}
function tickTimedSet(){
  if(!timedSet?.running)return;
  timedSet.seconds=Math.max(0,Math.ceil((timedSet.deadline-Date.now())/1000));
  const label=$(`[data-set-time="${timedSet.index}"]`);if(label)label.textContent=timedSet.seconds;
  if(!timedSet.seconds){const index=timedSet.index;timedSet=null;toggleSet(index);}
}
function wheelMarkup(field,label,current){
  const min=field==='reps'?1:0,step=field==='reps'?1:.5;
  const max=Math.max(field==='reps'?30:120,Math.ceil((current+(field==='reps'?10:40))/step)*step);
  const count=Math.round((max-min)/step)+1;
  return `<div class="wheel-field"><span id="${field}-label">${label}</span><div class="wheel-frame"><div class="wheel-selection" aria-hidden="true"></div><div class="set-wheel" id="wheel-${field}" role="listbox" tabindex="0" aria-labelledby="${field}-label" data-field="${field}" data-min="${min}" data-step="${step}" data-max="${max}">${Array.from({length:count},(_,index)=>{const value=Math.round((min+index*step)*10)/10;return `<button type="button" role="option" tabindex="-1" id="${field}-option-${index}" class="wheel-option" data-value="${value}" aria-selected="false">${String(value).replace('.',',')}</button>`;}).join('')}</div></div></div>`;
}
function selectWheel(wheel,value,scroll=true){
  const min=Number(wheel.dataset.min),step=Number(wheel.dataset.step);
  const index=Math.min(wheel.children.length-1,Math.max(0,Math.round((value-min)/step)));
  const option=wheel.children[index];editDraft[wheel.dataset.field]=Number(option.dataset.value);
  for(const item of wheel.children)item.setAttribute('aria-selected',String(item===option));
  wheel.setAttribute('aria-activedescendant',option.id);
  if(scroll)wheel.scrollTop=index*42;
}
function initializeWheels(){
  document.querySelectorAll('.set-wheel').forEach(wheel=>{
    selectWheel(wheel,editDraft[wheel.dataset.field]);
    wheel.addEventListener('scroll',()=>{
      if(currentModal!=='edit')return;
      selectWheel(wheel,Number(wheel.dataset.min)+Math.round(wheel.scrollTop/42)*Number(wheel.dataset.step),false);
      clearTimeout(wheelWork.get(wheel));wheelWork.set(wheel,setTimeout(()=>{if(currentModal==='edit')selectWheel(wheel,editDraft[wheel.dataset.field]);},140));
    });
  });
}
function updateTimer(){
  if(running){ seconds = Math.max(0,Math.ceil((deadline-Date.now())/1000)); if(!seconds){running=false;showToast('Отдых завершён. Можно продолжать.');} }
  document.querySelectorAll('[data-time]').forEach(node=>node.textContent=formatTime(seconds));
  const progress=$('.timer-ring .progress'); if(progress)progress.style.strokeDashoffset=String(289*(1-Math.min(1,seconds/90)));
  const label=$('#timer-state');if(label)label.textContent=running?'До следующего подхода':seconds?'Таймер на паузе':'Отдых завершён';
  const button=$('#timer-toggle');if(button)button.innerHTML=icon(running?'pause':'play')+(running?'Пауза':seconds?'Продолжить':'Ещё 1:30');
  $('#mini-pause').innerHTML=icon(running?'pause':'play');$('#mini-pause').setAttribute('aria-label',running?'Приостановить отдых':'Продолжить отдых');
  $('#mini-timer').hidden=!timerVisible;
}
function startTimer(){seconds=90;deadline=Date.now()+seconds*1000;running=true;timerVisible=true;updateTimer();}
function toggleTimer(){if(running){updateTimer();running=false;}else{if(seconds===0)seconds=90;deadline=Date.now()+seconds*1000;running=true;}updateTimer();}
function showToast(message){clearTimeout(toastTimeout);$('#toast').textContent=message;$('#toast').classList.add('visible');toastTimeout=setTimeout(()=>$('#toast').classList.remove('visible'),3000);}
function closeModal(){
  wheelWork.forEach(clearTimeout);wheelWork.clear();
  if(currentModal==='notes')draftNote=$('#note-input')?.value??draftNote;
  const previous=currentModal;currentModal='';$('#modal-layer').classList.remove('open');$('#modal-layer').classList.add('closing');$('#screen').inert=false;
  clearTimeout(closeTimeout);closeTimeout=setTimeout(()=>{if(!currentModal){$('#modal-layer').hidden=true;$('#modal-layer').classList.remove('closing');}},document.body.classList.contains('keyboard-action')||matchMedia('(prefers-reduced-motion:reduce)').matches?0:160);
  if(returnFocus?.isConnected)returnFocus.focus({preventScroll:true});
  document.querySelectorAll('[data-preview]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.preview==='main')));
  if(previous==='timer')updateTimer();
}
function openModal(type, trigger=document.activeElement){
  wheelWork.forEach(clearTimeout);wheelWork.clear();
  if(currentModal==='notes')draftNote=$('#note-input')?.value??draftNote;
  clearTimeout(closeTimeout);if(!currentModal)returnFocus=trigger;currentModal=type;$('#sheet').className=`sheet ${type==='timer'?'timer-sheet':''}`;
  let content='';
  if(type==='timer'){
    if(!timerVisible)startTimer();
    content=head('Таймер отдыха','Можно спокойно восстановить дыхание','min')+`<div class="timer-face"><svg class="timer-ring" viewBox="0 0 100 100" aria-hidden="true"><circle class="track" cx="50" cy="50" r="46"/><circle class="progress" cx="50" cy="50" r="46"/></svg><span class="time" data-time>${formatTime(seconds)}</span><span class="timer-state" id="timer-state">До следующего подхода</span></div><p class="next-set">Далее · Подход ${Math.min(3,rows.filter(row=>row.done).length+1)} из 3<b>${nextSetSummary()}</b></p><div class="timer-controls"><button data-adjust="-15" aria-label="Убавить 15 секунд">−15</button><button class="timer-toggle" id="timer-toggle">${icon('pause')}Пауза</button><button data-adjust="15" aria-label="Добавить 15 секунд">+15</button></div><button class="secondary-action" data-close>Свернуть таймер</button>`;
  }else if(type==='technique'){
    content=head('Техника выполнения',titles[exerciseIndex])+`<div class="info-group">${technique[exerciseIndex].map(([title,text],index)=>`<div class="instruction"><span>0${index+1}</span><p><strong>${escapeHtml(title)}</strong><small>${escapeHtml(text)}</small></p></div>`).join('')}</div><p class="technique-footer">Подсказки из библиотеки упражнений приложения.</p><button class="primary" data-close>Понятно</button>`;
  }else if(type==='replace'){
    chosenReplacement='';content=head('Заменить упражнение',`Вместо: ${titles[exerciseIndex]}`)+`<p class="sheet-description">Похожие упражнения на ноги.<br>Подходы и повторы сохранятся.</p><div class="replacement-list" role="radiogroup" aria-label="Замена упражнения">${[['Жим ногами','Тренажёр'],['Приседания в Смите','Машина Смита'],['Выпады назад с гантелями','Гантели']].map(([name,equipment])=>`<button class="replacement" role="radio" aria-checked="false" data-replacement="${name}"><span class="equipment-icon">${icon('dumbbell')}</span><span class="choice-text"><strong>${name}</strong><small>${equipment}</small></span><span class="radio-mark">${icon('check')}</span></button>`).join('')}</div><button class="primary" id="apply-replacement" disabled>Заменить</button>`;
  }else if(type==='notes'){
    content=head('Заметка тренеру',titles[exerciseIndex])+`<label class="note-field" for="note-input">Что стоит учесть</label><textarea class="note-input" id="note-input" maxlength="600" placeholder="Например, уменьшить вес или проверить технику">${escapeHtml(draftNote)}</textarea><div class="field-footer"><span>Останется с этим упражнением</span><span id="note-count">${draftNote.length}/600</span></div><button class="primary" id="save-note">Готово</button>`;
  }else if(type==='edit'){
    const row=rows[editingSet];editDraft={reps:shownReps(row),weight:shownWeight(row)};content=head(`Подход ${editingSet+1}`,titles[exerciseIndex])+`<form id="edit-form"><div class="set-wheels">${wheelMarkup('reps','Повторы',editDraft.reps)}${wheelMarkup('weight','Вес, кг',editDraft.weight)}</div><p class="wheel-help">Прокрути значения или выбери касанием</p><button class="primary" type="submit">Готово</button></form>`;
  }else if(type==='overview'){
    content=head('Ваша тренировка','6 упражнений · демонстрационный план')+`<div class="exercise-list">${titles.map((title,index)=>`<button data-exercise="${index}" class="${index===exerciseIndex?'current':''}"><span>${String(index+1).padStart(2,'0')}</span><span>${escapeHtml(title)}</span>${icon(index===exerciseIndex?'check':'next')}</button>`).join('')}</div>`;
  }else if(type==='exit'){
    content=head('Закрыть тренировку?')+`<p class="sheet-description">Это демонстрационный макет. Можно вернуться к просмотру, не изменяя данные приложения.</p><button class="primary" data-close>Продолжить просмотр</button><button class="secondary-action" id="reset-demo">Начать макет заново</button>`;
  }
  $('#sheet-content').innerHTML=content;$('#screen').inert=true;$('#modal-layer').hidden=false;$('#modal-layer').classList.remove('closing');
  if(type==='timer'&&rows.every(row=>row.done))$('#sheet-content').insertAdjacentHTML('beforeend',`<button class="primary" id="next-after-rest">${exerciseIndex===5?'Завершить тренировку':'К следующему упражнению'}</button>`);
  requestAnimationFrame(()=>{if(currentModal!==type)return;$('#modal-layer').classList.add('open');if(type==='edit')initializeWheels();$('#sheet-content [data-close]')?.focus({preventScroll:true});});
  document.querySelectorAll('[data-preview]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.preview===type)));updateTimer();
}
function setExercise(index){if(index!==exerciseIndex)timedSet=null;notes[exerciseIndex]={draft:draftNote,saved:savedNote};exerciseIndex=Math.max(0,Math.min(5,index));rows=sessionRows[exerciseIndex];({draft:draftNote,saved:savedNote}=notes[exerciseIndex]);$('#notes-button .note-dot').hidden=!savedNote.trim();$('#exercise-title').textContent=titles[exerciseIndex];$('#exercise-count').textContent=`${exerciseIndex+1} из 6`;$('.exercise-picker').setAttribute('aria-label',`Список упражнений, упражнение ${exerciseIndex+1} из 6`);$('#exercise-image').src=`../public/basic-workout/exercises/mannequin/${assets[exerciseIndex]}.png`;$('#exercise-image').alt=`Иллюстрация: ${titles[exerciseIndex]}`;$('#equipment-tag').textContent=equipment[exerciseIndex];$('.set-labels span:nth-child(2)').textContent=exerciseIndex===5?'Время':'Вес / повторы';$('#app-content').scrollTop=0;$('#next span').textContent=exerciseIndex===5?'Завершить':'Следующее';renderSets();}
document.addEventListener('pointerdown',()=>document.body.classList.remove('keyboard-action'));
document.addEventListener('keydown',event=>{
  document.body.classList.add('keyboard-action');if(!currentModal)return;
  if(event.target.matches('.set-wheel')&&['ArrowUp','ArrowDown','Home','End','PageUp','PageDown'].includes(event.key)){event.preventDefault();const wheel=event.target,step=Number(wheel.dataset.step),value=editDraft[wheel.dataset.field];selectWheel(wheel,event.key==='Home'?Number(wheel.dataset.min):event.key==='End'?Number(wheel.dataset.max):value+(event.key==='ArrowUp'?-step:event.key==='ArrowDown'?step:event.key==='PageUp'?-step*5:step*5));return;}
  if(event.target.matches('[data-replacement]')&&['ArrowDown','ArrowUp','ArrowLeft','ArrowRight'].includes(event.key)){event.preventDefault();const options=[...document.querySelectorAll('[data-replacement]')],direction=['ArrowDown','ArrowRight'].includes(event.key)?1:-1;const next=options[(options.indexOf(event.target)+direction+options.length)%options.length];next.focus();next.click();}
  if(event.key==='Escape'){event.preventDefault();closeModal();}
  if(event.key==='Tab'){const focusable=[...$('#sheet').querySelectorAll('button:not(:disabled),input,textarea,[tabindex="0"]')].filter(node=>node.tabIndex>=0&&node.getClientRects().length);const first=focusable[0],last=focusable.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}}
});
document.addEventListener('click',event=>{
  const button=event.target.closest('button');if(!button){const row=event.target.closest('[data-row]');if(row&&!currentModal)toggleSet(Number(row.dataset.row));return;}
  if(button.classList.contains('wheel-option')){const wheel=button.closest('.set-wheel');selectWheel(wheel,Number(button.dataset.value));wheel.focus({preventScroll:true});return;}
  if(button.hasAttribute('data-preview')){if(button.dataset.preview==='main'){closeModal();return;}openModal(button.dataset.preview,button);return;}
  if(button.hasAttribute('data-open')){openModal(button.dataset.open,button);return;}
  if(button.hasAttribute('data-close')){closeModal();return;}
  if(button.hasAttribute('data-edit')){editingSet=Number(button.dataset.edit);openModal('edit',button);return;}
  if(button.hasAttribute('data-complete')){toggleSet(Number(button.dataset.complete));return;}
  if(button.hasAttribute('data-timed-set')){toggleTimedSet(Number(button.dataset.timedSet));return;}
  if(button.hasAttribute('data-effort')){confirmStartingWeight(button.dataset.effort);return;}
  if(button.id==='next-after-rest'){closeModal();if(exerciseIndex===5){openModal('overview');showToast('Демонстрационная тренировка завершена');}else setExercise(exerciseIndex+1);return;}
  if(button.hasAttribute('data-adjust')){updateTimer();seconds=Math.max(0,seconds+Number(button.dataset.adjust));if(running)deadline=Date.now()+seconds*1000;updateTimer();return;}
  if(button.id==='timer-toggle'||button.id==='mini-pause'){toggleTimer();return;}
  if(button.hasAttribute('data-replacement')){chosenReplacement=button.dataset.replacement;document.querySelectorAll('[data-replacement]').forEach(node=>node.setAttribute('aria-checked',String(node===button)));$('#apply-replacement').disabled=false;return;}
  if(button.id==='apply-replacement'){titles[exerciseIndex]=chosenReplacement;assets[exerciseIndex]=replacementData[chosenReplacement].asset;equipment[exerciseIndex]=replacementData[chosenReplacement].equipment;technique[exerciseIndex]=replacementData[chosenReplacement].steps;setExercise(exerciseIndex);closeModal();showToast('Упражнение заменено в макете');return;}
  if(button.id==='save-note'){savedNote=$('#note-input').value;draftNote=savedNote;$('#notes-button .note-dot').hidden=!savedNote.trim();closeModal();showToast('Заметка сохранена в макете');return;}
  if(button.hasAttribute('data-exercise')){setExercise(Number(button.dataset.exercise));closeModal();return;}
  if(button.id==='previous'){if(exerciseIndex===0)openModal('overview',button);else setExercise(exerciseIndex-1);return;}
  if(button.id==='next'){if(exerciseIndex===5){showToast('Конец демонстрационного плана');openModal('overview',button);}else setExercise(exerciseIndex+1);return;}
  if(button.id==='reset-demo'){location.reload();}
});
document.addEventListener('input',event=>{if(event.target.id==='note-input')$('#note-count').textContent=`${event.target.value.length}/600`;});
document.addEventListener('submit',event=>{if(event.target.id!=='edit-form')return;event.preventDefault();rows[editingSet]={...rows[editingSet],enteredWeight:editDraft.weight,enteredReps:editDraft.reps};renderSets();closeModal();$(`[data-edit="${editingSet}"]`)?.focus({preventScroll:true});});
$('#scrim').addEventListener('click',closeModal);
document.querySelectorAll('svg').forEach(svg=>svg.setAttribute('aria-hidden','true'));
renderSets();setInterval(()=>{updateTimer();tickTimedSet();},250);
const initialState=new URLSearchParams(location.search).get('state');if(['timer','technique','replace','notes'].includes(initialState))openModal(initialState);
