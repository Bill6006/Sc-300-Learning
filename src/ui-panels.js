/* ================= the panel: evidence, tools and concepts =================
   One panel at a time, with a short back stack. On phones it covers the screen; on wide screens it sits beside the case. */

const PANELS = {};
const curC = () => ui.caseId ? cs(ui.caseId) : null;
const curTn = () => curC() ? curC().tn : null;
const inFix = () => ui.view === 'case' && !!curC() && curC().stage === 2 && !curC().result;
const editNote = () => ui.view === 'case' ? `<p class="lock-note">You can change this in the Fix step.</p>` : '';
const ptabs = (tabs, cur, key) => `<div class="ptabs" role="tablist">${tabs.map(t => `<button type="button" role="tab" data-act="ptab" data-v="${attr(key + ':' + t[0])}" aria-selected="${cur === t[0]}">${esc(t[1])}</button>`).join('')}</div>`;
const tabOf = (o, key, def) => (ui.tab[key] || o.tab || def);
const errHtml = () => ui.msg ? `<p class="err" role="alert">${esc(ui.msg)}</p>` : '';
const ICON = {
  clip: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 12.5l6.4-6.4a3 3 0 0 1 4.2 4.2l-8.1 8.1a5 5 0 0 1-7-7L11 4"/></svg>'
};

/* ----- documents ----- */
PANELS.doc = o => {
  const d = DOCS[o.id];
  if (!d) return { title: 'Document', body: '<p>Not found.</p>' };
  let body = `<p class="meta">${esc(d.meta)}</p>`;
  if (d.thread) body += `<div class="thread">${d.thread.map(m => msgHtml({ when: m[0], from: m[1], text: m[2] })).join('')}</div>`;
  if (d.body) body += `<div class="mail">${d.body.map(x => Array.isArray(x) ? `<p class="mailkv"><span>${esc(x[0])}</span><code>${esc(x[1])}</code></p>` : `<p>${esc(x)}</p>`).join('')}</div>`;
  return { title: d.title, body };
};

/* ----- sign-ins ----- */
PANELS.signin = o => {
  const e = findSignin(ui.caseId, o.id);
  if (!e) return { title: 'Sign-in', body: '<p class="muted">This sign-in isn’t in the log anymore.</p>' };
  const u = U[e.user], c = clk(e.t), tab = tabOf(o, 'si-' + e.id, 'basic');
  let body = `<p class="meta">${pill(statusClass(e.status), e.status)} ${esc(c.dayLong)} ${esc(c.date)}, ${c.hms}</p>` + ptabs([['basic', 'Basic info'], ['loc', 'Location'], ['auth', 'Authentication'], ['ca', 'Conditional Access']], tab, 'si-' + e.id);
  if (tab === 'basic') {
    body += kv([['User', u.name + ' (' + u.upn + ')'], ['Application', APPS[e.app] || e.app], ['Client app', CLIENTS[e.client] + (isLegacy(e.client) && e.browser ? ' (' + e.browser + ')' : '')], ['Device', e.device ? e.device + ' · ' + (e.devJoin || '') + (e.devCompliant ? ', compliant' : ', not compliant') : 'Not registered'], ['Status', e.status], ['Sign-in error code', e.code ? String(e.code) : '0'], ['Failure reason', e.reason || '—'], ['Authentication requirement', e.authReq], ['Conditional Access', e.caStatus]]);
    if (e.code === 53003) body += `<p class="note">The password worked, so ${termLink('authn', 'authentication')} succeeded. A policy then refused access: that’s ${termLink('authz', 'authorization')}.</p>`;
    if (e.code === 50105) body += `<p class="note">The password worked. The app’s ${termLink('assignreq', 'Assignment required')} setting refused someone who isn’t assigned.</p>`;
    if (e.code === 50011 || e.code === 700016) body += `<p class="note">Nobody got as far as a password: the request didn’t match the app’s ${termLink('sso', 'SAML settings')}.</p>`;
    if (e.flRole) body += `<p class="note">Fieldline signed them in as ${esc(e.flRole)}.</p>`;
    body += `<p class="ids mono">Request ID ${esc(e.req)}<br>Correlation ID ${esc(e.corr)}</p>`;
  } else if (tab === 'loc') {
    const tn = curTn();
    body += kv([['IP address', e.ip], ['Location', e.city + ', ' + (COUNTRY[e.cc] || 'Unknown')], ['Named locations matched', e.matched.length ? e.matched.map(id => locName(id, tn.cfg)).join(', ') : 'None'], ['Trusted location', e.trusted ? 'Yes' : 'No']]);
    body += `<p class="note">Conditional Access only sees the public address a sign-in comes from. A ${termLink('namedloc', 'named location')} matches when that address is inside one of its ranges.</p>`;
  } else if (tab === 'auth') {
    body += `<table class="tbl"><thead><tr><th>Step</th><th>Method</th><th>Result</th></tr></thead><tbody>${e.steps.map((x, i) => `<tr><td>${i === 0 ? 'Primary' : 'Secondary'}</td><td>${esc(x[0])}</td><td>${esc(x[1])}</td></tr>`).join('') || '<tr><td colspan="3">No authentication steps.</td></tr>'}</tbody></table>`;
    if (e.code === 50079) body += `<p class="note">${e.need === 'phish' ? 'A policy requires phishing-resistant MFA, and this person has no passkey they can use here.' : 'A policy requires MFA, and this person has no method they can use here.'}${e.atKiosk ? ' Phones stay in the lockers on the floor.' : ''}</p>`;
    if (isLegacy(e.client)) body += `<p class="note">${termLink('legacy', 'Legacy clients')} send only a password. They can’t do MFA at all.</p>`;
  } else {
    body += `<p class="note">Every ${termLink('ca', 'Conditional Access')} policy that was evaluated. All that apply must be satisfied, and a block wins.</p>`;
    body += e.ca.length ? `<div class="prows">${e.ca.map(x => `<div class="prow"><button type="button" class="pname" ${openAttr({ type: 'policy', id: x.pid })}>${esc(x.name)}</button>${pill(resultClass(x.result), x.result)}<p class="why">${esc(x.why)}</p></div>`).join('')}</div>` : `<p class="muted">${esc(e.caNote || 'Conditional Access wasn’t evaluated, because primary authentication didn’t succeed.')}</p>`;
    if (e.ro.length) body += `<h3 class="h3">${termLink('reportonly', 'Report-only')} results</h3><div class="prows">${e.ro.map(x => `<div class="prow"><button type="button" class="pname" ${openAttr({ type: 'policy', id: x.pid })}>${esc(x.name)}</button>${pill(resultClass(x.result), x.result)}<p class="why">${esc(x.why)}</p></div>`).join('')}</div>`;
  }
  return { title: u.name + ' · ' + (APP_SHORT[e.app] || e.app), body };
};
PANELS.signins = o => {
  const f = ui.form.sf || (ui.form.sf = { q: '', status: 'all' });
  const all = seedsOf(ui.caseId).filter(e => !e.kind).concat(curC().logs.filter(e => !e.kind && e.user)).filter(e => !o.user || e.user === o.user);
  const q = f.q.trim().toLowerCase();
  const rows = all.filter(e => (f.status === 'all' || (f.status === 'fail' ? e.status !== 'Success' : e.status === 'Success')) && (!q || (U[e.user].name + ' ' + ascii(U[e.user].name) + ' ' + e.ip + ' ' + e.city + ' ' + (APPS[e.app] || '')).toLowerCase().indexOf(q) >= 0)).sort((a, b) => b.t - a.t);
  const chip = (v, l) => `<button type="button" class="chip" data-act="sf" data-v="${v}" aria-pressed="${f.status === v}">${l}</button>`;
  return { title: o.user ? 'Sign-ins · ' + U[o.user].name : 'Sign-in log', body: `<p class="note">Every attempt to get in, newest first. Open one to see which policies decided it.</p>
    ${o.user ? '' : `<label class="field"><span>Search</span><input type="search" id="sfq" data-bind="sf.q" value="${attr(f.q)}" placeholder="Name, IP address or city" autocomplete="off"></label>`}
    <div class="chips">${chip('all', 'All')}${chip('fail', 'Failures')}${chip('ok', 'Successes')}</div>
    <div class="list" id="sfList">${rows.map(e => signinRow(e)).join('') || '<p class="empty">No sign-ins match.</p>'}</div>` };
};

/* ----- Conditional Access ----- */
PANELS.policies = () => {
  const cfg = curTn().cfg;
  return { title: 'Conditional Access policies', body: `<p class="note">Every policy that’s on or in ${termLink('reportonly', 'report-only')} is evaluated at each sign-in. All that apply must be satisfied, and a block wins.</p>
    <div class="list">${cfg.policies.map(p => policyRow(p, cfg)).join('')}</div>
    ${inFix() ? `<div class="cta">${btn('open', JSON.stringify({ type: 'newpolicy' }), 'New policy', 'btn ghost')}</div>` : ''}` };
};
PANELS.newpolicy = () => ({ title: 'New Conditional Access policy', body: `<p class="note">Templates come from Microsoft’s recommended policies. They start in report-only mode and exclude the admin who creates them.</p>
  ${inFix() ? `<div class="optlist">${TEMPLATES.map(t => `<button type="button" class="opt" data-act="pol-new" data-v="${t.key}"><span class="box"></span><span>${esc(t.name)}</span></button>`).join('')}<button type="button" class="opt" data-act="pol-new" data-v="blank"><span class="box"></span><span>Start from a blank policy</span></button></div>` : editNote()}` });
