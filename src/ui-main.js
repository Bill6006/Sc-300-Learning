/* ================= rendering, actions and boot ================= */
const wide = () => window.matchMedia('(min-width: 1080px)').matches;

/* Re-rendering replaces HTML; keep the focused field and caret where they were. */
function keepFocus(fn) {
  const a = document.activeElement, id = a && a.id;
  const sel = a && typeof a.selectionStart === 'number' ? [a.selectionStart, a.selectionEnd] : null;
  fn();
  if (id) { const b = document.getElementById(id); if (b && b !== a) { b.focus({ preventScroll: true }); if (sel && typeof b.setSelectionRange === 'function') { try { b.setSelectionRange(sel[0], sel[1]); } catch (err) { /* not a text field */ } } } }
}
function render() {
  keepFocus(() => {
    document.body.classList.toggle('in-case', ui.view === 'case');
    document.querySelectorAll('[data-nav]').forEach(b => b.setAttribute('aria-current', String((ui.view === 'case' ? 'home' : ui.view) === b.getAttribute('data-nav'))));
    let html;
    try { html = ui.view === 'case' && CASE[ui.caseId] ? caseView(ui.caseId) : ui.view === 'review' ? reviewView() : homeView(); }
    catch (err) { console.error(err); html = '<p class="err">Something went wrong drawing this screen. Your progress is safe; go back to the casebook and try again.</p>'; }
    $('main').innerHTML = html;
    renderPanelInner();
  });
}
function renderPanel() { keepFocus(renderPanelInner); }
function renderPanelInner() {
  const p = $('panel'), top = ui.panel[ui.panel.length - 1];
  const docked = ui.view === 'case' && wide();
  document.body.classList.toggle('docked', docked);
  document.body.classList.toggle('panel-open', !!top && !docked);
  $('scrim').hidden = !top || docked;
  if (!top) {
    if (!docked) { p.hidden = true; return; }
    p.hidden = false;
    $('panelTitle').textContent = 'Case file';
    $('panelBack').hidden = true; $('panelClose').hidden = true;
    const C = CASE[ui.caseId];
    $('panelBody').innerHTML = `<div class="dock-empty"><p>Evidence and tools open here, beside the case, so you never lose your place.</p><div class="thread">${C.read.msgs.slice(0, 1).map(msgHtml).join('')}</div></div>`;
    return;
  }
  let r;
  try { r = (PANELS[top.type] || (() => ({ title: '', body: '<p>Not found.</p>' })))(top); }
  catch (err) { console.error(err); r = { title: 'Something went wrong', body: '<p class="err">This panel couldn’t be drawn. Close it and try again.</p>' }; }
  p.hidden = false;
  $('panelTitle').textContent = r.title;
  $('panelBack').hidden = ui.panel.length < 2;
  $('panelClose').hidden = false;
  $('panelBody').innerHTML = r.body;
}
function openPanel(o) {
  ui.draft = null; ui.msg = ''; ui.confirm = null; ui.form.wiRes = ui.form.wiRes && o.type === 'whatif' ? ui.form.wiRes : null; ui.form.madeSecret = null;
  if (o.type === 'concept') { meet(o.id, ui.caseId || 'review'); dirtyMeta = true; saveLocal(); pushSoon(); }
  if (ui.view === 'case') { const c = cs(ui.caseId), k = JSON.stringify(o); if (!c.opened[k]) { c.opened[k] = true; touch(ui.caseId); } }
  const top = ui.panel[ui.panel.length - 1];
  if (!(top && JSON.stringify(top) === JSON.stringify(o))) ui.panel.push(o);
  if (ui.panel.length > 8) ui.panel.shift();
  if (o.tab) { const key = o.type === 'signin' ? 'si-' + o.id : o.type === 'entapp' ? 'ea-' + o.id : o.type === 'appreg' ? 'ar-' + o.id : o.type === 'vm' ? 'vm' : null; if (key) ui.tab[key] = o.tab; }
  render();
  const b = $('panelBody'); if (b) b.scrollTop = 0;
  const h = $('panelTitle'); if (h && !wide()) h.focus({ preventScroll: true });
}
const replaceTop = o => { ui.panel[ui.panel.length - 1] = o; };
function scrollToStage() { const s = document.querySelector('.casehead'); if (s) { const y = s.getBoundingClientRect().top + window.scrollY - 64; window.scrollTo({ top: Math.max(0, y), behavior: 'auto' }); } }
function go(view, caseId) {
  ui.view = view; ui.caseId = caseId || null; ui.panel = []; ui.draft = null; ui.form = {}; ui.msg = ''; ui.confirm = null; ui.tab = {};
  render(); window.scrollTo(0, 0);
}

