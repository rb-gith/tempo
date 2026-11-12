'use strict';

/* =========================================================
   Tempo — hours per project (PWA)
   Projects and entries live in this device's localStorage.
   Nothing is sent anywhere.
   ========================================================= */

const DATA_KEY = 'tempo-v1';
const SETTINGS_KEY = 'tempo-settings';
const COFFEE_URL = 'https://buymeacoffee.com/gionzana';
const GITHUB_URL = 'https://github.com/rb-gith?tab=repositories';
const QUICK = [0.5, 1, 2, 4, 8];
const MAX_HOURS = 24;
const COLORS = ['#534AB7', '#0F6E56', '#B5532F', '#2F6FB0', '#A33A6B', '#8A6D12', '#3D7D2E', '#2E7F86', '#7A4FA0', '#B0472F', '#5B6B7F', '#9A5B12'];

const $ = sel => document.querySelector(sel);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const pad = n => String(n).padStart(2, '0');
const keyOf = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const todayKey = () => keyOf(new Date());
const isDate = k => typeof k === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(k);
const dateOf = k => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d, 12); };
const addDays = (k, n) => { const d = dateOf(k); d.setDate(d.getDate() + n); return keyOf(d); };
const isColor = c => typeof c === 'string' && /^#[0-9A-Fa-f]{6}$/.test(c);
const norm = s => s.trim().replace(/\s+/g, ' ').toLowerCase();

/* ---------- Settings and language ---------- */
function cleanSettings(s) {
  s = s && typeof s === 'object' ? s : {};
  return {
    lang: s.lang === 'en' || s.lang === 'it' ? s.lang : null,
    lastBackup: isDate(s.lastBackup) ? s.lastBackup : null,
  };
}
let settings = cleanSettings(null);
try { settings = cleanSettings(JSON.parse(localStorage.getItem(SETTINGS_KEY))); } catch (e) { /* use the defaults */ }
function saveSettings() {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch (e) { /* storage blocked */ }
}
const phoneLang = navigator.language || '';
let lang = settings.lang || (/^it\b/i.test(phoneLang) ? 'it' : 'en');
const tr = (key, ...args) => args.reduce((s, a) => s.replace('{}', () => a), TEXT[lang][key]);
const locale = () => phoneLang.toLowerCase().startsWith(lang) ? phoneLang : lang === 'it' ? 'it-IT' : 'en-GB';
function setLang(next) {
  lang = next;
  settings.lang = next;
  saveSettings();
  document.documentElement.lang = lang;
  render();
}
document.documentElement.lang = lang;

/* Hours shown with the phone's decimal mark, at most two decimals: 1.5 → "1,5" in Italian */
const fmtNum = n => (Math.round(n * 100) / 100).toLocaleString(locale(), { maximumFractionDigits: 2 });
const fmtH = n => tr('hoursShort', fmtNum(n));
/* Typed hours accept a comma or a dot, and also h:mm (1:30 = 1.5) */
function parseHours(s) {
  s = String(s || '').trim().replace(',', '.');
  let n;
  const hm = s.match(/^(\d{1,2}):([0-5]\d)$/);
  if (hm) n = Number(hm[1]) + Number(hm[2]) / 60;
  else if (/^\d*\.?\d+$/.test(s)) n = Number(s);
  else return null;
  n = Math.round(n * 100) / 100;
  return n > 0 && n <= MAX_HOURS ? n : null;
}