PANELS.policy = o => {
  const tn = curTn(), cfg = tn.cfg;
  if (ui.draft && ui.draft.kind === 'policy' && ui.draft.id === o.id) return { title: (ui.draft.isNew ? 'New policy ' : 'Edit ') + o.id, body: policyEditHtml(ui.draft, cfg) };
  const p = policyById(o.id, cfg);
  if (!p) return { title: 'Policy', body: '<p class="muted">This policy was deleted.</p>' };
  const ut = usersText(p), nt = netText(p, cfg);
  let body = `<p class="meta">${pill(stateClass(p.state), STATE[p.state])} Last changed ${esc(p.modified || '')}</p>` + kv([
    ['Users', 'Include: ' + esc(ut.inc) + '<br>Exclude: ' + esc(ut.ex), true],
    ['Target resources', p.resources.include === 'all' ? 'All resources' : p.resources.include.map(appLabel).join(', ')],
    ['Network', 'Include: ' + esc(nt.inc) + '<br>Exclude: ' + esc(nt.ex), true],
    ['Client apps', p.clientApps ? p.clientApps.map(c => CLIENTS[c]).join(', ') : 'Not configured, so all client apps'],
    ['Grant', grantText(p)]
  ]);
  if (p.state === 'reportOnly') body += `<p class="note">${termLink('reportonly', 'Report-only')}: evaluated at every sign-in and logged, never enforced.</p>`;
  if (inFix()) body += ui.confirm === 'delpol-' + p.id ? `<div class="confirm"><p>Delete ${esc(p.name)}?</p><div class="cta">${btn('pol-delete', p.id, 'Delete', 'btn danger')}${btn('confirm-no', null, 'Cancel', 'btn ghost')}</div></div>` : `<div class="cta">${btn('pol-edit', p.id, 'Edit this policy', 'btn ghost')}${btn('confirm', 'delpol-' + p.id, 'Delete', 'btn ghost')}</div>`;
  else body += editNote();
  return { title: p.name, body };
};
function policyEditHtml(d, cfg) {
  const tmp = { users: {}, resources: {}, grant: {} };
  draftToPolicy(Object.assign({}, d, { name: d.name || '—' }), tmp);
  const ut = usersText(tmp), nt = netText(tmp, cfg);
  const tog = (field, v, on, label, round) => `<button type="button" class="opt" data-act="pd-tog" data-v="${attr(field + ':' + v)}" aria-pressed="${on}"><span class="box${round ? ' round' : ''}">${on ? (round ? '●' : '✓') : ''}</span><span>${label}</span></button>`;
  const radio = (act, cur, opts) => `<div class="optlist">${opts.map(o => `<button type="button" class="opt" data-act="${act}" data-v="${attr(o[0])}" aria-pressed="${cur === o[0]}"><span class="box round">${cur === o[0] ? '●' : ''}</span><span>${o[1]}</span></button>`).join('')}</div>`;
  const groupToggles = (field, sel) => GROUPS.map(g => tog(field, g.id, sel.indexOf(g.id) >= 0, esc(g.name))).join('');
  const roleToggles = (field, sel) => ADMIN_ROLES.concat(['sr']).map(r => tog(field, r, sel.indexOf(r) >= 0, esc(ROLES[r].name))).join('');
  const locToggles = (field, sel) => cfg.locations.map(l => tog(field, l.id, sel.indexOf(l.id) >= 0, esc(l.name) + (l.trusted ? ' · trusted' : ''))).join('');
  const userTags = (list, which) => list.map(u => `<span class="tag">${esc(U[u].name)}<button type="button" data-act="pd-userrm" data-v="${which}:${u}" aria-label="Remove ${attr(U[u].name)}">×</button></span>`).join('');
  const addUser = which => `<div class="addrow"><select id="pdUser${which}" data-bind="form.pdu${which}" aria-label="Add a user"><option value="">Add a user…</option>${USERS.filter(u => (which === 'inc' ? d.uUsers : d.exUsers).indexOf(u.id) < 0).map(u => `<option value="${u.id}">${esc(u.name)}</option>`).join('')}</select>${btn('pd-useradd', which, 'Add', 'btn ghost sm')}</div>`;
  const strength = d.ctl.find(c => /^str:/.test(c)) || '';
  const open = k => (ui.form.open || {})[k] ? ' open' : '';
  return `<label class="field"><span>Name</span><input type="text" id="pdName" data-bind="draft.name" value="${attr(d.name)}" autocomplete="off"></label>
  <details class="ed" data-sec="users"${open('users')}><summary><b>Users</b><span>Include: ${esc(ut.inc)} · Exclude: ${esc(ut.ex)}</span></summary><div class="edbody">
    <p class="flabel">Include</p>${radio('pd-uall', d.uAll ? 'all' : 'sel', [['all', 'All users'], ['sel', 'Select users and groups']])}
    ${d.uAll ? '' : `<div class="optlist">${tog('uGuests', '1', d.uGuests, 'Guest and external users')}</div><p class="flabel">Directory roles</p><div class="optlist">${roleToggles('uRoles', d.uRoles)}</div><p class="flabel">Groups</p><div class="optlist">${groupToggles('uGroups', d.uGroups)}</div><p class="flabel">Users</p><div class="tags">${userTags(d.uUsers, 'inc') || '<span class="muted small">None</span>'}</div>${addUser('inc')}`}
    <p class="flabel">Exclude</p><p class="flabel sub">Groups</p><div class="optlist">${groupToggles('exGroups', d.exGroups)}</div><p class="flabel sub">Directory roles</p><div class="optlist">${roleToggles('exRoles', d.exRoles)}</div><p class="flabel sub">Users</p><div class="tags">${userTags(d.exUsers, 'ex') || '<span class="muted small">None</span>'}</div>${addUser('ex')}
  </div></details>
  <details class="ed" data-sec="res"${open('res')}><summary><b>Target resources</b><span>${esc(tmp.resources.include === 'all' ? 'All resources' : (tmp.resources.include.map(appLabel).join(', ') || 'None'))}</span></summary><div class="edbody">
    ${radio('pd-resall', d.resAll ? 'all' : 'sel', [['all', 'All resources'], ['sel', 'Select resources']])}
    ${d.resAll ? '' : `<div class="optlist">${RES_OPTS.concat(flApp(curTn()) ? [['fieldline', 'Fieldline CRM']] : []).map(o => tog('resApps', o[0], d.resApps.indexOf(o[0]) >= 0, esc(o[1]))).join('')}</div>`}
  </div></details>
  <details class="ed" data-sec="net"${open('net')}><summary><b>Network</b><span>Include: ${esc(nt.inc)} · Exclude: ${esc(nt.ex)}</span></summary><div class="edbody">
    <p class="flabel">Include</p>${radio('pd-netinc', d.netInc, [['any', 'Any network or location'], ['trusted', 'All trusted networks and locations'], ['sel', 'Selected networks and locations']])}${d.netInc === 'sel' ? `<div class="optlist">${locToggles('netIncSel', d.netIncSel)}</div>` : ''}
    <p class="flabel">Exclude</p>${radio('pd-netex', d.netEx, [['none', 'None'], ['trusted', 'All trusted networks and locations'], ['sel', 'Selected networks and locations']])}${d.netEx === 'sel' ? `<div class="optlist">${locToggles('netExSel', d.netExSel)}</div>` : ''}
  </div></details>
  <details class="ed" data-sec="clients"${open('clients')}><summary><b>Client apps</b><span>${esc(tmp.clientApps ? tmp.clientApps.map(c => CLIENTS[c]).join(', ') : 'Not configured')}</span></summary><div class="edbody">
    ${radio('pd-clients', d.clientsOn ? 'sel' : 'any', [['any', 'Not configured (all client apps)'], ['sel', 'Select client apps']])}
    ${d.clientsOn ? `<div class="optlist">${Object.keys(CLIENTS).map(c => tog('clients', c, d.clients.indexOf(c) >= 0, esc(CLIENTS[c]))).join('')}</div>` : ''}
  </div></details>
  <details class="ed" data-sec="grant"${open('grant')}><summary><b>Grant</b><span>${esc(d.block ? 'Block access' : d.ctl.length ? d.ctl.map(c => CTRL[c]).join(d.op === 'one' && d.ctl.length > 1 ? ' or ' : ' and ') : 'Nothing chosen yet')}</span></summary><div class="edbody">
    ${radio('pd-grant', d.block ? 'block' : 'grant', [['block', 'Block access'], ['grant', 'Grant access']])}
    ${d.block ? '' : `<div class="optlist">${tog('ctl', 'mfa', d.ctl.indexOf('mfa') >= 0, 'Require multifactor authentication')}</div>
      <label class="field"><span>Require ${termLink('authstrength', 'authentication strength')}</span><select id="pdStr" data-bind="draft.strength"><option value=""${!strength ? ' selected' : ''}>Not required</option><option value="str:mfa"${strength === 'str:mfa' ? ' selected' : ''}>Multifactor authentication</option><option value="str:phish"${strength === 'str:phish' ? ' selected' : ''}>Phishing-resistant MFA</option></select></label>
      <div class="optlist">${tog('ctl', 'compliant', d.ctl.indexOf('compliant') >= 0, 'Require device to be marked as compliant')}${tog('ctl', 'hybrid', d.ctl.indexOf('hybrid') >= 0, 'Require Microsoft Entra hybrid joined device')}</div>
      ${d.ctl.length > 1 ? `<p class="flabel">For multiple controls</p>${radio('pd-op', d.op, [['all', 'Require all the selected controls'], ['one', 'Require one of the selected controls']])}` : ''}`}
  </div></details>
  <div class="field"><span class="flabel">Enable policy</span><div class="seg" role="group" aria-label="Enable policy">${[['on', 'On'], ['reportOnly', 'Report-only'], ['off', 'Off']].map(x => `<button type="button" data-act="pd-state" data-v="${x[0]}" aria-pressed="${d.state === x[0]}">${x[1]}</button>`).join('')}</div></div>
  ${errHtml()}
  <div class="cta">${btn('pol-save', null, d.isNew ? 'Create' : 'Save', 'btn primary')}${btn('draft-cancel', null, 'Cancel', 'btn ghost')}</div>`;
}

