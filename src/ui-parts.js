/* ================= small pieces of the interface ================= */
const $ = id => document.getElementById(id);
const ui = { view: 'home', caseId: null, panel: [], draft: null, form: {}, msg: '', confirm: null, quiz: null, hintFlash: null, tab: {} };
let toastTimer = 0;
function toast(text) { const t = $('toast'); if (!t) return; t.textContent = text; t.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, 3200); }

const attr = s => esc(s);
const btn = (act, v, label, cls, extra) => `<button type="button" class="${cls || 'btn'}" data-act="${act}"${v !== undefined && v !== null ? ` data-v="${attr(v)}"` : ''}${extra || ''}>${label}</button>`;
const pill = (cls, text) => `<span class="pill ${cls}">${esc(text)}</span>`;
const mark = ok => ok === true ? '<span class="mk ok" aria-label="Went right">✓</span>' : ok === false ? '<span class="mk bad" aria-label="Went wrong">✗</span>' : '<span class="mk info" aria-label="Note">•</span>';
function kv(rows) { return `<dl class="kv">${rows.filter(Boolean).map(r => `<dt>${esc(r[0])}</dt><dd>${r[2] ? r[1] : esc(r[1])}</dd>`).join('')}</dl>`; }
const termLink = (id, text) => TERMS[id] ? `<button type="button" class="term" data-act="open" data-v="${attr(JSON.stringify({ type: 'concept', id }))}">${esc(text || TERMS[id].name)}</button>` : esc(text);
const openAttr = o => `data-act="open" data-v="${attr(JSON.stringify(o))}"`;
const statusClass = s => s === 'Success' ? 'ok' : s === 'Interrupted' ? 'warn' : 'bad';
const resultClass = r => r === 'Success' ? 'ok' : r === 'Failure' ? 'bad' : r === 'Disabled' ? 'off' : /Report-only: Failure/.test(r) ? 'bad' : /Report-only: Success/.test(r) ? 'ok' : /User action/.test(r) ? 'warn' : 'off';
const stateClass = s => s === 'on' ? 'ok' : s === 'reportOnly' ? 'ro' : 'off';
const stamp = (on, label) => `<span class="stamp${on ? '' : ' off'}">${esc(label)}</span>`;
const stampsHtml = b => `<span class="stamps">${stamp(b && b.solved, 'Solved')}${stamp(b && b.tested, 'Tested')}${stamp(b && b.tidy, 'Tidy')}</span>`;
function greeting() { const h = new Date().getHours(); return h < 5 ? 'Hello' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'; }
const minutesLeft = (C, c) => Math.max(2, Math.round(C.mins * (1 - (c ? c.stage : 0) / 5)));

/* Shown when Petra sends a screenshot. */
const SHOTS = {
  e53003: `<div class="errshot" role="img" aria-label="Screenshot of the error page"><span class="es-k">Sign in</span><b>You can’t access this right now</b><span>Your sign-in was successful, but it doesn’t meet the criteria to access this resource. For example, you might be signing in from a location your admin restricts.</span><span class="es-fine">Error code: 53003 · Timestamp: 2026-10-05 06:11 · App: Microsoft Teams</span></div>`
};
function msgHtml(m) {
  const me = m.from === 'you';
  const when = m.when || (m.t !== undefined ? clk(m.t).wd + ' ' + clk(m.t).hm : '');
  return `<div class="msg${me ? ' me' : ''}"><p class="who">${esc(personName(m.from))}${me ? '' : `<span> · ${esc(personTitle(m.from))}</span>`}${when ? `<span> · ${esc(when)}</span>` : ''}</p><p>${esc(m.text)}</p>${m.shot ? SHOTS[m.shot] : ''}${m.doc ? `<button type="button" class="attach" ${openAttr({ type: 'doc', id: m.doc })}>${ICON.clip}<span>${esc(DOCS[m.doc].title)}</span></button>` : ''}</div>`;
}
/* A sign-in as one row in a list. */
function signinRow(e, opener) {
  const u = U[e.user], c = clk(e.t), sc = statusClass(e.status);
  return `<button type="button" class="row" ${openAttr(opener || { type: 'signin', id: e.id })}><span class="dot ${sc}"></span><span class="rmain"><b>${esc(u.name)}</b><span class="mono">${esc(e.ip)} · ${c.wd} ${c.hm} · ${esc(APP_SHORT[e.app] || e.app)}${e.client && isLegacy(e.client) ? ' · ' + esc(CLIENTS[e.client]) : ''}</span></span>${pill(sc, e.status)}</button>`;
}
function policyRow(p, cfg) { return `<button type="button" class="row" ${openAttr({ type: 'policy', id: p.id })}><span class="dot ${stateClass(p.state)}"></span><span class="rmain"><b>${esc(p.name)}</b><span>${esc(policySummary(p, cfg))}</span></span>${pill(stateClass(p.state), STATE[p.state])}</button>`; }