/* ---------- Data ---------- */
/* Everything read from storage or a backup file is reduced to known fields and types */
function cleanProject(p) {
  return {
    id: String(p.id || uid()).slice(0, 40),
    name: typeof p.name === 'string' ? p.name.trim().replace(/\s+/g, ' ').slice(0, 60) : '',
    color: isColor(p.color) ? p.color : COLORS[0],
    archived: p.archived === true,
    created: Number(p.created) || Date.now(),
  };
}
function cleanEntry(e, ids) {
  const hours = typeof e.hours === 'number' ? Math.round(e.hours * 100) / 100 : NaN;
  if (!ids.has(e.projectId) || !isDate(e.date) || !(hours > 0 && hours <= MAX_HOURS)) return null;
  return {
    id: String(e.id || uid()).slice(0, 40),
    projectId: e.projectId,
    date: e.date,
    hours,
    note: typeof e.note === 'string' ? e.note.trim().slice(0, 500) : '',
    created: Number(e.created) || Date.now(),
  };
}
function cleanData(d) {
  d = d && typeof d === 'object' ? d : {};
  const seen = new Set();
  const projects = (Array.isArray(d.projects) ? d.projects : [])
    .filter(p => p && typeof p === 'object').map(cleanProject)
    .filter(p => p.name && !seen.has(p.id) && seen.add(p.id));
  const ids = new Set(projects.map(p => p.id));
  const entries = (Array.isArray(d.entries) ? d.entries : [])
    .filter(e => e && typeof e === 'object').map(e => cleanEntry(e, ids)).filter(Boolean);
  return { projects, entries };
}
let data = { projects: [], entries: [] };
try { data = cleanData(JSON.parse(localStorage.getItem(DATA_KEY))); } catch (e) { /* start empty */ }
let askedPersist = false;
function saveData() {
  try { localStorage.setItem(DATA_KEY, JSON.stringify({ app: 'tempo', version: 1, projects: data.projects, entries: data.entries })); }
  catch (e) { toast(tr('saveFailed')); return false; }
  /* Ask the browser not to clear the data when the phone runs low on space */
  if (!askedPersist && navigator.storage && navigator.storage.persist) { askedPersist = true; navigator.storage.persist().catch(() => {}); }
  return true;
}
const projectById = id => data.projects.find(p => p.id === id);
const entryById = id => data.entries.find(e => e.id === id);
const projectByName = name => data.projects.find(p => norm(p.name) === norm(name));
const sumHours = list => list.reduce((s, e) => s + e.hours, 0);
function nextColor() {
  const used = data.projects.filter(p => !p.archived).map(p => p.color);
  return COLORS.find(c => !used.includes(c)) || COLORS[data.projects.length % COLORS.length];
}
/* Projects most recently used first, for the suggestions */
function recentProjects() {
  const last = new Map();
  data.entries.forEach(e => { if ((last.get(e.projectId) || 0) < e.created) last.set(e.projectId, e.created); });
  return data.projects.filter(p => !p.archived).sort((a, b) => (last.get(b.id) || b.created) - (last.get(a.id) || a.created));
}

/* ---------- Navigation: each page is a history entry, so the phone's back button works ---------- */
const ui = { day: todayKey(), period: 'week', anchor: todayKey(), form: null, y: 0 };
history.scrollRestoration = 'manual';
const depth = () => (history.state && history.state.d) || 0;
function go(hash) {
  history.pushState({ d: depth() + 1 }, '', '#' + hash);
  render();
}
function back() {
  if (depth() > 0) { history.back(); return; }
  history.replaceState({ d: 0 }, '', location.pathname + location.search);
  render();
}
function switchTab(tab) {
  history.replaceState({ d: depth() }, '', tab === 'totals' ? '#totals' : location.pathname + location.search);
  render();
}
addEventListener('popstate', render);
function currentRoute() {
  const [name, arg] = location.hash.slice(1).split('/');
  return { name: name || 'day', arg: arg ? decodeURIComponent(arg) : null };
}

/* ---------- Rendering ---------- */
const app = $('#app');
const tabs = $('#tabs');
let lastKey = null;
function render() {
  const key = location.hash;
  const same = key === lastKey;
  const y = scrollY;
  if (!same && $('#sheet').open) $('#sheet').close();
  const { name, arg } = currentRoute();
  let tab = null;
  if (name === 'day') { app.innerHTML = dayHtml(); tab = 'day'; }
  else if (name === 'totals') { app.innerHTML = totalsHtml(); tab = 'totals'; }
  else if (name === 'add') { startForm(key, null); app.innerHTML = formHtml(); }
  else if (name === 'edit' && entryById(arg)) { startForm(key, entryById(arg)); app.innerHTML = formHtml(); }
  else if (name === 'project' && projectById(arg)) app.innerHTML = projectHtml(projectById(arg));
  else if (name === 'menu') app.innerHTML = menuHtml();
  else { back(); return; }
  if (name !== 'add' && name !== 'edit') ui.form = null;
  lastKey = key;
  tabs.hidden = !tab;
  $('#tab-day').textContent = tr('tabDay');
  $('#tab-totals').textContent = tr('tabTotals');
  $('#tab-day').setAttribute('aria-current', tab === 'day' ? 'page' : 'false');
  $('#tab-totals').setAttribute('aria-current', tab === 'totals' ? 'page' : 'false');
  scrollTo(0, same ? y : 0);
  if (name === 'add' && !ui.form.entry) { const p = $('#f-project'); if (p) p.focus(); }
}