/* ----- named locations ----- */
PANELS.locations = () => {
  const cfg = curTn().cfg;
  return { title: 'Named locations', body: `<p class="note">${termLink('namedloc', 'Named locations')} match the public IP address a sign-in comes from. Some are marked ${termLink('trustedloc', 'trusted')}.</p>
    <div class="list">${cfg.locations.map(l => { const used = usedBy(l.id, cfg); return `<button type="button" class="row" ${openAttr({ type: 'location', id: l.id })}><span class="dot ${l.trusted ? 'ok' : 'off'}"></span><span class="rmain"><b>${esc(l.name)}</b><span class="mono">${esc(l.type === 'ip' ? l.ranges.join(', ') : l.countries.map(c => COUNTRY[c]).join(', '))}</span><span>${used.length ? 'Used by ' + used.join(', ') : 'Not used by any policy'}</span></span>${pill(l.trusted ? 'ok' : 'off', l.type === 'ip' ? (l.trusted ? 'Trusted' : 'Not trusted') : 'Countries')}</button>`; }).join('')}</div>
    ${inFix() ? `<div class="cta">${btn('loc-new', null, 'New IP ranges location', 'btn ghost')}</div>` : ''}` };
};
PANELS.location = o => {
  const cfg = curTn().cfg;
  if (ui.draft && ui.draft.kind === 'location' && ui.draft.id === o.id) {
    const d = ui.draft;
    const total = d.ranges.reduce((n, r) => n + rangeSize(r), 0);
    return { title: o.id === 'new' ? 'New IP ranges location' : 'Edit ' + d.name, body: `<label class="field"><span>Name</span><input type="text" id="ldName" data-bind="draft.name" value="${attr(d.name)}" autocomplete="off"></label>
      <div class="field"><span class="flabel">IP ranges · ${total} address${total === 1 ? '' : 'es'}</span><div class="tags">${d.ranges.map(r => { const c = parseCidr(r); return `<span class="tag mono" title="${attr(c ? c.first + ' to ' + c.last : '')}">${esc(r)}<button type="button" data-act="ld-rm" data-v="${attr(r)}" aria-label="Remove ${attr(r)}">×</button></span>`; }).join('') || '<span class="muted small">None yet</span>'}</div>
        <div class="addrow"><input type="text" id="ldRange" data-bind="form.range" value="${attr(ui.form.range || '')}" placeholder="203.0.113.80/28" inputmode="decimal" autocomplete="off" spellcheck="false" aria-label="Add an IP range">${btn('ld-add', null, 'Add range', 'btn ghost sm')}</div>
        <p class="note">${(() => { const c = parseCidr(ui.form.range || ''); return c ? esc(c.text) + ' covers ' + c.size + ' addresses: ' + c.first + ' to ' + c.last + '.' : 'Use CIDR notation. A /28 is 16 addresses.'; })()}</p></div>
      <label class="check"><input type="checkbox" id="ldTrusted" data-bind="draft.trusted"${d.trusted ? ' checked' : ''}> Mark as trusted location</label>
      ${errHtml()}
      <div class="cta">${btn('loc-save', null, o.id === 'new' ? 'Create' : 'Save', 'btn primary')}${btn('draft-cancel', null, 'Cancel', 'btn ghost')}</div>` };
  }
  const l = locById(o.id, cfg);
  if (!l) return { title: 'Named location', body: '<p class="muted">This location was deleted.</p>' };
  const used = usedBy(l.id, cfg);
  let body = `<p class="meta">${pill(l.trusted ? 'ok' : 'off', l.type === 'ip' ? (l.trusted ? 'Trusted' : 'Not trusted') : 'Countries')} Created ${esc(l.created)} by ${esc(l.by)}</p>`;
  if (l.type === 'ip') body += kv([['IP ranges', l.ranges.map(r => { const c = parseCidr(r); return `<span class="mono">${esc(r)}</span> <span class="muted small">(${c.first} to ${c.last})</span>`; }).join('<br>'), true], ['Addresses', String(l.ranges.reduce((n, r) => n + rangeSize(r), 0))], ['Trusted', l.trusted ? 'Yes' : 'No'], ['Used by', used.length ? used.join(', ') : 'No policies']]);
  else body += kv([['Countries', l.countries.map(c => COUNTRY[c]).join(', ')], ['Determined by', 'IP address'], ['Include unknown countries', l.unknown ? 'Yes' : 'No'], ['Used by', used.length ? used.join(', ') : 'No policies']]);
  if (inFix() && l.type === 'ip') body += ui.confirm === 'delloc-' + l.id ? `<div class="confirm"><p>Delete “${esc(l.name)}”?</p><div class="cta">${btn('loc-delete', l.id, 'Delete', 'btn danger')}${btn('confirm-no', null, 'Cancel', 'btn ghost')}</div></div>` : `<div class="cta">${btn('loc-edit', l.id, 'Edit', 'btn ghost')}${btn('confirm', 'delloc-' + l.id, 'Delete', 'btn ghost')}</div>${errHtml()}`;
  else if (l.type === 'ip') body += editNote();
  return { title: l.name, body };
};

/* ----- logs of changes ----- */
function auditAll() { return (AUDIT_SEED[ui.caseId] || []).concat(curTn().audit || []).slice().sort((a, b) => b.t - a.t); }
PANELS.audit = () => ({ title: 'Audit log', body: `<p class="note">The ${termLink('auditlogs', 'audit log')} records changes to the tenant, newest first. Your own changes appear here too.</p><div class="list">${auditAll().map(a => `<button type="button" class="row" ${openAttr({ type: 'auditEntry', id: a.id })}><span class="dot ${a.actor.indexOf('you@') === 0 ? 'stamp' : 'off'}"></span><span class="rmain"><b>${esc(a.activity)}</b><span>${esc(a.target)}</span><span class="mono">${esc(a.when || whenText(a.t))} · ${esc(a.actor)}</span></span></button>`).join('') || '<p class="empty">No entries.</p>'}</div>` });
PANELS.auditEntry = o => {
  const a = auditAll().find(x => x.id === o.id);
  if (!a) return { title: 'Audit log', body: '<p class="muted">Not found.</p>' };
  return { title: a.activity, body: kv([['Date', a.when || longWhen(a.t)], ['Service', a.service], ['Activity', a.activity], ['Initiated by', a.actor], ['Target', a.target]]) + (a.props.length ? `<h3 class="h3">Modified properties</h3><div class="tblwrap"><table class="tbl"><thead><tr><th>Property</th><th>Old value</th><th>New value</th></tr></thead><tbody>${a.props.map(p => `<tr><td>${esc(p[0])}</td><td class="mono">${esc(p[1] || '—')}</td><td class="mono">${esc(p[2] || '—')}</td></tr>`).join('')}</tbody></table></div>` : '') };
};