/* ----- actions ----- */
const tnNow = () => cs(ui.caseId).tn;
const change = res => { const ok = applyChange(ui.caseId, res); render(); return ok; };
const fixOnly = f => (v, el) => { if (!inFix()) { toast('You can change things in the Fix step.'); return; } f(v, el); };
const ACT = {
  home: () => go('home'),
  review: () => { ui.quiz = null; go('review'); },
  menu: () => openPanel({ type: 'menu' }),
  'go-case': id => { cs(id); go('case', id); },
  open: v => { try { openPanel(JSON.parse(v)); } catch (err) { /* malformed */ } },
  'panel-back': () => { ui.panel.pop(); ui.draft = null; ui.msg = ''; ui.confirm = null; render(); },
  'panel-close': () => { ui.panel = []; ui.draft = null; ui.msg = ''; ui.confirm = null; render(); },
  ptab: v => { const i = v.lastIndexOf(':'); ui.tab[v.slice(0, i)] = v.slice(i + 1); ui.draft = null; ui.msg = ''; ui.confirm = null; renderPanel(); },
  confirm: v => { ui.confirm = v; render(); },
  'confirm-no': () => { ui.confirm = null; render(); },

  /* steps */
  stage: v => {
    const c = cs(ui.caseId), i = +v;
    if (i === 2 && !CASE[ui.caseId].investigate.notes.every(n => c.notes[n.id] === n.a)) return;
    c.stage = i; c.max = Math.max(c.max, i); ui.confirm = null; ui.panel = []; ui.draft = null;
    touch(ui.caseId); render(); scrollToStage();
  },
  ask: id => { const c = cs(ui.caseId); if (c.asked[id]) return; c.asked[id] = Date.now(); touch(ui.caseId); render(); },
  note: v => {
    const [nid, opt] = v.split('|'), c = cs(ui.caseId), n = CASE[ui.caseId].investigate.notes.find(x => x.id === nid);
    if (!n || c.notes[nid] === n.a) return;
    c.notes[nid] = opt;
    if (opt !== n.a) c.misses[nid] = (c.misses[nid] || 0) + 1;
    touch(ui.caseId); render();
  },
  hint: stage => { const c = cs(ui.caseId); c.hints[stage] = (c.hints[stage] || 0) + 1; ui.hintFlash = stage + (c.hints[stage] - 1); touch(ui.caseId); render(); },
  test: id => { runTest(ui.caseId, id); render(); },
  'close-case': () => { closeCase(ui.caseId); ui.panel = []; ui.confirm = null; render(); scrollToStage(); },
  reopen: () => { reopenCase(ui.caseId); ui.confirm = null; render(); scrollToStage(); },
  restart: () => { restartCase(ui.caseId); ui.confirm = null; ui.panel = []; render(); scrollToStage(); toast('The case starts over. Your stamps are kept.'); },
  undo: () => { undoAll(ui.caseId); ui.confirm = null; ui.panel = []; ui.draft = null; render(); toast('The tenant is back the way this case started.'); },
  'exam-pick': v => { const [qid, opt] = v.split('|'), c = cs(ui.caseId); if (!c.result || c.result.exam[qid]) return; c.result.exam[qid] = opt; answerQ(qid, opt === QMAP[qid].a); touch(ui.caseId); render(); },

  /* review */
  'quiz-start': v => { startQuiz(v || null); render(); window.scrollTo(0, 0); },
  'quiz-one': v => { ui.panel = []; startQuiz(v); render(); window.scrollTo(0, 0); },
  'quiz-pick': v => { const [qid, opt] = v.split('|'); if (!ui.quiz || ui.quiz.picks[qid]) return; ui.quiz.picks[qid] = opt; answerQ(qid, opt === QMAP[qid].a); touch(); render(); },
  'quiz-next': () => { ui.quiz.i++; render(); window.scrollTo(0, 0); },
  'quiz-done': () => { ui.quiz = null; render(); window.scrollTo(0, 0); },
  'reset-all': async () => { S = freshState(); saveLocal(); await clearCloud(); ui.quiz = null; go('home'); toast('All progress cleared.'); },

  /* the copier, the passkeys, the export */
  plan: fixOnly(id => change(c2Pick(tnNow(), id))),
  'acct-reset': fixOnly(uid => { const tn = tnNow(); if (tn.pwReset[uid]) return; tn.pwReset[uid] = true; auditPush(tn, 'Reset user password', U[uid].name, [], 'Core Directory'); change({ ok: true, summary: 'Reset ' + U[uid].name + '’s password. Marcus put the new one into the copier.' }); }),
  'acct-disable': fixOnly(uid => { const tn = tnNow(); if (tn.disabled[uid]) return; tn.disabled[uid] = true; auditPush(tn, 'Disable account', U[uid].name, [['AccountEnabled', 'true', 'false']], 'Core Directory'); change({ ok: true, summary: 'Blocked sign-in for ' + U[uid].name + '.' }); }),
  'c5-self': fixOnly(() => { if (change(c5SelfPasskey(tnNow()))) toast('Added a passkey in Microsoft Authenticator.'); else toast(ui.msg); }),
  'c5-marcus': fixOnly(() => { const r = c5AskMarcus(tnNow()); if (change(r)) toast('Marcus: “Done. I added a passkey in Authenticator.”'); else toast(r.err); }),
  'c8-switch': fixOnly(() => { const r = opSwitchToMi(tnNow()); if (change(r)) toast('Noah: “Switched. Tonight’s run is the first real one.”'); else toast(r.err); }),

  /* Conditional Access policies */
  'pol-new': fixOnly(key => { ui.draft = Object.assign(newPolicyFrom(key, tnNow().cfg), { kind: 'policy' }); ui.form.open = { users: true, grant: true }; ui.msg = ''; replaceTop({ type: 'policy', id: ui.draft.id }); renderPanel(); }),
  'pol-edit': fixOnly(id => { const p = policyById(id, tnNow().cfg); if (!p) return; ui.draft = Object.assign(policyDraft(p), { kind: 'policy' }); ui.form.open = {}; ui.msg = ''; renderPanel(); }),
  'pd-tog': v => { const d = ui.draft; if (!d) return; const i = v.indexOf(':'), f = v.slice(0, i), x = v.slice(i + 1); if (f === 'uGuests') d.uGuests = !d.uGuests; else { const a = d[f]; const k = a.indexOf(x); if (k >= 0) a.splice(k, 1); else a.push(x); } renderPanel(); },
  'pd-uall': v => { ui.draft.uAll = v === 'all'; renderPanel(); },
  'pd-resall': v => { ui.draft.resAll = v === 'all'; renderPanel(); },
  'pd-netinc': v => { ui.draft.netInc = v; renderPanel(); },
  'pd-netex': v => { ui.draft.netEx = v; renderPanel(); },
  'pd-clients': v => { ui.draft.clientsOn = v === 'sel'; if (ui.draft.clientsOn && !ui.draft.clients.length) ui.draft.clients = ['eas', 'other']; renderPanel(); },
  'pd-grant': v => { ui.draft.block = v === 'block'; renderPanel(); },
  'pd-op': v => { ui.draft.op = v; renderPanel(); },
  'pd-state': v => { ui.draft.state = v; renderPanel(); },
  'pd-userrm': v => { const [w, u] = v.split(':'), a = w === 'inc' ? ui.draft.uUsers : ui.draft.exUsers; const k = a.indexOf(u); if (k >= 0) a.splice(k, 1); renderPanel(); },
  'pd-useradd': w => { const u = ui.form['pdu' + w]; if (!u) return; const a = w === 'inc' ? ui.draft.uUsers : ui.draft.exUsers; if (a.indexOf(u) < 0) a.push(u); ui.form['pdu' + w] = ''; renderPanel(); },
  'pol-save': fixOnly(() => {
    const d = ui.draft; if (!d) return;
    const wasNew = d.isNew;
    const res = opSavePolicy(tnNow(), d);
    if (applyChange(ui.caseId, res)) { ui.draft = null; if (wasNew) replaceTop({ type: 'policy', id: res.pid }); toast(wasNew ? 'Created ' + res.pid + '.' : res.none ? 'Nothing changed.' : 'Saved ' + res.pid + '. It applies to new sign-ins.'); }
    render();
  }),
  'pol-delete': fixOnly(id => { if (change(opDeletePolicy(tnNow(), id))) { ui.panel.pop(); ui.confirm = null; render(); toast('Deleted ' + id + '.'); } }),
  'draft-cancel': () => { const d = ui.draft; ui.draft = null; ui.msg = ''; if (d && (d.isNew || d.id === 'new')) ui.panel.pop(); render(); },

  /* named locations */
  'loc-new': fixOnly(() => { ui.draft = { kind: 'location', id: 'new', name: '', ranges: [], trusted: false }; ui.form.range = ''; ui.msg = ''; ui.panel.push({ type: 'location', id: 'new' }); render(); }),
  'loc-edit': fixOnly(id => { const l = locById(id, tnNow().cfg); if (!l) return; ui.draft = { kind: 'location', id, name: l.name, ranges: l.ranges.slice(), trusted: !!l.trusted }; ui.form.range = ''; ui.msg = ''; renderPanel(); }),
  'ld-add': () => { const d = ui.draft; if (!d) return; const r = checkRange(ui.form.range, d.ranges); if (r.err) { ui.msg = r.err; } else { d.ranges.push(r.text); ui.form.range = ''; ui.msg = r.note || ''; } renderPanel(); const i = $('ldRange'); if (i) i.focus(); },
  'ld-rm': r => { const d = ui.draft; if (!d) return; d.ranges = d.ranges.filter(x => x !== r); renderPanel(); },
  'loc-save': fixOnly(() => {
    const d = ui.draft; if (!d) return;
    if ((ui.form.range || '').trim()) { const r = checkRange(ui.form.range, d.ranges); if (r.err) { ui.msg = r.err; renderPanel(); return; } d.ranges.push(r.text); ui.form.range = ''; }
    const res = opSaveLocation(tnNow(), d.id, d);
    if (applyChange(ui.caseId, res)) { if (d.id === 'new') replaceTop({ type: 'location', id: res.id }); ui.draft = null; toast(res.none ? 'Nothing changed.' : 'Saved “' + d.name.trim() + '”.'); }
    render();
  }),
  'loc-delete': fixOnly(id => { const name = (locById(id, tnNow().cfg) || {}).name; if (change(opDeleteLocation(tnNow(), id))) { ui.panel.pop(); ui.confirm = null; render(); toast('Deleted “' + name + '”.'); } else { ui.confirm = null; renderPanel(); } }),

  /* authentication methods, passes and sessions */
  'md-edit': fixOnly(m => { ui.draft = Object.assign(methodDraft(tnNow().cfg, m), { kind: 'method' }); ui.msg = ''; renderPanel(); }),
  'md-state': v => { ui.draft.state = v; renderPanel(); },
  'md-incall': v => { ui.draft.incAll = v === 'all'; renderPanel(); },
  'md-tog': v => { const [f, g] = v.split(':'), a = ui.draft[f]; const k = a.indexOf(g); if (k >= 0) a.splice(k, 1); else a.push(g); renderPanel(); },
  'md-save': fixOnly(() => { const d = ui.draft; if (!d) return; const res = opSaveMethod(tnNow(), d); if (applyChange(ui.caseId, res)) { ui.draft = null; toast(res.none ? 'Nothing changed.' : 'Saved ' + METHODS[d.m] + '.'); } render(); }),
  'tap-start': v => { ui.form.tap.start = v; renderPanel(); },
  'tap-create': fixOnly(() => {
    const tn = tnNow(), f = ui.form.tap;
    const shiftT = (ui.caseId === 'c3' ? nextSessionT(tn) : nextWorkday(dayOf(tn.now)) * 86400 + 6 * 3600) - 900;
    const res = opCreateTaps(tn, { target: f.target, start: f.start === 'now' ? tn.now : shiftT, life: +f.life, oneTime: !!f.oneTime });
    if (applyChange(ui.caseId, res)) toast('Created ' + plural(res.made.length, 'pass', 'passes') + '. Tomáš has the slips.');
    render();
  }),
  'session-run': fixOnly(() => { const res = c3Session(tnNow(), (ui.form.session || {}).gid || 'g-line2'); if (applyChange(ui.caseId, res)) toast('Tomáš sent you the results.'); render(); }),

  /* What If */
  'wi-ip': ip => { ui.form.wi.ip = ip; renderPanel(); },
  'wi-run': () => {
    const q = ui.form.wi, tn = tnNow();
    if (ipToInt(q.ip) === null) { ui.msg = 'That isn’t a valid IPv4 address.'; renderPanel(); return; }
    ui.msg = '';
    ui.form.wiRes = whatIf(tn, q);
    const c = cs(ui.caseId);
    if (c.stage >= 2 && !c.result) { c.testedAt = c.ver; touch(ui.caseId); }
    render();
    const r = document.querySelector('#panelBody .result'); if (r) r.scrollIntoView({ block: 'nearest' });
  },

  /* apps */
  'fl-add': fixOnly(() => { if (change(opAddFieldline(tnNow()))) { replaceTop({ type: 'entapp', id: FL.ent, tab: 'sso' }); ui.tab['ea-' + FL.ent] = 'sso'; render(); toast('Added Fieldline CRM.'); } }),
  'ea-prop': v => { const [k, x] = v.split(':'); ui.form.props[k] = x === 'yes'; renderPanel(); },
  'ea-props-save': fixOnly(id => { const f = ui.form.props; if (change(opSaveProps(tnNow(), id, f))) toast('Saved.'); }),
  'saml-edit': fixOnly(() => { const a = flApp(tnNow()); ui.draft = { kind: 'saml', identifier: a.saml.identifier, reply: a.saml.reply, login: a.saml.login }; ui.msg = ''; renderPanel(); }),
  'saml-save': fixOnly(() => { const d = ui.draft; if (!d) return; const res = opSaveSaml(tnNow(), d); if (applyChange(ui.caseId, res)) { ui.draft = null; toast(res.none ? 'Nothing changed.' : 'Saved the SAML settings.'); } render(); }),
  'meta-send': fixOnly(() => { if (change(opSendMeta(tnNow()))) toast('Sam at Fieldline: “Got it. Tallis is switched to single sign-on.”'); }),
  assign: fixOnly(appId => { const f = ui.form.assign || {}; if (change(opAssign(tnNow(), appId, f.who, f.role))) { ui.form.assign.who = ''; render(); toast('Assigned.'); } }),
  unassign: fixOnly(v => { const [appId, asId] = v.split('|'); ui.confirm = null; change(opUnassign(tnNow(), appId, asId)); }),
  'secret-add': fixOnly(regId => { const f = ui.form.secret; const res = opAddSecret(tnNow(), regId, f.desc, +f.life); if (applyChange(ui.caseId, res)) { ui.form.madeSecret = res.secret.id; ui.form.secret = { desc: '', life: 180 }; } render(); }),
  'secret-hand': fixOnly(sid => { if (change(opHandSecret(tnNow(), sid))) toast('Noah: “Got it. The script uses the new secret from tonight.”'); }),
  'secret-del': fixOnly(v => { const [regId, sid] = v.split('|'); ui.confirm = null; if (ui.form.madeSecret === sid) ui.form.madeSecret = null; change(opDelSecret(tnNow(), regId, sid)); }),
  'mi-set': fixOnly(v => { ui.confirm = null; change(opSetVmIdentity(tnNow(), v === 'on')); }),
  'role-add': fixOnly(() => { const f = ui.form.role || {}; if (change(opAddRole(tnNow(), f.role, f.who))) { ui.form.role = { role: '', who: '' }; render(); toast('Role assigned.'); } }),
  'role-del': fixOnly(id => { ui.confirm = null; change(opDelRole(tnNow(), id)); }),

  /* sign-in log filters */
  sf: v => { ui.form.sf.status = v; renderPanel(); }
};
document.addEventListener('click', ev => {
  const el = ev.target.closest('[data-act]');
  if (!el || el.disabled) return;
  const f = ACT[el.getAttribute('data-act')];
  if (!f) return;
  ev.preventDefault();
  try { f(el.getAttribute('data-v'), el); } catch (err) { console.error(err); toast('Something went wrong. Your progress is safe.'); }
});