const svg = {
  menu: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
};
const creditHtml = () => `<footer class="credit">
  <p>${tr('madeBy')} · <a href="${COFFEE_URL}" target="_blank" rel="noopener">${tr('coffee')}</a></p>
  <p>${tr('moreApps', `<a href="${GITHUB_URL}" target="_blank" rel="noopener">github</a>`)}</p>
</footer>`;
const longDate = k => dateOf(k).toLocaleDateString(locale(), { weekday: 'long', day: 'numeric', month: 'long' });
const dayWord = k => k === todayKey() ? tr('today') : k === addDays(todayKey(), -1) ? tr('yesterday') : String(dateOf(k).getFullYear());

/* ---------- Day ---------- */
function entryHtml(e, showDate) {
  const p = projectById(e.projectId);
  return `<button class="entry" data-act="edit-entry" data-id="${esc(e.id)}">
    <span class="dot" style="--c:${p.color}"></span>
    <span class="what"><span class="name">${showDate ? esc(longDate(e.date)) : esc(p.name)}</span>${e.note ? `<span class="note">${esc(e.note)}</span>` : ''}</span>
    <span class="hrs">${fmtH(e.hours)}</span>
  </button>`;
}
function dayHtml() {
  const list = data.entries.filter(e => e.date === ui.day).sort((a, b) => a.created - b.created);
  const isToday = ui.day === todayKey();
  return `<div class="view with-tabs">
    <header class="topbar">
      <h1>${tr('appName')}</h1>
      <button class="icon-btn" data-act="menu" aria-label="${tr('menu')}">${svg.menu}</button>
    </header>
    <div class="datenav">
      <button class="icon-btn" data-act="day-prev" aria-label="${tr('prevDay')}">‹</button>
      <button class="label" data-act="day-today" ${isToday ? 'disabled' : `aria-label="${tr('goToday')}"`}><b>${esc(longDate(ui.day))}</b><small>${esc(dayWord(ui.day))}${isToday ? '' : ' · ' + tr('goToday')}</small></button>
      <button class="icon-btn" data-act="day-next" aria-label="${tr('nextDay')}">›</button>
    </div>
    <p class="big-total">${fmtNum(sumHours(list))} <small>h</small></p>
    ${list.length ? `<div class="card">${list.map(e => entryHtml(e)).join('')}</div>` : `<p class="empty">${tr('nothingLogged')}</p>`}
    <button class="btn primary wide" data-act="add-entry">+ ${tr('addEntry')}</button>
    ${creditHtml()}
  </div>`;
}