/* ----- people, groups, roles, devices ----- */
PANELS.user = o => {
  const tn = curTn(), u = U[o.id];
  if (!u) return { title: 'User', body: '<p>Not found.</p>' };
  const groups = GROUPS.filter(g => g.members.indexOf(u.id) >= 0);
  const roles = rolesOf(u.id, tn.now).map(r => ROLES[r].name);
  const reg = regOf(tn, u.id), tp = tapOf(tn, u.id), ts = tapState(tn, u.id, tn.now);
  const disabled = !u.enabled || (tn.disabled && tn.disabled[u.id]);
  let body = `<p class="meta">${pill(disabled ? 'off' : 'ok', disabled ? 'Sign-in blocked' : 'Enabled')} ${pill('off', u.type)} ${capable(tn, u.id) ? pill('ok', 'Can do MFA') : pill('bad', 'Can’t do MFA')}</p>` +
    kv([['User principal name', u.upn], ['Job title', u.title || '—'], ['Department', u.dept || '—'], ['Source', u.source], ['Devices', u.devices.length ? u.devices.join(', ') : '—'], ['Directory roles', roles.join(', ') || 'None']]);
  body += `<h3 class="h3">Authentication methods</h3>` + (reg.length || tp ? `<table class="tbl"><tbody>${reg.map(m => `<tr><td>${esc(METHODS[m])}</td><td>${methodOn(m, u.id, tn.cfg) ? (m === 'passkey' ? (onFloor(u.id) ? 'Security key' : u.emergency ? 'Security key in the IT safe' : 'Passkey in Microsoft Authenticator') : 'Registered') : 'Registered, but disabled for them by the methods policy'}</td></tr>`).join('')}${tp ? `<tr><td>Temporary Access Pass</td><td>${esc({ valid: 'Valid until ' + whenText(tp.end), notyet: 'Valid from ' + whenText(tp.start) + ' to ' + whenText(tp.end), expired: 'Expired ' + whenText(tp.end), used: 'Used', disabled: 'Exists, but pass sign-in is disabled for them', none: '' }[ts])}${tp.oneTime ? ' · one-time' : ' · reusable'}</td></tr>` : ''}</tbody></table>` : '<p class="muted">Nothing registered.</p>');
  if (u.note) body += `<p class="note">${esc(u.note)}</p>`;
  if (u.service) body += `<p class="note">A service account: a device signs in as it, not a person.</p>`;
  const C = CASE[ui.caseId];
  if (C && C.userActions && C.userActions.indexOf(u.id) >= 0) {
    body += `<h3 class="h3">Account actions</h3>`;
    if (inFix()) body += `<div class="cta">${tn.pwReset[u.id] ? '<span class="okline">Password reset</span>' : btn('acct-reset', u.id, 'Reset password', 'btn ghost')}${tn.disabled[u.id] ? '<span class="okline">Sign-in blocked</span>' : btn('acct-disable', u.id, 'Block sign-in', 'btn ghost')}</div><p class="note">Marcus updates the copier with any new password the same day.</p>`;
    else body += editNote();
  }
  body += `<h3 class="h3">Groups</h3><div class="chips">${groups.length ? groups.map(g => `<button type="button" class="chip" ${openAttr({ type: 'group', id: g.id })}>${esc(g.name)}</button>`).join('') : '<span class="muted">None</span>'}</div>`;
  return { title: u.name, body };
};
PANELS.group = o => {
  const g = grp(o.id), tn = curTn();
  if (!g) return { title: 'Group', body: '<p>Not found.</p>' };
  const used = tn.cfg.policies.filter(p => ['include', 'exclude'].some(k => ((p.users[k] || {}).groups || []).indexOf(g.id) >= 0)).map(p => `<button type="button" class="chip" ${openAttr({ type: 'policy', id: p.id })}>${esc(p.id)} · ${((p.users.include || {}).groups || []).indexOf(g.id) >= 0 ? 'included' : 'excluded'}</button>`);
  return { title: g.name, body: `<p>${esc(g.desc)}</p>` + kv([['Source', g.source], ['Members', String(g.members.length)]]) +
    `<h3 class="h3">Used in Conditional Access</h3><div class="chips">${used.join('') || '<span class="muted">Not used</span>'}</div>` +
    `<h3 class="h3">Members</h3><div class="list">${g.members.map(id => `<button type="button" class="row" ${openAttr({ type: 'user', id })}><span class="dot ${capable(tn, id) ? 'ok' : 'off'}"></span><span class="rmain"><b>${esc(U[id].name)}</b><span>${esc(U[id].title)}</span></span></button>`).join('')}</div>` };
};
PANELS.roles = () => {
  const tn = curTn();
  const rows = Object.keys(ROLES).map(r => ({ r, who: ROLES[r].members.filter(uid => hasRole(uid, r, tn.now)) })).filter(x => x.who.length);
  return { title: 'Directory roles', body: `<p class="note">${termLink('entraroles', 'Microsoft Entra roles')} with members at Tallis. Admin roles are the ones the insurer cares about.</p><div class="list">${rows.map(x => `<div class="row static"><span class="dot ${ADMIN_ROLES.indexOf(x.r) >= 0 ? 'warn' : 'off'}"></span><span class="rmain"><b>${esc(ROLES[x.r].name)}</b><span>${x.who.map(uid => esc(U[uid].name + (U[uid].enabled ? '' : ' (disabled)'))).join(', ')}</span></span>${ADMIN_ROLES.indexOf(x.r) >= 0 ? pill('warn', 'Admin') : ''}</div>`).join('')}</div>` };
};
PANELS.device = o => {
  const d = DEVICES[o.id];
  if (!d) return { title: 'Device', body: '<p>Not found.</p>' };
  return { title: d.id, body: kv([['Owner', d.owner || '—'], ['Operating system', d.os], ['Join type', d.join], ['Compliant', d.compliant ? 'Yes' : 'No'], ['Managed', d.managed ? 'Yes' : 'No']]) + (/KIOSK/.test(d.id) ? '<p class="note">A shared kiosk by the production lines. Anyone on the shift signs in here, one after another, and phones stay in the lockers.</p>' : '') };
};

/* ----- authentication methods ----- */
PANELS.methods = () => {
  const cfg = curTn().cfg;
  return { title: 'Authentication methods policy', body: `<p class="note">The ${termLink('authmethod', 'authentication methods policy')} decides which methods people can register and sign in with. It doesn’t make anyone use them.</p>
    <div class="list">${METHOD_KEYS.map(m => { const p = cfg.methods[m]; return `<button type="button" class="row" ${openAttr({ type: 'method', id: m })}><span class="dot ${p.state === 'on' ? 'ok' : 'off'}"></span><span class="rmain"><b>${esc(METHODS[m])}</b><span>${esc(methodTarget(p))}</span></span>${pill(p.state === 'on' ? 'ok' : 'off', p.state === 'on' ? 'Enabled' : 'Disabled')}</button>`; }).join('')}</div>` };
};
PANELS.method = o => {
  const tn = curTn(), m = o.id, p = tn.cfg.methods[m];
  if (ui.draft && ui.draft.kind === 'method' && ui.draft.m === m) {
    const d = ui.draft;
    const gt = (field, sel) => GROUPS.map(g => `<button type="button" class="opt" data-act="md-tog" data-v="${field}:${g.id}" aria-pressed="${sel.indexOf(g.id) >= 0}"><span class="box">${sel.indexOf(g.id) >= 0 ? '✓' : ''}</span><span>${esc(g.name)}</span></button>`).join('');
    const sel = (id, field, val) => `<select id="${id}" data-bind="draft.${field}">${LIFETIMES.map(l => `<option value="${l[0]}"${l[0] === val ? ' selected' : ''}>${l[1]}</option>`).join('')}</select>`;
    return { title: 'Edit ' + METHODS[m], body: `<div class="field"><span class="flabel">Enable</span><div class="seg" role="group">${[['on', 'Enabled'], ['off', 'Disabled']].map(x => `<button type="button" data-act="md-state" data-v="${x[0]}" aria-pressed="${d.state === x[0]}">${x[1]}</button>`).join('')}</div></div>
      <div class="field"><span class="flabel">Include</span><div class="optlist">${['all', 'sel'].map(k => `<button type="button" class="opt" data-act="md-incall" data-v="${k}" aria-pressed="${(k === 'all') === d.incAll}"><span class="box round">${(k === 'all') === d.incAll ? '●' : ''}</span><span>${k === 'all' ? 'All users' : 'Select groups'}</span></button>`).join('')}</div>${d.incAll ? '' : `<div class="optlist">${gt('inc', d.inc)}</div>`}</div>
      <div class="field"><span class="flabel">Exclude</span><div class="optlist">${gt('exc', d.exc)}</div></div>
      ${m === 'passkey' ? `<label class="check"><input type="checkbox" id="mdSelf" data-bind="draft.selfService"${d.selfService ? ' checked' : ''}> Allow self-service set up</label>` : ''}
      ${m === 'tap' ? `<div class="grid3"><label class="field"><span>Minimum lifetime</span>${sel('mdMin', 'minMin', d.minMin)}</label><label class="field"><span>Maximum lifetime</span>${sel('mdMax', 'maxMin', d.maxMin)}</label><label class="field"><span>Default lifetime</span>${sel('mdDef', 'defMin', d.defMin)}</label></div><label class="check"><input type="checkbox" id="mdOne" data-bind="draft.oneTime"${d.oneTime ? ' checked' : ''}> One-time use for every pass</label>` : ''}
      ${errHtml()}
      <div class="cta">${btn('md-save', null, 'Save', 'btn primary')}${btn('draft-cancel', null, 'Cancel', 'btn ghost')}</div>` };
  }
  const people = USERS.filter(u => u.enabled && methodOn(m, u.id, tn.cfg)).length;
  const extra = m === 'tap' ? [['Minimum lifetime', lifeLabel(p.minMin)], ['Maximum lifetime', lifeLabel(p.maxMin)], ['Default lifetime', lifeLabel(p.defMin)], ['One-time use', p.oneTime ? 'Yes' : 'No']] : m === 'passkey' ? [['Allow self-service set up', p.selfService !== false ? 'Yes' : 'No']] : [];
  const about = { passkey: 'People must complete MFA in the last few minutes before they can register a passkey. A Temporary Access Pass counts.', authenticator: 'Push notifications and passkeys in the app. It needs the person’s phone at hand.', sms: 'One-time codes by text message. It needs the person’s phone at hand.', tap: 'A time-limited passcode that counts as MFA, for onboarding and recovery. Only people included here can sign in with one.' }[m];
  return { title: METHODS[m], body: `<p class="meta">${pill(p.state === 'on' ? 'ok' : 'off', p.state === 'on' ? 'Enabled' : 'Disabled')}</p>` + kv([['Target', methodTarget(p)], ['People it covers', String(people)]].concat(extra)) + `<p class="note">${m === 'passkey' ? termLink('passkey', 'Passkeys') + ': ' : m === 'tap' ? termLink('tap', 'Temporary Access Pass') + ': ' : ''}${esc(about)}</p>` + (inFix() ? `<div class="cta">${btn('md-edit', m, 'Edit', 'btn ghost')}</div>` : editNote()) };
};
PANELS.tapform = o => {
  const tn = curTn(), pol = tn.cfg.methods.tap;
  const f = ui.form.tap || (ui.form.tap = { target: o.target || 'g:g-floor', start: 'shift', life: pol.defMin, oneTime: !!pol.oneTime });
  if (pol.state !== 'on') return { title: 'Create Temporary Access Passes', body: `<p>Temporary Access Pass is disabled in the authentication methods policy, so you can’t create passes yet.</p><div class="cta">${btn('open', JSON.stringify({ type: 'method', id: 'tap' }), 'Open Temporary Access Pass', 'btn ghost')}</div>` };
  const shiftT = (CASE[ui.caseId].id === 'c3' ? nextSessionT(tn) : nextWorkday(dayOf(tn.now)) * 86400 + 6 * 3600) - 900;
  const lives = LIFETIMES.filter(l => l[0] >= pol.minMin && l[0] <= pol.maxMin);
  return { title: 'Create Temporary Access Passes', body: `<label class="field"><span>For</span><select id="tapTarget" data-bind="form.tap.target">${[['g:g-floor', 'SG-Frontline-Brno (23 people)'], ['g:g-line1', 'Line 1 (8)'], ['g:g-line2', 'Line 2 (7)'], ['g:g-line3', 'Line 3 (7)']].map(x => `<option value="${x[0]}"${f.target === x[0] ? ' selected' : ''}>${x[1]}</option>`).join('')}</select></label>
    <div class="field"><span class="flabel">Valid from</span><div class="optlist">${[['now', 'Now (' + whenText(tn.now) + ')'], ['shift', 'Just before the next shift (' + whenText(shiftT) + ')']].map(x => `<button type="button" class="opt" data-act="tap-start" data-v="${x[0]}" aria-pressed="${f.start === x[0]}"><span class="box round">${f.start === x[0] ? '●' : ''}</span><span>${esc(x[1])}</span></button>`).join('')}</div></div>
    <label class="field"><span>Lifetime</span><select id="tapLife" data-bind="form.tap.life">${lives.map(l => `<option value="${l[0]}"${+f.life === l[0] ? ' selected' : ''}>${l[1]}</option>`).join('')}</select></label>
    <p class="note">The methods policy allows ${esc(lifeLabel(pol.minMin))} to ${esc(lifeLabel(pol.maxMin))}.</p>
    <label class="check"><input type="checkbox" id="tapOne" data-bind="form.tap.oneTime"${f.oneTime || pol.oneTime ? ' checked' : ''}${pol.oneTime ? ' disabled' : ''}> One-time use${pol.oneTime ? ' (required by the policy)' : ''}</label>
    ${errHtml()}
    ${inFix() ? `<div class="cta">${btn('tap-create', null, 'Create passes', 'btn primary')}</div>` : editNote()}` };
};
PANELS.session = () => {
  const tn = curTn();
  const f = ui.form.session || (ui.form.session = { gid: 'g-line2' });
  const done = tn.sessions || [];
  const left = SESSION_TIMES.length - done.length;
  return { title: 'Key registration with Tomáš', body: `<p>At shift start, each person signs in once at a kiosk and registers a security key. Tomáš hands out the keys.</p>
    ${kv([['Next session', left ? whenText(nextSessionT(tn)) : 'None left before the deadline'], ['Keys in Tomáš’s office', String(tn.keysLeft)]])}
    ${done.length ? `<h3 class="h3">Sessions so far</h3><ol class="plain">${done.map(s => `<li><b>${esc(whenText(s.t))} · ${esc(gName(s.gid))}</b><br>${esc(s.lines.join(' '))}</li>`).join('')}</ol>` : ''}
    ${inFix() && left ? `<label class="field"><span>Who comes</span><select id="sessGid" data-bind="form.session.gid">${[['g-line2', 'Line 2 (7 people)'], ['g-line1', 'Line 1 (8)'], ['g-line3', 'Line 3 (7)'], ['g-floor', 'The whole floor (23)']].map(x => `<option value="${x[0]}"${f.gid === x[0] ? ' selected' : ''}>${x[1]}</option>`).join('')}</select></label>${errHtml()}<div class="cta">${btn('session-run', null, 'Run the session', 'btn primary')}</div><p class="note">To register, each person needs a way to sign in at the kiosk first, and the methods policy has to allow security keys for them.</p>` : inFix() ? '' : editNote()}` };
};
PANELS.regreport = () => {
  const tn = curTn();
  const people = USERS.filter(u => u.enabled && !u.service && !u.emergency && u.type !== 'Guest');
  const groups = GROUPS.filter(g => g.id !== 'g-emergency');
  const rows = groups.map(g => { const m = g.members.filter(id => U[id].enabled); return `<tr><td>${esc(g.name.replace(/^SG-/, ''))}</td><td class="num">${m.length}</td><td class="num">${m.filter(id => capable(tn, id)).length}</td><td class="num">${m.filter(id => hasKey(tn, id)).length}</td><td class="num">${m.filter(id => tapState(tn, id, tn.now) === 'valid').length}</td></tr>`; }).join('');
  const none = people.filter(u => !capable(tn, u.id));
  return { title: 'Registration report', body: kv([['People who can do MFA', people.filter(u => capable(tn, u.id)).length + ' of ' + people.length], ['People with a passkey', people.filter(u => hasKey(tn, u.id)).length + ' of ' + people.length]]) +
    `<div class="tblwrap"><table class="tbl"><thead><tr><th>Group</th><th class="num">People</th><th class="num">MFA</th><th class="num">Key</th><th class="num">Pass</th></tr></thead><tbody>${rows}</tbody></table></div><p class="note">MFA: has a method they can use. Key: has a passkey. Pass: holds a valid Temporary Access Pass right now.</p>` +
    (none.length ? `<h3 class="h3">Can’t do MFA</h3><p>${esc(listText(none.map(u => u.name), 30))}</p>` : '') +
    `<h3 class="h3">Only SMS</h3><p>${esc(listText(people.filter(u => regOf(tn, u.id).join() === 'sms').map(u => u.name)) || 'Nobody')}</p>` };
};
PANELS.impact = o => {
  const tn = curTn();
  const ro = tn.cfg.policies.filter(p => p.state === 'reportOnly');
  const pid = o.pid || (ro.length ? ro[ro.length - 1].id : null);
  if (!pid) return { title: 'Report-only impact', body: '<p>No policy is in report-only mode right now. Create one from a template: templates start in report-only.</p>' };
  const r = policyImpact(tn, pid);
  const list = ids => ids.length ? esc(listText(ids.map(id => U[id].name), 6)) : 'Nobody';
  return { title: 'Report-only impact · ' + pid, body: `${ro.length > 1 ? `<div class="chips">${ro.map(p => `<button type="button" class="chip" ${openAttr({ type: 'impact', pid: p.id })} aria-pressed="${p.id === pid}">${esc(p.id)}</button>`).join('')}</div>` : ''}
    <p class="note">What ${esc(pid)} would do at each person’s next usual sign-in, if it were on. Nothing is enforced.</p>
    ${kv([['Would be asked for MFA and pass', String(r.mfa.length)], ['Would have to set up MFA first', list(r.register), true], ['Would be stuck', list(r.fail), true], ['Not in scope', String(r.none.length)]])}` };
};
PANELS.lockrisk = () => {
  const tn = curTn(), lr = lockRisk(tn, tn.now);
  return { title: 'Who’d be locked out', body: `<p class="note">Everyone’s next usual sign-in (the floor at 06:00, offices at 08:30), with the tenant exactly as it is now.</p>${lr.count ? `<div class="list">${lr.who.map(uid => `<div class="row static"><span class="dot bad"></span><span class="rmain"><b>${esc(U[uid].name)}</b><span>${esc(lr.why[uid])}</span></span></div>`).join('')}</div>` : '<p class="okline">Nobody would be locked out.</p>'}` };
};