/* ----- fields ----- */
const NUMERIC = /(^|\.)(life|minMin|maxMin|defMin)$/;
function setBind(path, val) {
  if (path === 'case.note') { cs(ui.caseId).note = val; clearTimeout(setBind.t); setBind.t = setTimeout(() => touch(ui.caseId), 800); return; }
  if (path === 'sf.q') { ui.form.sf.q = val; return; }
  const parts = path.split('.'), root = parts.shift();
  let o = root === 'draft' ? ui.draft : ui.form;
  if (!o) return;
  if (root === 'draft' && parts[0] === 'strength') { const d = ui.draft; d.ctl = d.ctl.filter(c => !/^str:/.test(c)); if (val) { d.ctl = d.ctl.filter(c => c !== 'mfa'); d.ctl.push(val); } return; }
  while (parts.length > 1) { const k = parts.shift(); o = o[k] = o[k] || {}; }
  o[parts[0]] = NUMERIC.test(path) && val !== '' ? +val : val;
}
document.addEventListener('input', ev => {
  const el = ev.target.closest('[data-bind]');
  if (!el || el.tagName === 'SELECT' || el.type === 'checkbox') return;
  const path = el.getAttribute('data-bind');
  setBind(path, el.value);
  if (path === 'sf.q' || path === 'form.gq' || path === 'form.range') renderPanel();
});
document.addEventListener('change', ev => {
  const el = ev.target.closest('[data-bind]');
  if (!el || !(el.tagName === 'SELECT' || el.type === 'checkbox')) return;
  setBind(el.getAttribute('data-bind'), el.type === 'checkbox' ? el.checked : el.value);
  renderPanel();
});
document.addEventListener('toggle', ev => {
  const el = ev.target;
  if (el.matches && el.matches('details.ed')) { ui.form.open = ui.form.open || {}; ui.form.open[el.getAttribute('data-sec')] = el.open; }
}, true);
document.addEventListener('keydown', ev => {
  if (ev.key === 'Escape' && ui.panel.length) { ui.panel = []; ui.draft = null; ui.msg = ''; render(); }
  if (ev.key === 'Enter' && ev.target && ev.target.id === 'ldRange') { ev.preventDefault(); ACT['ld-add'](); }
});
let resizeTimer = 0;
window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(renderPanel, 120); });

/* ----- boot (keeps your place if the page updates while open) ----- */
function start(hot) {
  S = loadLocal();
  const h = (hot && hot.ui) || null;
  if (h && (h.view === 'case' ? CASE[h.caseId] : ['home', 'review'].indexOf(h.view) >= 0)) {
    ui.view = h.view; ui.caseId = h.caseId || null;
    ui.panel = Array.isArray(h.panel) ? h.panel.filter(o => o && PANELS[o.type]).slice(-4) : [];
  }
  render();
  connectCloud().then(changed => { if (changed) render(); });
}
try {
  const hot = window.claude && window.claude.hot;
  if (hot && typeof hot.snapshot === 'function') hot.snapshot(() => ({ ui: { view: ui.view, caseId: ui.caseId, panel: ui.panel } }));
} catch (err) { /* no viewer */ }
const hotApi = window.claude && window.claude.hot;
if (hotApi && typeof hotApi.ready === 'function') hotApi.ready(start);
else start((hotApi && hotApi.data) || {});