/* ---------- Add or edit an entry ---------- */
function startForm(key, entry) {
  if (ui.form && ui.form.key === key) return;
  ui.form = { key, entry, date: entry ? entry.date : ui.day };
}
function formHtml() {
  const f = ui.form, e = f.entry;
  const p = e && projectById(e.projectId);
  return `<div class="view"><form id="entry-form" novalidate>
    <header class="topbar">
      <button type="button" class="icon-btn" data-act="back" aria-label="${tr('back')}">‹</button>
      <h2>${e ? tr('editEntry') : tr('newEntry')}</h2>
      <button class="save-btn">${tr('save')}</button>
    </header>
    <label class="field"><span>${tr('project')}</span>
      <input type="text" id="f-project" name="project" value="${p ? esc(p.name) : ''}" maxlength="60" placeholder="${tr('projectPlaceholder')}" autocomplete="off" autocapitalize="sentences" enterkeyhint="next"></label>
    <div class="sugs" id="sugs">${suggestionsHtml(p ? p.name : '')}</div>
    <p class="error" id="project-error" hidden>${tr('projectError')}</p>
    <label class="field"><span>${tr('hours')}</span>
      <input type="text" id="f-hours" name="hours" value="${e ? esc(fmtNum(e.hours)) : ''}" inputmode="decimal" placeholder="${tr('hoursPlaceholder')}" autocomplete="off" enterkeyhint="done"></label>
    <div class="quick">${QUICK.map(q => `<button type="button" data-act="quick" data-h="${q}">${q === 0.5 ? '½' : q}</button>`).join('')}</div>
    <p class="error" id="hours-error" hidden>${tr('hoursError')}</p>
    <label class="field"><span>${tr('note')}</span>
      <textarea name="note" rows="2" maxlength="500" placeholder="${tr('notePlaceholder')}">${e ? esc(e.note) : ''}</textarea></label>
    <label class="field"><span>${tr('date')}</span>
      <input type="date" name="date" value="${f.date}" required></label>
    ${e ? `<div class="btns"><button type="button" class="btn danger grow" data-act="delete-entry">${tr('delete')}</button></div>` : ''}
  </form></div>`;
}
/* Empty field: the recent projects. Typing: projects whose name contains the text, plus a "new project" hint */
function suggestionsHtml(typed) {
  const q = norm(typed || '');
  const chip = p => `<button type="button" class="sug" data-act="pick" data-id="${esc(p.id)}"><span class="dot" style="--c:${p.color}"></span>${esc(p.name)}</button>`;
  if (!q) {
    const recent = recentProjects().slice(0, 6);
    return recent.length ? `<span class="sugs-label">${tr('recent')}</span>${recent.map(chip).join('')}` : '';
  }
  const exact = projectByName(typed);
  if (exact) return '';
  const matches = recentProjects().filter(p => norm(p.name).includes(q)).slice(0, 6);
  return matches.map(chip).join('') + `<span class="new-proj">${esc(tr('newProject', typed.trim()))}</span>`;
}
function refreshSuggestions() {
  const box = $('#sugs'), input = $('#f-project');
  if (box && input) box.innerHTML = suggestionsHtml(input.value);
}
function submitEntry(form) {
  const f = ui.form;
  const name = form.elements.project.value.trim().replace(/\s+/g, ' ').slice(0, 60);
  const hours = parseHours(form.elements.hours.value);
  $('#project-error').hidden = !!name;
  $('#hours-error').hidden = hours !== null;
  if (!name) { form.elements.project.focus(); return; }
  if (hours === null) { form.elements.hours.focus(); return; }
  const date = isDate(form.elements.date.value) ? form.elements.date.value : f.date;
  let project = projectByName(name);
  const created = !project;
  if (created) {
    project = { id: uid(), name, color: nextColor(), archived: false, created: Date.now() };
    data.projects.push(project);
  } else if (project.archived) {
    project.archived = false;
  }
  const old = f.entry;
  const entry = {
    id: old ? old.id : uid(),
    projectId: project.id,
    date,
    hours,
    note: form.elements.note.value.trim().slice(0, 500),
    created: old ? old.created : Date.now(),
  };
  if (old) data.entries[data.entries.indexOf(old)] = entry; else data.entries.push(entry);
  if (!saveData()) {
    if (old) data.entries[data.entries.indexOf(entry)] = old; else data.entries.pop();
    if (created) data.projects.pop();
    return;
  }
  ui.day = date;
  toast(tr('saved'));
  back();
}
function deleteEntry(e) {
  if (!confirm(tr('confirmDeleteEntry'))) return;
  const i = data.entries.indexOf(e);
  data.entries.splice(i, 1);
  if (!saveData()) { data.entries.splice(i, 0, e); return; }
  toast(tr('deleted'));
  back();
}