/* ----- What If ----- */
PANELS.whatif = () => {
  const tn = curTn();
  const q = ui.form.wi || (ui.form.wi = { user: 'u-f1', app: 'teams', ip: '203.0.113.84', client: 'browser', dev: 'kiosk', platform: 'Windows' });
  const opt = (o, sel) => Object.keys(o).map(k => `<option value="${k}"${k === sel ? ' selected' : ''}>${esc(o[k])}</option>`).join('');
  const people = [['Brno floor', floorIds()], ['Brno office', BRNO_OFFICE], ['HQ and travel', HQ_PEOPLE.concat(['u-jordan', 'u-chris'])], ['Sales', SALES.filter(id => id !== 'u-jordan')], ['Admins and service accounts', ['u-you', 'u-bg1', 'u-copier']], ['Guests', ['u-dieter']]];
  const apps = Object.assign({}, APPS); if (!flApp(tn)) delete apps.fieldline;
  const res = ui.form.wiRes;
  let out = '';
  if (res) {
    const s = res.sim;
    out = `<div class="card result"><p class="flabel">Result</p><p class="big">${esc(verdictText(s))}</p>${!passed(s) ? `<p>${esc(s.code === 53003 ? (blockerOf(s) ? blockerOf(s).pid + ' blocks access.' : '') : s.reason)}</p>` : ''}
      ${kv([['Named locations', res.net.matched.length ? res.net.matched.map(id => locName(id, tn.cfg)).join(', ') : 'None matched'], ['Trusted', res.net.trusted ? 'Yes' : 'No'], ['Methods usable now', res.usable.length ? res.usable.map(m => METHODS[m]).join(', ') : 'None']])}
      <p class="flabel">Policies that apply (${res.apply.length})</p><div class="prows">${res.apply.map(x => `<div class="prow"><button type="button" class="pname" ${openAttr({ type: 'policy', id: x.p.id })}>${esc(x.p.name)}</button>${pill(stateClass(x.p.state), STATE[x.p.state])}<p class="why">${esc(grantText(x.p))}</p></div>`).join('') || '<p class="muted">None.</p>'}</div>
      <details class="more"><summary>Policies that don’t apply (${res.notApply.length})</summary><div class="prows">${res.notApply.map(x => `<div class="prow"><span class="pname">${esc(x.p.name)}</span><p class="why">${esc(x.why)}</p></div>`).join('')}</div></details></div>`;
  }
  return { title: 'What If', body: `<p class="note">${termLink('whatif', 'What If')} simulates one sign-in against the policies as they are right now.</p>
    <label class="field"><span>User</span><select id="wiUser" data-bind="form.wi.user">${people.map(g => `<optgroup label="${attr(g[0])}">${g[1].map(id => `<option value="${id}"${id === q.user ? ' selected' : ''}>${esc(U[id].name)}</option>`).join('')}</optgroup>`).join('')}</select></label>
    <label class="field"><span>Cloud app</span><select id="wiApp" data-bind="form.wi.app">${opt(apps, q.app)}</select></label>
    <label class="field"><span>IP address</span><input type="text" id="wiIp" data-bind="form.wi.ip" value="${attr(q.ip)}" inputmode="decimal" autocomplete="off" spellcheck="false"></label>
    <div class="chips">${[['203.0.113.84', 'Brno plant'], ['203.0.113.86', 'Plant failover'], ['192.0.2.12', 'HQ'], ['203.0.113.200', 'A Brno home'], ['203.0.113.70', 'Kovo'], ['198.51.100.23', 'Valtek']].map(x => `<button type="button" class="chip" data-act="wi-ip" data-v="${x[0]}">${x[1]}</button>`).join('')}</div>
    <div class="grid2"><label class="field"><span>Client app</span><select id="wiClient" data-bind="form.wi.client">${opt(CLIENTS, q.client)}</select></label>
    <label class="field"><span>Device</span><select id="wiDev" data-bind="form.wi.dev">${opt({ none: 'Not registered', compliant: 'Compliant laptop', kiosk: 'Floor kiosk (hybrid joined)', noncompliant: 'Registered, not compliant' }, q.dev)}</select></label></div>
    ${errHtml()}
    <div class="cta">${btn('wi-run', null, 'Run What If', 'btn primary')}</div>${out}` };
};

