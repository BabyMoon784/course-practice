'use strict';
const app = document.getElementById('app');
const storeKey = 'kejian-course-practice-v1';
let saved = {};
let draft = [];
const modes = {ordered:'顺序练习', random:'随机练习', wrong:'错题重练'};
try {
  const data = JSON.parse(localStorage.getItem(storeKey));
  if (data && typeof data === 'object' && !Array.isArray(data)) saved = data;
} catch { document.getElementById('storage-warning').hidden = false; }
function save() {
  try { localStorage.setItem(storeKey, JSON.stringify(saved)); }
  catch { document.getElementById('storage-warning').hidden = false; }
}
function esc(value) {
  return String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function active() {
  const slug = location.hash.slice(1);
  return Object.hasOwn(COURSES, slug) ? slug : null;
}
function state(slug) {
  return saved[slug] ||= {mode:'ordered', group:0, history:{}, runs:{}};
}
function wrongCount(slug) {
  return Object.entries(state(slug).history).filter(([id,value]) => COURSES[slug].questions[id]?.answer !== value).length;
}
function home() {
  document.title = '课间题册 · 网课刷题本';
  const total = Object.values(COURSES).reduce((n,c) => n + c.questions.length, 0);
  const cards = Object.entries(COURSES).map(([slug,course]) => {
    const count = course.questions.length;
    const chapters = new Set(course.questions.map(q => q.section.split('.')[0])).size;
    const done = Object.keys(state(slug).history).length;
    return `<a class="course ${slug}" href="#${slug}"><div class="cover"><span class="art" aria-hidden="true"></span><span class="cover-type">${count} 题</span><h2>${course.name}</h2></div>
    <div class="course-bottom"><div class="stats"><span>${chapters} 章</span><span>单选 / 多选 / 判断</span></div><div class="row"><span class="sub">已练 ${done} / ${count}</span><span class="start">${done ? '继续练习' : '开始练习'}</span></div><div class="track"><div style="width:${100*done/count}%"></div></div></div></a>`;
  }).join('');
  app.innerHTML = `<div class="shelf-heading"><div><h1>我的题册</h1><p>2 门课程，共 ${total} 道练习题</p></div></div><div class="shelf">${cards}</div><p class="storage-note">练习进度和错题保存在当前浏览器。</p>`;
}
function runKey(s) { return `${s.mode}-${s.group}`; }
function makeRun(slug) {
  const s = state(slug);
  const queue = COURSES[slug].questions.flatMap((q,id) => {
    if (s.group && q.group !== s.group) return [];
    if (s.mode === 'wrong' && (!Object.hasOwn(s.history,id) || s.history[id] === q.answer)) return [];
    return [id];
  });
  if (s.mode === 'random') {
    for (let i = queue.length-1; i > 0; i--) {
      const j = Math.floor(Math.random()*(i+1));
      [queue[i],queue[j]] = [queue[j],queue[i]];
    }
  }
  return {queue, index:0, answers:{}, finished:false};
}
function getRun(slug) {
  const s = state(slug), key = runKey(s);
  if (!s.runs[key]) { s.runs[key] = makeRun(slug); save(); }
  return s.runs[key];
}
function controls(slug) {
  const s = state(slug);
  const groups = new Map(COURSES[slug].questions.map(q => [q.group,q.section]));
  const seen = new Set();
  let options = '<option value="0">全部小节</option>';
  for (const [id,name] of groups) {
    options += `<option value="${id}" ${s.group===id?'selected':''}>${name}${seen.has(name)?'（再次出现）':''}</option>`;
    seen.add(name);
  }
  return `<aside class="controls"><span class="control-label">练习方式</span><div class="modes">${Object.entries(modes).map(([k,v])=>`<button data-mode="${k}" aria-pressed="${s.mode===k}">${v}${k==='wrong'?' · '+wrongCount(slug):''}</button>`).join('')}</div><div><label for="group">练习范围</label><select id="group">${options}</select></div></aside>`;
}
function displayAnswer(key) { return /^[A-G]+$/.test(key) ? Array.from(key).join('、') : key; }
function questionPanel(slug,run) {
  const s = state(slug);
  const questions = COURSES[slug].questions;
  if (!run.queue.length) return `<h2>当前范围暂无错题</h2><p class="summary">答错的题会收录在这里，重练答对后会自动移出。</p><button data-mode="ordered">去顺序练习</button>`;
  if (run.finished) {
    const answers = Object.entries(run.answers);
    const right = answers.filter(([id,v])=>questions[id].answer===v).length;
    return `<h2>本轮已结束</h2><p class="summary">共 ${run.queue.length} 题，答对 ${right} 题，答错 ${answers.length-right} 题，未答 ${run.queue.length-answers.length} 题。</p><div class="actions"><button data-act="review">回看本轮</button><button class="primary" data-act="restart">再练一轮</button></div>`;
  }
  const id=run.queue[run.index], q=questions[id], value=run.answers[id];
  const checked = value !== undefined;
  const multi = q.type==='多选题', judge = q.type==='判断题';
  const options = judge ? ['对','错'] : q.options;
  const buttons = options.map((text,i)=>{
    const key=judge ? text : String.fromCharCode(65+i);
    const selected=checked ? value.includes(key) : draft.includes(key);
    const correct=checked && q.answer.includes(key), incorrect=checked && selected && !correct;
    const flag=correct?'标准答案':incorrect?'误选':'';
    return `<button class="option ${correct?'correct':incorrect?'incorrect':selected?'selected':''}" data-option="${key}" aria-pressed="${selected}" ${checked?'disabled':''}>${judge?'':`<span class="opt-key">${key}</span>`}<span>${esc(text)}</span>${flag?`<span class="state-text">${flag}</span>`:''}</button>`;
  }).join('');
  const right = checked && value===q.answer;
  const feedback = checked ? `<div class="feedback ${right?'':'bad'}" role="status"><b>${right?'答对了':'答错了'}</b>　标准答案 ${displayAnswer(q.answer)}${right?'':`，你选了 ${displayAnswer(value)}`}</div>`:'';
  return `<div class="question-meta"><span class="type">${q.type}</span><span>§ ${q.section} · 原题 ${q.number}</span><strong>${run.index+1} / ${run.queue.length}</strong></div>
    <h2 class="question">${esc(q.text)}</h2>${multi ? '<p class="hint">可选择多项，选全后提交。</p>' : ''}
    <div class="options">${buttons}</div>${feedback}
    <div class="actions"><button data-act="prev" ${run.index===0?'disabled':''}>上一题</button>${checked?'<button data-act="retry">重答</button>':''}
    ${checked?`<button class="primary" data-act="next">${run.index===run.queue.length-1?'查看结果':'下一题'}</button>`:`<button class="primary" data-act="submit" ${draft.length?'':'disabled'}>提交答案</button>`}</div>`;
}
function render() {
  const slug = active();
  if (!slug) { home(); return; }
  document.title = `${COURSES[slug].name} · 课间题册`;
  app.innerHTML = `<a class="crumb" href="#home">我的题册</a><div class="practice-title"><h1>${COURSES[slug].name}</h1></div><div class="workspace">${controls(slug)}<section class="practice-panel" aria-label="练习题">${questionPanel(slug,getRun(slug))}</section></div>`;
}
function changeView(slug,mode,group) {
  const s = state(slug);
  if (mode===s.mode && group===s.group) return;
  s.mode=mode; s.group=group;
  if (mode==='wrong') delete s.runs[runKey(s)];
  draft=[]; save(); render();
}
app.addEventListener('change',e=>{
  if (e.target.id==='group') changeView(active(),state(active()).mode,Number(e.target.value));
});
app.addEventListener('click',e=>{
  const button=e.target.closest('button'), slug=active();
  if (!button || button.disabled || !slug) return;
  const s=state(slug), run=getRun(slug);
  if (button.dataset.mode) { changeView(slug,button.dataset.mode,s.group); return; }
  const id=run.queue[run.index], q=COURSES[slug].questions[id];
  if (button.dataset.option) {
    const key=button.dataset.option;
    if (q.type==='多选题') draft=draft.includes(key)?draft.filter(x=>x!==key):[...draft,key].sort();
    else draft=[key];
    app.querySelectorAll('[data-option]').forEach(el=>{
      const pressed=draft.includes(el.dataset.option);
      el.setAttribute('aria-pressed',String(pressed)); el.classList.toggle('selected',pressed);
    });
    app.querySelector('[data-act="submit"]').disabled=!draft.length;
    return;
  }
  const action=button.dataset.act;
  if (action==='submit' && draft.length) {
    run.answers[id]=draft.join('');
    s.history[id]=run.answers[id];
  } else if (action==='retry') delete run.answers[id];
  else if (action==='next') {
    if (run.index===run.queue.length-1) run.finished=true;
    else run.index++;
  } else if (action==='prev') run.index=Math.max(0,run.index-1);
  else if (action==='review') {run.finished=false; run.index=0;}
  else if (action==='restart') s.runs[runKey(s)]=makeRun(slug);
  draft=[]; save(); render();
  if(action==='submit') app.querySelector('[data-act="next"]')?.focus({preventScroll:true});
  if(['next','prev','restart','review'].includes(action)) {
    const panel=app.querySelector('.practice-panel');
    if(panel.getBoundingClientRect().top<0) panel.scrollIntoView({block:'start'});
  }
});
window.addEventListener('hashchange',()=>{draft=[]; render(); window.scrollTo(0,0);});
render();