/* ---------- Totals ---------- */
/* The period around ui.anchor: weeks start on Monday */
function periodRange() {
  const d = dateOf(ui.anchor);
  if (ui.period === 'week') {
    const start = addDays(ui.anchor, -((d.getDay() + 6) % 7));
    return [start, addDays(start, 6)];
  }
  if (ui.period === 'month') return [keyOf(new Date(d.getFullYear(), d.getMonth(), 1)), keyOf(new Date(d.getFullYear(), d.getMonth() + 1, 0))];
  return [`${d.getFullYear()}-01-01`, `${d.getFullYear()}-12-31`];
}
function periodLabel([start, end]) {
  const s = dateOf(start), e = dateOf(end);
  if (ui.period === 'year') return String(s.getFullYear());
  if (ui.period === 'month') return s.toLocaleDateString(locale(), { month: 'long', year: 'numeric' });
  const sameMonth = s.getMonth() === e.getMonth();
  const left = s.toLocaleDateString(locale(), sameMonth ? { day: 'numeric' } : { day: 'numeric', month: 'short' });
  const right = e.toLocaleDateString(locale(), { day: 'numeric', month: sameMonth ? 'long' : 'short', year: 'numeric' });
  return `${left} – ${right}`;
}
function movePeriod(step) {
  const d = dateOf(ui.anchor);
  if (ui.period === 'week') ui.anchor = addDays(ui.anchor, 7 * step);
  else if (ui.period === 'month') ui.anchor = keyOf(new Date(d.getFullYear(), d.getMonth() + step, 1, 12));
  else ui.anchor = keyOf(new Date(d.getFullYear() + step, 0, 1, 12));
  render();
}
function totalsHtml() {
  const range = periodRange();
  const inRange = data.entries.filter(e => e.date >= range[0] && e.date <= range[1]);
  const total = sumHours(inRange);
  const rows = data.projects
    .map(p => ({ p, h: sumHours(inRange.filter(e => e.projectId === p.id)) }))
    .filter(r => r.h > 0)
    .sort((a, b) => b.h - a.h);
  const max = rows.length ? rows[0].h : 1;
  const seg = ['week', 'month', 'year'].map(k => `<button data-act="period" data-period="${k}" aria-pressed="${ui.period === k}">${tr(k)}</button>`).join('');
  return `<div class="view with-tabs">
    <header class="topbar">
      <h1>${tr('tabTotals')}</h1>
      <button class="icon-btn" data-act="menu" aria-label="${tr('menu')}">${svg.menu}</button>
    </header>
    <div class="seg">${seg}</div>
    <div class="period">
      <button class="icon-btn" data-act="period-prev" aria-label="${tr('prevPeriod')}">‹</button>
      <b>${esc(periodLabel(range))}</b>
      <button class="icon-btn" data-act="period-next" aria-label="${tr('nextPeriod')}">›</button>
    </div>
    ${rows.length ? `<div class="card">${rows.map(r => `<button class="proj" data-act="open-project" data-id="${esc(r.p.id)}">
        <span class="t"><span>${esc(r.p.name)}</span><span><b>${fmtH(r.h)}</b> · ${Math.round((r.h / total) * 100)}%</span></span>
        <span class="track"><span style="--c:${r.p.color};width:${Math.max(2, (r.h / max) * 100)}%"></span></span>
      </button>`).join('')}</div>
      <p class="sum"><span>${tr('total')}</span><span>${fmtH(total)}</span></p>` : `<p class="empty">${tr('nothingInPeriod')}</p>`}
    ${creditHtml()}
  </div>`;
}