/* ----- apps ----- */
const apps = () => curTn().apps;
PANELS.entapps = () => {
  const A = apps();
  return { title: 'Enterprise applications', body: `<p class="note">${termLink('entapp', 'Enterprise applications')}: the apps people and services sign in to here, each a ${termLink('sp', 'service principal')} in Tallis.</p><div class="list">${Object.keys(A.ent).map(k => A.ent[k]).map(a => `<button type="button" class="row" ${openAttr({ type: 'entapp', id: a.id })}><span class="dot ${a.enabled ? 'ok' : 'bad'}"></span><span class="rmain"><b>${esc(a.name)}</b><span>${a.assignReq ? 'Assignment required' : 'Anyone at Tallis can sign in'} · ${plural(a.assigned.length, 'assignment')}</span></span>${pill(a.gallery ? 'ro' : 'off', a.gallery ? 'Gallery' : 'Tallis')}</button>`).join('')}</div>${inFix() ? `<div class="cta">${btn('open', JSON.stringify({ type: 'gallery' }), 'New application', 'btn ghost')}</div>` : ''}` };
};
PANELS.gallery = () => {
  const added = !!flApp(curTn());
  const q = (ui.form.gq || '').trim().toLowerCase();
  const rows = GALLERY.filter(g => !q || g[1].toLowerCase().indexOf(q) >= 0);
  return { title: 'Microsoft Entra gallery', body: `<p class="note">Gallery apps come with their single sign-on settings ready to fill in. Adding one creates its enterprise application and its app registration in Tallis.</p>
    <label class="field"><span>Search the gallery</span><input type="search" id="galQ" data-bind="form.gq" value="${attr(ui.form.gq || '')}" placeholder="App name" autocomplete="off"></label>
    <div class="list" id="galList">${rows.map(g => `<div class="row static"><span class="dot ${g[0] === 'fieldline' && added ? 'ok' : 'off'}"></span><span class="rmain"><b>${esc(g[1])}</b><span>${esc(g[2])}</span></span>${g[0] === 'fieldline' ? (added ? pill('ok', 'Added') : inFix() ? btn('fl-add', null, 'Create', 'btn primary sm') : '') : '<span class="muted small">Not requested</span>'}</div>`).join('') || '<p class="empty">No apps match.</p>'}</div>
    ${inFix() ? '' : editNote()}` };
};
PANELS.entapp = o => {
  const tn = curTn(), a = tn.apps.ent[o.id];
  if (!a) return { title: 'Enterprise application', body: '<p class="muted">This app isn’t in Tallis yet.</p>' };
  const tab = tabOf(o, 'ea-' + a.id, 'overview');
  let body = ptabs([['overview', 'Overview'], ['props', 'Properties'], ['users', 'Users and groups'], ['sso', 'Single sign-on']], tab, 'ea-' + a.id);
  if (tab === 'overview') {
    const r = tn.apps.reg[a.regId];
    body += kv([['Name', a.name], ['Application ID', r ? r.appId : '—'], ['Created', a.created || '—'], ['Source', a.gallery ? 'Gallery: ' + FL.publisher : 'Registered in Tallis'], ['Assignment required', a.assignReq ? 'Yes' : 'No'], ['Enabled for sign-in', a.enabled ? 'Yes' : 'No']]);
    if (r) body += `<div class="cta">${btn('open', JSON.stringify({ type: 'appreg', id: r.id }), 'Its app registration', 'btn ghost sm')}</div>`;
  } else if (tab === 'props') {
    const f = ui.form.props && ui.form.props.id === a.id ? ui.form.props : (ui.form.props = { id: a.id, enabled: a.enabled, assignReq: a.assignReq, visible: a.visible });
    const row = (k, label, help) => `<div class="field"><span class="flabel">${label}</span><div class="seg" role="group">${[['yes', 'Yes'], ['no', 'No']].map(x => `<button type="button" data-act="ea-prop" data-v="${k}:${x[0]}" aria-pressed="${(x[0] === 'yes') === !!f[k]}"${inFix() ? '' : ' disabled'}>${x[1]}</button>`).join('')}</div><p class="note">${help}</p></div>`;
    const changed = f.enabled !== a.enabled || f.assignReq !== a.assignReq || f.visible !== a.visible;
    body += row('enabled', 'Enabled for users to sign in?', 'No means nobody gets a token for this app, assigned or not.') + row('assignReq', termLink('assignreq', 'Assignment required?'), 'Yes means only assigned users and groups can get a token. No means everyone at Tallis can.') + row('visible', 'Visible to users?', 'Shows the app in My Apps for people assigned to it.');
    body += inFix() ? `<div class="cta">${btn('ea-props-save', a.id, 'Save', 'btn primary', changed ? '' : ' disabled')}</div>` : editNote();
  } else if (tab === 'users') {
    const rows = a.assigned.map(x => `<div class="prow"><span class="pname">${esc(principalName(tn, x.who))}</span>${pill('off', x.role || 'Default Access')}<p class="why">${esc(principalType(x.who))} · assigned ${esc(x.when || '')}${inFix() ? (ui.confirm === 'unassign-' + x.id ? ` · <button type="button" class="linkbtn danger" data-act="unassign" data-v="${attr(a.id + '|' + x.id)}">Yes, remove</button> <button type="button" class="linkbtn" data-act="confirm-no">Cancel</button>` : ` · <button type="button" class="linkbtn" data-act="confirm" data-v="unassign-${x.id}">Remove</button>`) : ''}</p></div>`).join('');
    body += `<p class="note">Each assignment carries an ${termLink('approle', 'app role')}. Assigning a group covers its members.</p><div class="prows">${rows || '<p class="muted">Nobody is assigned.</p>'}</div>`;
    if (inFix()) {
      const f = ui.form.assign || (ui.form.assign = { who: '', role: a.roles[0] || 'Default Access' });
      const g = GROUPS.map(x => `<option value="g:${x.id}"${f.who === 'g:' + x.id ? ' selected' : ''}>${esc(x.name)} (group)</option>`).join('');
      const p = USERS.filter(u => u.enabled && !u.service && !u.emergency).map(u => `<option value="u:${u.id}"${f.who === 'u:' + u.id ? ' selected' : ''}>${esc(u.id === 'u-you' ? 'You' : u.name)}</option>`).join('');
      body += `<h3 class="h3">Add an assignment</h3><label class="field"><span>User or group</span><select id="asWho" data-bind="form.assign.who"><option value="">Choose…</option><optgroup label="Groups">${g}</optgroup><optgroup label="Users">${p}</optgroup></select></label>
        <label class="field"><span>Role</span><select id="asRole" data-bind="form.assign.role">${(a.roles.length ? a.roles : ['Default Access']).map(r => `<option value="${attr(r)}"${f.role === r ? ' selected' : ''}>${esc(r)}</option>`).join('')}</select></label>
        ${a.id === FL.ent ? '<p class="note">User sees their own deals. Manager sees the whole pipeline.</p>' : ''}${errHtml()}<div class="cta">${btn('assign', a.id, 'Assign', 'btn primary')}</div>`;
    } else body += editNote();
  } else {
    if (a.id !== FL.ent) body += a.sso === 'none' ? '<p>MES-Export doesn’t sign people in. It signs in as itself, with a client secret, so single sign-on doesn’t apply.</p>' : '<p>This app signs people in with OpenID Connect, set up in its own code.</p>';
    else {
      const editing = ui.draft && ui.draft.kind === 'saml';
      if (editing) {
        const d = ui.draft;
        const opt = sel => `<option value="">(empty)</option>` + FL_URLS.map(x => `<option value="${attr(x[0])}"${x[0] === sel ? ' selected' : ''}>${esc(x[0])}</option>`).join('');
        body += `<div class="card"><p class="flabel">Basic SAML Configuration</p>
          <label class="field"><span>Identifier (Entity ID)</span><select id="smId" data-bind="draft.identifier">${opt(d.identifier)}</select></label>
          <label class="field"><span>Reply URL (Assertion Consumer Service URL)</span><select id="smReply" data-bind="draft.reply">${opt(d.reply)}</select></label>
          <label class="field"><span>Sign on URL (optional)</span><select id="smLogin" data-bind="draft.login">${opt(d.login)}</select></label>
          <p class="note">The URLs come from Fieldline’s setup email.</p>${errHtml()}
          <div class="cta">${btn('saml-save', null, 'Save', 'btn primary')}${btn('draft-cancel', null, 'Cancel', 'btn ghost')}</div></div>`;
      } else {
        body += `<div class="card"><p class="flabel">Basic SAML Configuration · ${termLink('sso', 'SAML')}</p>${kv([['Identifier (Entity ID)', a.saml.identifier || 'Required'], ['Reply URL (Assertion Consumer Service URL)', a.saml.reply || 'Required'], ['Sign on URL', a.saml.login || 'Optional']])}${inFix() ? `<div class="cta">${btn('saml-edit', null, 'Edit', 'btn ghost sm')}</div>` : ''}</div>`;
      }
      const r = tn.apps.reg[a.regId];
      body += `<div class="card"><p class="flabel">SAML certificates</p>${kv([['Token signing certificate', 'Active · expires ' + a.certExp]])}<p class="flabel">App Federation Metadata URL</p><p class="mono small urlbox">https://login.microsoftonline.com/7c1d2e4f-tallis/federationmetadata/2007-06/federationmetadata.xml?appid=${esc(r ? r.appId : '')}</p>
        ${tn.apps.fl.metaSent ? `<p class="okline">Sent to Fieldline. ${tn.apps.fl.vendorReady ? 'They’ve switched Tallis to single sign-on.' : ''}</p>` : inFix() ? `<div class="cta">${btn('meta-send', null, 'Send it to Fieldline', 'btn ghost sm')}</div>` : ''}</div>`;
      body += `<p class="note">Test single sign-on in the Verify step.</p>`;
    }
  }
  return { title: a.name, body };
};
PANELS.access = () => {
  const tn = curTn(), list = flAccess(tn).filter(x => x.can);
  const a = flApp(tn);
  return { title: 'Fieldline · who can sign in', body: `<p class="note">With the tenant as it is now. ${a && a.assignReq ? 'Assignment required is Yes, so only assigned people get in.' : 'Assignment required is No, so everyone at Tallis gets in.'}</p><p class="big">${plural(list.length, 'person', 'people')} for ${FL.seats} paid seats</p><div class="list">${list.map(x => `<div class="row static"><span class="dot ${FL_NEED[x.uid] ? 'ok' : 'warn'}"></span><span class="rmain"><b>${esc(U[x.uid].name)}</b><span>${esc(U[x.uid].title)}${FL_NEED[x.uid] ? '' : ' · not in Sales'}</span></span>${pill(x.role === 'Manager' ? 'ro' : 'off', x.role)}</div>`).join('') || '<p class="empty">Nobody can sign in.</p>'}</div>` };
};
PANELS.appregs = () => {
  const A = apps();
  return { title: 'App registrations', body: `<p class="note">${termLink('appreg', 'App registrations')}: apps defined in Tallis, with their IDs, credentials and roles.</p><div class="list">${Object.keys(A.reg).map(k => A.reg[k]).map(r => { const valid = r.secrets.filter(s => s.exp > curTn().now); return `<button type="button" class="row" ${openAttr({ type: 'appreg', id: r.id })}><span class="dot ${r.secrets.length && !valid.length ? 'bad' : 'ok'}"></span><span class="rmain"><b>${esc(r.name)}</b><span class="mono">${esc(r.appId)}</span><span>${r.secrets.length ? plural(r.secrets.length, 'client secret') : r.certs.length ? 'Certificate' : 'No credentials'}</span></span></button>`; }).join('')}</div>` };
};
const fakeSecret = s => { let o = '', h = hash32(s.id + s.desc); const a = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz0123456789~._-'; for (let i = 0; i < 40; i++) { h = Math.imul(h ^ (h >>> 13), 1103515245) >>> 0; o += a[h % a.length]; } return s.hint.slice(0, 3) + o.slice(3); };
PANELS.appreg = o => {
  const tn = curTn(), r = tn.apps.reg[o.id];
  if (!r) return { title: 'App registration', body: '<p class="muted">This app registration doesn’t exist.</p>' };
  const tab = tabOf(o, 'ar-' + r.id, 'overview');
  let body = ptabs([['overview', 'Overview'], ['secrets', 'Certificates & secrets'], ['roles', 'App roles']], tab, 'ar-' + r.id);
  if (tab === 'overview') {
    body += kv([['Display name', r.name], ['Application (client) ID', r.appId], ['Object ID', r.objId], ['Supported account types', 'My organization only'], ['Created', r.created + ' by ' + r.by], ['Owners', r.owners.map(u => U[u] ? U[u].name + (U[u].enabled ? '' : ' (disabled)') : u).join(', ')]]);
    if (r.gallery) body += '<p class="note">Created from the gallery, together with its enterprise application. Single sign-on and assignments are set there.</p>';
  } else if (tab === 'secrets') {
    const made = ui.form.madeSecret && r.secrets.find(s => s.id === ui.form.madeSecret);
    body += `<p class="note">${termLink('secret', 'Client secrets')} are passwords for the app. A secret’s value is shown only once, right after it’s added.</p>`;
    if (made) body += `<div class="card"><p class="flabel">New secret value · copy it now</p><p class="mono secretval">${esc(fakeSecret(made))}</p><p class="note">It won’t be shown again. It expires ${esc(longWhen(made.exp))}.</p>${r.id === 'ar-mes' ? (made.handed ? '<p class="okline">Noah has it and moved the export script to it.</p>' : `<div class="cta">${btn('secret-hand', made.id, 'Give it to Noah through the password manager', 'btn primary')}</div>`) : ''}</div>`;
    body += `<h3 class="h3">Client secrets (${r.secrets.length})</h3>` + (r.secrets.length ? `<div class="prows">${r.secrets.map(x => `<div class="prow"><span class="pname">${esc(x.desc)}</span>${pill(x.exp <= tn.now ? 'bad' : x.exp - tn.now < 30 * 86400 ? 'warn' : 'ok', x.exp <= tn.now ? 'Expired' : 'Expires ' + clk(x.exp).date)}<p class="why">Expires ${esc(longWhen(x.exp))} · value ${esc(x.hint)}•••• · added by ${esc(x.by)}${tn.apps.job.auth === 'secret' && tn.apps.job.secretId === x.id && r.id === 'ar-mes' ? ' · the export uses it' : ''}${inFix() ? (ui.confirm === 'delsec-' + x.id ? ` · <button type="button" class="linkbtn danger" data-act="secret-del" data-v="${attr(r.id + '|' + x.id)}">Yes, delete</button> <button type="button" class="linkbtn" data-act="confirm-no">Cancel</button>` : ` · <button type="button" class="linkbtn" data-act="confirm" data-v="delsec-${x.id}">Delete</button>`) : ''}</p></div>`).join('')}</div>` : '<p class="muted">None.</p>');
    if (inFix()) {
      const f = ui.form.secret || (ui.form.secret = { desc: '', life: 180 });
      body += `<h3 class="h3">Add a client secret</h3><label class="field"><span>Description</span><input type="text" id="secDesc" data-bind="form.secret.desc" value="${attr(f.desc)}" placeholder="What uses it" autocomplete="off"></label>
        <label class="field"><span>Expires</span><select id="secLife" data-bind="form.secret.life">${SECRET_LIVES.map(x => `<option value="${x[0]}"${+f.life === x[0] ? ' selected' : ''}>${x[0] === 180 ? 'Recommended: ' : ''}${esc(x[1])}</option>`).join('')}</select></label>
        <p class="note">A client secret can last up to 24 months. Microsoft recommends less than 12.</p>${errHtml()}<div class="cta">${btn('secret-add', r.id, 'Add', 'btn primary')}</div>`;
    } else body += editNote();
    if (r.certs.length) body += `<h3 class="h3">Certificates (${r.certs.length})</h3>` + r.certs.map(x => `<div class="prow"><span class="pname mono">${esc(x.desc)}</span>${pill('ok', 'Current')}<p class="why">Thumbprint ${esc(x.thumb)} · expires ${esc(x.expText)}</p></div>`).join('');
  } else {
    body += r.roles.length ? `<p class="note">${termLink('approle', 'App roles')} this app defines. They’re handed out on its enterprise application.</p><div class="prows">${r.roles.map(x => `<div class="prow"><span class="pname">${esc(x[0])}</span>${pill('off', 'Users')}<p class="why">${esc(x[1])}</p></div>`).join('')}</div>` : '<p class="muted">No app roles. This app doesn’t sign people in.</p>';
  }
  return { title: r.name, body };
};
PANELS.vm = o => {
  const tn = curTn(), A = tn.apps, vm = A.az['vm-mesx'];
  const tab = tabOf(o, 'vm', 'overview');
  let body = ptabs([['overview', 'Overview'], ['identity', 'Identity'], ['job', 'The export job']], tab, 'vm');
  if (tab === 'overview') body += kv([['Resource group', 'rg-mes'], ['Location', 'West Europe'], ['Operating system', 'Windows Server 2022'], ['Outbound IP', VM_IP], ['Your access', 'Owner (rg-mes)']]);
  else if (tab === 'identity') {
    body += `<p class="note">A system-assigned ${termLink('mi', 'managed identity')} is created with this VM and deleted with it. Code on the VM gets tokens as it, with no secret to store.</p>
      <div class="card"><p class="flabel">System assigned</p>${kv([['Status', vm.sysMI ? 'On' : 'Off']].concat(vm.sysMI ? [['Object (principal) ID', vm.miObj]] : []))}
      ${inFix() ? (ui.confirm === 'mi-off' ? `<div class="confirm"><p>Turn it off? The identity is deleted, and its role assignments stop working.</p><div class="cta">${btn('mi-set', 'off', 'Turn off', 'btn danger sm')}${btn('confirm-no', null, 'Cancel', 'btn ghost sm')}</div></div>` : `<div class="cta">${vm.sysMI ? btn('confirm', 'mi-off', 'Turn off', 'btn ghost sm') : btn('mi-set', 'on', 'Turn on', 'btn primary sm')}</div>`) : editNote()}</div>
      <div class="card"><p class="flabel">User assigned</p><p class="muted">None. A user-assigned identity is its own Azure resource and can be shared by several resources.</p></div>`;
  } else {
    const how = A.job.auth === 'mi' ? 'as this VM’s managed identity' : 'as MES-Export, with its client secret “' + (((A.reg['ar-mes'] || { secrets: [] }).secrets.find(x => x.id === A.job.secretId) || {}).desc || 'that no longer exists') + '”';
    body += `<p>Runs every night at 02:00 and writes the day’s production data to tallismesdata. The Brno dashboard reads it at 06:00. Noah Patel looks after the script.</p>${kv([['Signs in', how], ['Writes to', 'tallismesdata · mes-daily']])}`;
  }
  return { title: 'mes-export-vm', body };
};
PANELS.storage = () => {
  const tn = curTn(), st = tn.apps.az['st-mes'];
  let body = `<p class="note">${termLink('rbac', 'Azure role assignments')}: a role, given to someone, at a scope. Here the scope is this storage account. Owner and Contributor manage it; the Storage Blob Data roles open its data.</p>
    <div class="prows">${st.roles.map(ra => `<div class="prow"><span class="pname">${esc(ra.orphan ? 'Identity not found' : principalName(tn, ra.who))}</span>${pill(AZ_ROLES[ra.role] && AZ_ROLES[ra.role].data ? 'ro' : 'off', ra.role)}<p class="why">${esc(ra.orphan ? 'Deleted identity' : principalType(ra.who))} · since ${esc(ra.when)}${inFix() ? (ui.confirm === 'delra-' + ra.id ? ` · <button type="button" class="linkbtn danger" data-act="role-del" data-v="${ra.id}">Yes, remove</button> <button type="button" class="linkbtn" data-act="confirm-no">Cancel</button>` : ` · <button type="button" class="linkbtn" data-act="confirm" data-v="delra-${ra.id}">Remove</button>`) : ''}</p></div>`).join('')}</div>`;
  if (inFix()) {
    const f = ui.form.role || (ui.form.role = { role: '', who: '' });
    const vm = tn.apps.az['vm-mesx'];
    const whoOpts = (vm.sysMI ? '<optgroup label="Managed identities"><option value="mi:vm-mesx"' + (f.who === 'mi:vm-mesx' ? ' selected' : '') + '>mes-export-vm (system-assigned)</option></optgroup>' : '') + '<optgroup label="Apps">' + Object.keys(tn.apps.reg).map(id => `<option value="sp:${id}"${f.who === 'sp:' + id ? ' selected' : ''}>${esc(tn.apps.reg[id].name)}</option>`).join('') + '</optgroup><optgroup label="People">' + ['u-noah', 'u-you', 'u-marcus'].map(u => `<option value="u:${u}"${f.who === 'u:' + u ? ' selected' : ''}>${esc(U[u].name)}</option>`).join('') + '</optgroup>';
    body += `<h3 class="h3">Add a role assignment</h3><label class="field"><span>Role</span><select id="raRole" data-bind="form.role.role"><option value="">Choose a role…</option>${Object.keys(AZ_ROLES).map(r => `<option value="${attr(r)}"${f.role === r ? ' selected' : ''}>${esc(r)}</option>`).join('')}</select></label>${f.role && AZ_ROLES[f.role] ? `<p class="note">${esc(AZ_ROLES[f.role].note)}</p>` : ''}
      <label class="field"><span>Assign to</span><select id="raWho" data-bind="form.role.who"><option value="">Choose…</option>${whoOpts}</select></label>${vm.sysMI ? '' : '<p class="note">mes-export-vm’s managed identity appears here once it’s turned on.</p>'}${errHtml()}<div class="cta">${btn('role-add', null, 'Review and assign', 'btn primary')}</div>`;
  } else body += editNote();
  return { title: 'tallismesdata · Access control', body };
};
PANELS.spsignins = () => {
  const rows = seedsOf(ui.caseId).filter(e => e.kind).concat(curC().logs.filter(e => e.kind)).sort((a, b) => b.t - a.t);
  return { title: 'Service principal sign-ins', body: `<p class="note">Apps and ${termLink('mi', 'managed identities')} signing in as themselves, with no person involved.</p><div class="list">${rows.map(e => `<button type="button" class="row" ${openAttr({ type: 'spsignin', id: e.id })}><span class="dot ${statusClass(e.status)}"></span><span class="rmain"><b>${esc(e.name)}</b><span class="mono">${esc(e.cred)} · ${clk(e.t).wd} ${clk(e.t).hm} · ${esc(e.resource)}</span></span>${pill(statusClass(e.status), e.status)}</button>`).join('') || '<p class="empty">None.</p>'}</div>` };
};
PANELS.spsignin = o => {
  const e = findSp(ui.caseId, o.id);
  if (!e) return { title: 'Sign-in', body: '<p class="muted">Not found.</p>' };
  const c = clk(e.t);
  return { title: e.name + ' · ' + (e.kind === 'mi' ? 'managed identity' : 'service principal'), body: `<p class="meta">${pill(statusClass(e.status), e.status)} ${esc(c.dayLong)} ${esc(c.date)}, ${c.hms}</p>` + kv([['Identity', e.name], ['Resource', e.resource], ['IP address', e.ip + ' · ' + e.where], ['Credential', e.cred + (e.credHint ? ' (' + e.credHint + '••••)' : '')], ['Sign-in error code', e.code ? String(e.code) : '0'], ['Failure reason', e.reason || '—']]) + (e.code === 7000222 ? '<p class="note">The secret is a password with a date on it. Past that date, nothing else matters.</p>' : '') };
};

/* ----- concepts ----- */
const AT_TALLIS = {
  ca: 'CA07 blocks the Brno floor everywhere except the “Brno plant” location.', authn: 'On Monday the floor’s passwords were right, so authentication worked.', authz: 'CA07 refused access anyway: error 53003.',
  namedloc: '“Brno plant” had to change from 198.51.100.0/27 to 203.0.113.80/28 when the plant changed ISP.', trustedloc: 'Dana’s typo range was trusted, so Radek skipped MFA at Kovo, next door.',
  mfa: 'The floor answers MFA prompts with security keys, because phones stay in the lockers.', signinlogs: 'Every Monday 06:00 floor sign-in failed with 53003, naming CA07.', auditlogs: 'Dana added “Brno plant – new ISP” on Fri 2 Oct at 17:42, her last evening.',
  reportonly: 'Dana left CA09 in report-only since August, showing “user action required” for the floor.', whatif: 'You can run it as anyone at Tallis, from the plant, HQ or a home connection.',
  legacy: 'The HQ copier sends scans with basic SMTP authentication.', breakglass: 'bg-admin-01 and bg-admin-02, with security keys in the IT safe.',
  authmethod: 'Passkeys started out enabled only for SG-Emergency-Access.', authstrength: 'The insurer asked for phishing-resistant MFA for every admin.',
  tap: 'One-time passes let the floor sign in once at a kiosk to register their keys.', passkey: 'Security keys for the floor, passkeys in Authenticator for admins.', phishres: 'Marcus approved sign-ins with push notifications, which don’t count.',
  entraroles: 'Marcus is a Helpdesk Administrator, which CA03 didn’t cover.', appreg: 'MES-Export and Tallis Time Clock are registered in Tallis. Dana created both.',
  entapp: 'Fieldline CRM became an enterprise application, added from the gallery.', sp: 'Every night at 02:00 the export signs in as a service principal.',
  mi: 'mes-export-vm can sign in as itself, with no secret to renew.', secret: 'Dana’s MES-Export secret ran for exactly 24 months.', sso: 'Sales signs in to Fieldline with their Tallis accounts.',
  assignreq: 'With it on No, nine curious people got into Fieldline from Ben’s email.', approle: 'Fieldline has User and Manager. Sofia and Ben need Manager.', rbac: 'tallismesdata only lets in identities with a Storage Blob Data role.'
};
PANELS.concept = o => {
  const t = TERMS[o.id];
  if (!t) return { title: 'Concept', body: '<p>Not found.</p>' };
  const pairs = QUESTIONS.filter(q => q.kind === 'pair' && q.terms.indexOf(o.id) >= 0);
  return { title: t.name, body: `<p class="area">${esc(AREAS[t.area])}</p><p class="big">${esc(t.plain)}</p>
    <dl class="concept"><dt>Microsoft’s words</dt><dd>${esc(t.ms)}</dd><dt>At Tallis</dt><dd>${esc(AT_TALLIS[o.id] || '')}</dd><dt>For the exam</dt><dd>${esc(t.exam)}</dd><dt>Say it in an interview</dt><dd>${esc(t.interview)}</dd>${t.portal ? `<dt>In the portal</dt><dd>${esc(t.portal)}</dd>` : ''}</dl>
    ${pairs.length ? `<p class="flabel">Tell it apart</p><div class="chips">${pairs.map(q => `<button type="button" class="chip" data-act="quiz-one" data-v="${q.id}">${esc(q.terms.map(x => TERMS[x].name).join(' / '))}</button>`).join('')}</div>` : ''}
    <p class="small">Microsoft Learn: <a href="${attr(t.src[1])}" target="_blank" rel="noopener">${esc(t.src[0])}</a></p>` };
};

/* ----- about and reset ----- */
PANELS.menu = () => {
  const sync = cloud.status === 'synced' ? 'Saved to your account on claude.ai, so it follows you between devices.' : cloud.status === 'offline' ? 'Saved in this browser. Your account copy will update when the connection is back.' : 'Saved in this browser.';
  return { title: 'About the casebook', body: `<p>Eight tickets from Tallis Industrial, each worked in the same five steps: read, investigate, fix, verify, close. The tenant is simulated, but its Conditional Access, methods and app logic follow Microsoft Entra’s rules.</p>
    <p>Each case starts as if the ones before it were solved, so you can take them in any order and replay them as often as you like.</p>
    <p class="note">${esc(sync)}</p>
    <p class="small">The official exam outline: <a href="${STUDY_GUIDE}" target="_blank" rel="noopener">Study guide for Exam SC-300</a></p>
    <p class="small muted">Tallis Industrial is fictional, and every IP address is from the documentation ranges in RFC 5737.</p>
    <hr class="rule">
    ${ui.confirm === 'reset-all' ? `<div class="confirm"><p>Clear all your progress, stamps and review history?</p><div class="cta">${btn('reset-all', null, 'Clear everything', 'btn danger')}${btn('confirm-no', null, 'Cancel', 'btn ghost')}</div></div>` : btn('confirm', 'reset-all', 'Clear all progress', 'btn ghost')}` };
};