/* ---------- A project: all its days and notes ---------- */
function projectHtml(p) {
  const list = data.entries.filter(e => e.projectId === p.id).sort((a, b) => b.date.localeCompare(a.date) || b.created - a.created);
  return `<div class="view">
    <header class="topbar">
      <button class="icon-btn" data-act="back" aria-label="${tr('back')}">‹</button>
      <h2>${esc(p.name)}</h2>
      <button class="link-btn" data-act="edit-project" data-id="${esc(p.id)}">${tr('edit')}</button>
    </header>
    <p class="proj-head"><span class="dot" style="--c:${p.color}"></span><span>${tr('projectTotal', fmtH(sumHours(list)))}</span>${p.archived ? `<span class="tag">${tr('archived')}</span>` : ''}</p>
    ${list.length ? `<div class="card">${list.map(e => entryHtml(e, true)).join('')}</div>` : `<p class="empty">${tr('noEntriesYet')}</p>`}
  </div>`;
}
const sheet = $('#sheet');
function openProjectSheet(p) {
  const used = data.entries.some(e => e.projectId === p.id);
  sheet.innerHTML = `<form id="project-form" method="dialog" novalidate data-id="${esc(p.id)}">
    <h3>${tr('editProject')}</h3>
    <label class="field"><span>${tr('projectName')}</span>
      <input type="text" name="name" value="${esc(p.name)}" maxlength="60" autocomplete="off"></label>
    <p class="error" id="name-error" hidden></p>
    <div class="field"><span class="field-label">${tr('color')}</span>
      <div class="colors">${COLORS.map(c => `<button type="button" data-act="pick-color" data-color="${c}" style="--c:${c}" aria-label="${c}" aria-pressed="${c === p.color}"></button>`).join('')}</div>
      <input type="hidden" name="color" value="${p.color}"></div>
    <p class="note" style="font-size:13px;color:var(--muted);margin-top:14px">${tr('archiveNote')}</p>
    <div class="btns">
      ${used ? `<button type="button" class="btn" data-act="toggle-archive">${p.archived ? tr('unarchive') : tr('archive')}</button>`
             : `<button type="button" class="btn danger" data-act="delete-project">${tr('delete')}</button>`}
      <button class="btn primary grow">${tr('save')}</button>
    </div>
  </form>`;
  sheet.showModal();
}
function submitProject(form) {
  const p = projectById(form.dataset.id);
  if (!p) return;
  const name = form.elements.name.value.trim().replace(/\s+/g, ' ').slice(0, 60);
  const err = $('#name-error');
  const other = name && projectByName(name);
  if (!name || (other && other !== p)) { err.textContent = name ? tr('nameTaken') : tr('projectError'); err.hidden = false; return; }
  const before = Object.assign({}, p);
  p.name = name;
  p.color = isColor(form.elements.color.value) ? form.elements.color.value : p.color;
  if (!saveData()) { Object.assign(p, before); return; }
  sheet.close();
  render();
}
function toggleArchive(p) {
  p.archived = !p.archived;
  if (!saveData()) { p.archived = !p.archived; return; }
  sheet.close();
  render();
}
function deleteProject(p) {
  if (data.entries.some(e => e.projectId === p.id)) return;
  if (!confirm(tr('confirmDeleteProject', p.name))) return;
  const i = data.projects.indexOf(p);
  data.projects.splice(i, 1);
  if (!saveData()) { data.projects.splice(i, 0, p); return; }
  sheet.close();
  toast(tr('deleted'));
  back();
}

/* ---------- Menu: language, projects, backup ---------- */
function menuHtml() {
  const last = settings.lastBackup ? ' ' + tr('backupLast', dateOf(settings.lastBackup).toLocaleDateString(locale(), { dateStyle: 'medium' })) : '';
  const list = data.projects.slice().sort((a, b) => (a.archived - b.archived) || a.name.localeCompare(b.name, locale()));
  return `<div class="view menu">
    <header class="topbar">
      <button class="icon-btn" data-act="back" aria-label="${tr('back')}">‹</button>
      <h2>${tr('menu')}</h2>
    </header>
    <h3>${tr('language')}</h3>
    <div class="seg">
      <button data-act="lang" data-lang="en" aria-pressed="${lang === 'en'}">English</button>
      <button data-act="lang" data-lang="it" aria-pressed="${lang === 'it'}">Italiano</button>
    </div>
    <h3>${tr('projects')}</h3>
    ${list.length ? `<div class="card plist">${list.map(p => `<button class="prow${p.archived ? ' archived' : ''}" data-act="open-project" data-id="${esc(p.id)}">
        <span class="dot" style="--c:${p.color}"></span><span class="name">${esc(p.name)}</span>${p.archived ? `<span class="tag">${tr('archived')}</span>` : ''}<span style="color:var(--muted)">›</span>
      </button>`).join('')}</div>` : `<p class="note">${tr('noProjects')}</p>`}
    <h3>${tr('backup')}</h3>
    <p class="note">${tr('backupNote')}${last}</p>
    <div class="btns">
      <button class="btn primary" data-act="export">${tr('exportBackup')}</button>
      <label class="btn">${tr('importBackup')}<input type="file" accept=".json,application/json" id="import-file" hidden></label>
    </div>
    ${creditHtml()}
  </div>`;
}
function exportBackup() {
  try {
    const blob = new Blob([JSON.stringify({ app: 'tempo', version: 1, projects: data.projects, entries: data.entries }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `tempo-${todayKey()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 60000);
    settings.lastBackup = todayKey();
    saveSettings();
    toast(tr('backupSaved'));
    render();
  } catch (e) {
    toast(tr('backupFailed'));
  }
}
async function importBackup(file) {
  let parsed;
  try {
    parsed = JSON.parse(await file.text());
    if (!parsed || parsed.app !== 'tempo' || !Array.isArray(parsed.projects) || !Array.isArray(parsed.entries)) throw new Error('bad');
  } catch (e) {
    toast(tr('notBackup'));
    return;
  }
  if (!confirm(tr('confirmImport'))) return;
  const before = data;
  data = cleanData(parsed);
  if (!saveData()) { data = before; return; }
  settings.lastBackup = todayKey();
  saveSettings();
  toast(tr('backupRestored'));
  render();
}

/* ---------- Toast ---------- */
let toastTimer;
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 2600);
}

/* ---------- Events ---------- */
document.addEventListener('click', ev => {
  const b = ev.target.closest('[data-act]');
  if (!b) return;
  const id = b.dataset.id;
  switch (b.dataset.act) {
    case 'back': back(); break;
    case 'menu': go('menu'); break;
    case 'tab': switchTab(b.dataset.tab); break;
    case 'day-prev': ui.day = addDays(ui.day, -1); render(); break;
    case 'day-next': ui.day = addDays(ui.day, 1); render(); break;
    case 'day-today': ui.day = todayKey(); render(); break;
    case 'add-entry': go('add'); break;
    case 'edit-entry': go('edit/' + encodeURIComponent(id)); break;
    case 'pick': {
      const p = projectById(id), input = $('#f-project');
      if (p && input) { input.value = p.name; $('#project-error').hidden = true; refreshSuggestions(); $('#f-hours').focus(); }
      break;
    }
    case 'quick': { const h = $('#f-hours'); h.value = fmtNum(Number(b.dataset.h)); $('#hours-error').hidden = true; break; }
    case 'delete-entry': if (ui.form && ui.form.entry) deleteEntry(ui.form.entry); break;
    case 'period': ui.period = b.dataset.period; ui.anchor = todayKey(); render(); break;
    case 'period-prev': movePeriod(-1); break;
    case 'period-next': movePeriod(1); break;
    case 'open-project': go('project/' + encodeURIComponent(id)); break;
    case 'edit-project': { const p = projectById(id); if (p) openProjectSheet(p); break; }
    case 'pick-color': {
      sheet.querySelectorAll('[data-act="pick-color"]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
      sheet.querySelector('[name="color"]').value = b.dataset.color;
      break;
    }
    case 'toggle-archive': { const p = projectById(sheet.querySelector('form').dataset.id); if (p) toggleArchive(p); break; }
    case 'delete-project': { const p = projectById(sheet.querySelector('form').dataset.id); if (p) deleteProject(p); break; }
    case 'lang': setLang(b.dataset.lang); break;
    case 'export': exportBackup(); break;
  }
});
document.addEventListener('submit', ev => {
  ev.preventDefault();
  if (ev.target.id === 'entry-form') submitEntry(ev.target);
  else if (ev.target.id === 'project-form') submitProject(ev.target);
});
document.addEventListener('input', ev => {
  if (ev.target.id === 'f-project') { $('#project-error').hidden = true; refreshSuggestions(); }
  if (ev.target.id === 'f-hours') $('#hours-error').hidden = true;
  if (ev.target.name === 'name' && $('#name-error')) $('#name-error').hidden = true;
});
document.addEventListener('keydown', ev => {
  /* Enter in the project field moves to the hours instead of saving */
  if (ev.key === 'Enter' && ev.target.id === 'f-project') { ev.preventDefault(); $('#f-hours').focus(); }
});
document.addEventListener('change', ev => {
  if (ev.target.id === 'import-file') {
    const file = ev.target.files[0];
    ev.target.value = '';
    if (file) importBackup(file);
  }
});
/* Coming back to the app on a new day shows that day */
let openedOn = todayKey();
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible' || todayKey() === openedOn) return;
  if (ui.day === openedOn) ui.day = todayKey();
  openedOn = todayKey();
  if (currentRoute().name === 'day') render();
});

/* ---------- Start ---------- */
render();

/* ---------- Offline support ---------- */
if ('serviceWorker' in navigator) {
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (hadController) location.reload(); });
  addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
