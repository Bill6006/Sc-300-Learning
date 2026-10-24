/* ================= ops: changes to the tenant =================
   Each op mutates the tenant, writes an audit entry, and returns { ok, err, summary }.
   The summary is the plain-language line shown under "Your changes". */

/* ----- describing policies ----- */
function usersText(p) {
  const inc = p.users.include || {}, ex = p.users.exclude || {};
  const a = [];
  if (inc.all) a.push('All users');
  if (inc.guests) a.push('Guest and external users');
  (inc.roles || []).forEach(r => a.push(ROLES[r].name + ' (role)'));
  (inc.groups || []).forEach(g => a.push(gName(g)));
  (inc.users || []).forEach(u => a.push(U[u].name));
  const b = [];
  (ex.groups || []).forEach(g => b.push(gName(g)));
  (ex.users || []).forEach(u => b.push(U[u].name));
  (ex.roles || []).forEach(r => b.push(ROLES[r].name + ' (role)'));
  if (ex.guests) b.push('Guest and external users');
  return { inc: a.join(', ') || 'None', ex: b.join(', ') || 'None' };
}
function netText(p, cfg) {
  const N = p.network;
  if (!N) return { inc: 'Not configured, so any network or location', ex: 'None' };
  const inc = N.include === 'any' ? 'Any network or location' : N.include === 'trusted' ? 'All trusted networks and locations' : 'Selected: ' + N.include.map(id => locName(id, cfg)).join(', ');
  const ex = !N.exclude ? 'None' : N.exclude === 'trusted' ? 'All trusted networks and locations' : N.exclude.length ? 'Selected: ' + N.exclude.map(id => locName(id, cfg)).join(', ') : 'None';
  return { inc, ex };
}
function policySummary(p, cfg) {
  const ut = usersText(p);
  const res = p.resources.include === 'all' ? 'all resources' : p.resources.include.map(appLabel).join(', ');
  const nt = p.network ? (p.network.exclude ? ', except from ' + (p.network.exclude === 'trusted' ? 'trusted locations' : p.network.exclude.map(id => locName(id, cfg)).join(', ')) : '') : '';
  const cl = p.clientApps ? ', ' + p.clientApps.map(c => CLIENTS[c]).join(' and ') : '';
  return ut.inc + (ut.ex !== 'None' ? ' (except ' + ut.ex + ')' : '') + ' · ' + res + nt + cl + ' · ' + grantText(p);
}
function polDesc(p, cfg) {
  const ut = usersText(p), nt = netText(p, cfg);
  return { Name: p.name, State: STATE[p.state], 'Included users': ut.inc, 'Excluded users': ut.ex, 'Target resources': p.resources.include === 'all' ? 'All resources' : p.resources.include.map(appLabel).join(', '), 'Network include': nt.inc, 'Network exclude': nt.ex, 'Client apps': p.clientApps ? p.clientApps.map(c => CLIENTS[c]).join(', ') : 'Not configured', Grant: grantText(p) };
}
function usedBy(locId, cfg) {
  return cfg.policies.filter(p => p.network && ((Array.isArray(p.network.include) && p.network.include.indexOf(locId) >= 0) || (Array.isArray(p.network.exclude) && p.network.exclude.indexOf(locId) >= 0))).map(p => p.id);
}
function methodTarget(p) {
  if (!p || p.state !== 'on') return 'Disabled';
  const inc = p.include === 'all' ? 'All users' : (p.include || []).map(gName).join(', ') || 'Nobody';
  const ex = (p.exclude || []).length ? ', excluding ' + p.exclude.map(gName).join(', ') : '';
  return inc + ex;
}

/* ----- named locations ----- */
function checkRange(input, list) {
  const raw = String(input || '').trim();
  if (!raw) return { err: 'Type a range first, like 203.0.113.80/28.' };
  const c = parseCidr(raw);
  if (!c) return { err: 'That isn’t a valid IPv4 range. Use CIDR notation, like 203.0.113.80/28.' };
  if (c.mask <= 8) return { err: 'Only CIDR masks greater than /8 are allowed.' };
  if (isPrivate(c.net)) return { err: 'That’s a private address. Named locations need the public address the network uses on the internet, like the plant firewall’s.' };
  if (list.indexOf(c.text) >= 0) return { err: 'That range is already in this location.' };
  return { text: c.text, note: c.aligned ? '' : 'Added as ' + c.text + ', the start of that range.' };
}
function opSaveLocation(tn, id, d) {
  const name = (d.name || '').trim();
  if (!name) return { err: 'Give the location a name.' };
  if (!d.ranges.length) return { err: 'Add at least one IP range.' };
  if (id === 'new') {
    const nid = 'loc-' + (tn.seq || 0) + '-' + tn.cfg.locations.length;
    tn.cfg.locations.push({ id: nid, name, type: 'ip', ranges: d.ranges.slice(), trusted: !!d.trusted, created: whenText(tn.now), by: 'You' });
    auditPush(tn, 'Add named location', name, [['IP ranges', '', d.ranges.join(', ')], ['Trusted', '', d.trusted ? 'Yes' : 'No']]);
    return { ok: true, id: nid, summary: 'Created named location “' + name + '”: ' + d.ranges.join(', ') + (d.trusted ? ', trusted.' : '.') };
  }
  const l = locById(id, tn.cfg);
  if (!l) return { err: 'That location no longer exists.' };
  const props = [];
  if (l.name !== name) props.push(['Name', l.name, name]);
  if (l.ranges.join(', ') !== d.ranges.join(', ')) props.push(['IP ranges', l.ranges.join(', '), d.ranges.join(', ')]);
  if (!!l.trusted !== !!d.trusted) props.push(['Trusted', l.trusted ? 'Yes' : 'No', d.trusted ? 'Yes' : 'No']);
  if (!props.length) return { ok: true, none: true };
  const old = l.name;
  l.name = name; l.ranges = d.ranges.slice(); l.trusted = !!d.trusted;
  auditPush(tn, 'Update named location', l.name, props);
  return { ok: true, id, summary: 'Changed “' + old + '”: ' + props.map(x => x[0].toLowerCase() + ' → ' + x[2]).join('; ') + '.' };
}
function opDeleteLocation(tn, id) {
  const l = locById(id, tn.cfg);
  if (!l) return { err: 'That location no longer exists.' };
  if (l.type !== 'ip') return { err: 'Country locations can’t be deleted here.' };
  const used = usedBy(l.id, tn.cfg);
  if (used.length) return { err: 'It’s used by ' + used.join(', ') + '. Remove it from ' + (used.length > 1 ? 'those policies' : 'that policy') + ' first.' };
  tn.cfg.locations = tn.cfg.locations.filter(x => x.id !== l.id);
  auditPush(tn, 'Delete named location', l.name, [['IP ranges', l.ranges.join(', '), '']]);
  return { ok: true, summary: 'Deleted named location “' + l.name + '” (' + l.ranges.join(', ') + ').' };
}

/* ----- Conditional Access policies ----- */
const TEMPLATES = [
  { key: 'mfa-all', name: 'Require multifactor authentication for all users', make: () => ({ uAll: true, resAll: true, ctl: ['str:mfa'], op: 'all' }) },
  { key: 'legacy', name: 'Block legacy authentication', make: () => ({ uAll: true, resAll: true, clientsOn: true, clients: ['eas', 'other'], block: true }) },
  { key: 'admin-phish', name: 'Require phishing-resistant multifactor authentication for administrators', make: () => ({ uAll: false, uRoles: ['ga', 'caa', 'secadmin', 'helpdesk', 'authadmin', 'authpol', 'privauth'], resAll: true, ctl: ['str:phish'], op: 'all' }) },
  { key: 'dev-or-mfa', name: 'Require compliant or hybrid joined device or multifactor authentication for all users', make: () => ({ uAll: true, resAll: true, ctl: ['compliant', 'hybrid', 'mfa'], op: 'one' }) }
];
const RES_OPTS = [['office365', 'Office 365 (Teams, Exchange, SharePoint)'], ['teams', 'Microsoft Teams'], ['exo', 'Exchange Online'], ['spo', 'SharePoint Online'], ['mes', 'Tallis MES Dashboard'], ['azure', 'Microsoft Azure Management'], ['portals', 'Microsoft Admin Portals']];
function nextPolicyId(cfg) { const n = Math.max(10, ...cfg.policies.map(p => +p.id.slice(2)).filter(x => !isNaN(x))) + 1; return 'CA' + pad2(n); }
function blankDraft(cfg) {
  return { id: nextPolicyId(cfg), isNew: true, name: '', state: 'reportOnly', uAll: false, uGuests: false, uGroups: [], uRoles: [], uUsers: [], exGroups: [], exUsers: [], exRoles: [], resAll: true, resApps: [], netInc: 'any', netIncSel: [], netEx: 'none', netExSel: [], clientsOn: false, clients: [], block: false, ctl: [], op: 'all' };
}
/* Microsoft's templates start in report-only and exclude the admin who creates them. */
function newPolicyFrom(key, cfg) {
  const d = blankDraft(cfg);
  if (key !== 'blank') { const t = TEMPLATES.find(x => x.key === key); Object.assign(d, t.make()); d.name = d.id + ' · ' + t.name; d.exUsers = ['u-you']; d.state = 'reportOnly'; }
  return d;
}
function policyDraft(p) {
  const inc = p.users.include || {}, ex = p.users.exclude || {};
  const N = p.network;
  return {
    id: p.id, isNew: false, name: p.name, state: p.state,
    uAll: !!inc.all, uGuests: !!inc.guests, uGroups: (inc.groups || []).slice(), uRoles: (inc.roles || []).slice(), uUsers: (inc.users || []).slice(),
    exGroups: (ex.groups || []).slice(), exUsers: (ex.users || []).slice(), exRoles: (ex.roles || []).slice(),
    resAll: p.resources.include === 'all', resApps: p.resources.include === 'all' ? [] : p.resources.include.slice(),
    netInc: !N ? 'any' : Array.isArray(N.include) ? 'sel' : N.include, netIncSel: N && Array.isArray(N.include) ? N.include.slice() : [],
    netEx: !N || !N.exclude ? 'none' : Array.isArray(N.exclude) ? 'sel' : N.exclude, netExSel: N && Array.isArray(N.exclude) ? N.exclude.slice() : [],
    clientsOn: !!p.clientApps, clients: p.clientApps ? p.clientApps.slice() : [],
    block: !!p.grant.block, ctl: p.grant.block ? [] : p.grant.controls.slice(), op: p.grant.op || 'all'
  };
}
function draftToPolicy(d, p, now) {
  p.name = d.name.trim();
  p.state = d.state;
  const inc = {};
  if (d.uAll) inc.all = true;
  else { if (d.uGuests) inc.guests = true; if (d.uGroups.length) inc.groups = d.uGroups.slice(); if (d.uRoles.length) inc.roles = d.uRoles.slice(); if (d.uUsers.length) inc.users = d.uUsers.slice(); }
  const ex = {};
  if (d.exGroups.length) ex.groups = d.exGroups.slice();
  if (d.exUsers.length) ex.users = d.exUsers.slice();
  if (d.exRoles.length) ex.roles = d.exRoles.slice();
  p.users = { include: inc, exclude: ex };
  p.resources = { include: d.resAll ? 'all' : d.resApps.slice() };
  const nInc = d.netInc === 'sel' ? d.netIncSel.slice() : d.netInc;
  const nEx = d.netEx === 'none' ? null : d.netEx === 'sel' ? (d.netExSel.length ? d.netExSel.slice() : null) : d.netEx;
  p.network = nInc === 'any' && !nEx ? null : { include: nInc, exclude: nEx };
  p.clientApps = d.clientsOn && d.clients.length ? d.clients.slice() : null;
  p.grant = d.block ? { block: true } : { controls: d.ctl.slice(), op: d.ctl.length > 1 ? d.op : 'all' };
  p.modified = now === undefined ? p.modified : whenText(now);
}
function draftError(d) {
  if (!d.name.trim()) return 'Give the policy a name.';
  if (!d.uAll && !d.uGuests && !d.uGroups.length && !d.uRoles.length && !d.uUsers.length) return 'Choose who the policy applies to.';
  if (!d.resAll && !d.resApps.length) return 'Choose at least one target resource.';
  if (d.netInc === 'sel' && !d.netIncSel.length) return 'Choose at least one location to include, or pick another network option.';
  if (d.clientsOn && !d.clients.length) return 'Choose at least one client app, or set client apps back to not configured.';
  if (!d.block && !d.ctl.length) return 'Choose at least one grant control, or block access.';
  if (!d.block && d.ctl.indexOf('mfa') >= 0 && d.ctl.some(c => /^str:/.test(c))) return 'Require multifactor authentication and Require authentication strength can’t be used together in the same policy.';
  return '';
}
function opSavePolicy(tn, d) {
  const err = draftError(d);
  if (err) return { err };
  if (d.isNew) {
    const p = { id: d.id };
    draftToPolicy(d, p, tn.now);
    tn.cfg.policies.push(p);
    const desc = polDesc(p, tn.cfg);
    auditPush(tn, 'Add conditional access policy', p.name, Object.keys(desc).map(k => [k, '', desc[k]]));
    return { ok: true, pid: p.id, summary: 'Created ' + p.name + ' (' + STATE[p.state].toLowerCase() + '): ' + policySummary(p, tn.cfg) + '.' };
  }
  const p = policyById(d.id, tn.cfg);
  if (!p) return { err: 'That policy no longer exists.' };
  const before = polDesc(p, tn.cfg);
  const copy = clone(p);
  draftToPolicy(d, copy, tn.now);
  const after = polDesc(copy, tn.cfg);
  const props = Object.keys(after).filter(k => before[k] !== after[k]).map(k => [k, before[k], after[k]]);
  if (!props.length) return { ok: true, none: true, pid: p.id };
  Object.assign(p, copy);
  auditPush(tn, 'Update conditional access policy', p.name, props);
  return { ok: true, pid: p.id, summary: 'Changed ' + p.id + ': ' + props.map(x => x[0].toLowerCase() + ' → ' + x[2]).join('; ') + '.' };
}
function opDeletePolicy(tn, id) {
  const p = policyById(id, tn.cfg);
  if (!p) return { err: 'That policy no longer exists.' };
  tn.cfg.policies = tn.cfg.policies.filter(x => x.id !== id);
  auditPush(tn, 'Delete conditional access policy', p.name, [['State', STATE[p.state], '']]);
  return { ok: true, summary: 'Deleted ' + p.name + '.' };
}

/* ----- the authentication methods policy ----- */
function methodDraft(cfg, m) {
  const p = cfg.methods[m];
  return { m, state: p.state, incAll: p.include === 'all', inc: p.include === 'all' ? [] : (p.include || []).slice(), exc: (p.exclude || []).slice(), selfService: p.selfService !== false, minMin: p.minMin, maxMin: p.maxMin, defMin: p.defMin, oneTime: !!p.oneTime };
}
function methodDesc(cfg, m) {
  const p = cfg.methods[m];
  const o = { State: p.state === 'on' ? 'Enabled' : 'Disabled', Target: methodTarget(p) };
  if (m === 'passkey') o['Self-service set up'] = p.selfService !== false ? 'Yes' : 'No';
  if (m === 'tap') { o.Lifetime = lifeLabel(p.minMin) + ' to ' + lifeLabel(p.maxMin) + ', default ' + lifeLabel(p.defMin); o['One-time use'] = p.oneTime ? 'Yes' : 'No'; }
  return o;
}
function opSaveMethod(tn, d) {
  const m = d.m, p = tn.cfg.methods[m];
  if (m === 'tap' && !(d.minMin <= d.defMin && d.defMin <= d.maxMin)) return { err: 'The default lifetime has to be between the minimum and the maximum.' };
  if (d.state === 'on' && !d.incAll && !d.inc.length) return { err: 'Choose who can use it, or disable it.' };
  const before = methodDesc(tn.cfg, m);
  p.state = d.state; p.include = d.incAll ? 'all' : d.inc.slice(); p.exclude = d.exc.slice();
  if (m === 'passkey') p.selfService = d.selfService;
  if (m === 'tap') { p.minMin = d.minMin; p.maxMin = d.maxMin; p.defMin = d.defMin; p.oneTime = d.oneTime; }
  const after = methodDesc(tn.cfg, m);
  const props = Object.keys(after).filter(k => before[k] !== after[k]).map(k => [k, before[k], after[k]]);
  if (!props.length) return { ok: true, none: true };
  auditPush(tn, 'Authentication methods policy update', METHODS[m], props, 'Authentication Methods');
  return { ok: true, summary: 'Changed ' + METHODS[m] + ': ' + props.map(x => x[0].toLowerCase() + ' → ' + x[2]).join('; ') + '.' };
}
/* f = { target: 'g:<gid>' | 'u:<uid>', start: t, life: minutes, oneTime } */
function opCreateTaps(tn, f) {
  const pol = tn.cfg.methods.tap;
  const kind = f.target.slice(0, 1), id = f.target.slice(2);
  const uids = kind === 'g' ? grp(id).members.slice() : [id];
  if (f.life < pol.minMin || f.life > pol.maxMin) return { err: 'The methods policy allows passes from ' + lifeLabel(pol.minMin) + ' to ' + lifeLabel(pol.maxMin) + '. Change the policy first, or pick a lifetime in that range.' };
  const oneTime = !!(pol.oneTime || f.oneTime);
  const r = createTaps(tn, uids, { start: f.start, life: f.life, oneTime });
  if (!r.made.length) return { err: 'No passes were created: admins, guests, service accounts and you can’t get one here.' };
  const label = kind === 'g' ? gName(id) + ' (' + r.made.length + ' people)' : U[id].name;
  auditPush(tn, 'Admin registered security info', label, [['Method', '', 'Temporary Access Pass'], ['Activation', '', whenText(f.start)], ['Lifetime', '', lifeLabel(f.life)], ['One-time use', '', oneTime ? 'Yes' : 'No']], 'Authentication Methods');
  return { ok: true, made: r.made, summary: 'Created Temporary Access Passes for ' + label + ': valid from ' + whenText(f.start) + ' for ' + lifeLabel(f.life) + (oneTime ? ', one-time.' : ', reusable.') + (r.skipped.length ? ' Skipped ' + nameList(r.skipped) + '.' : '') };
}

/* ----- enterprise apps and app registrations ----- */
function opAddFieldline(tn) {
  const A = tn.apps;
  if (flApp(tn)) return { err: 'Fieldline CRM is already in Tallis.' };
  A.reg[FL.reg] = { id: FL.reg, name: FL.name, appId: '9a7c3e51-2f84-4b6d-a0e9-7d1c5b3f2e86', objId: 'e4b2d9a0-6c37-4f15-8a2e-91b0c7d3f560', created: whenText(tn.now), by: 'You', owners: ['u-you'], gallery: true, secrets: [], certs: [], roles: [['User', 'Sees their own deals'], ['Manager', 'Sees the whole pipeline'], ['msiam_access', 'Default role from the gallery template']], perms: [] };
  A.ent[FL.ent] = { id: FL.ent, name: FL.name, regId: FL.reg, gallery: true, enabled: true, assignReq: true, visible: true, assigned: [], roles: ['User', 'Manager'], sso: 'saml', saml: { identifier: '', reply: '', login: '' }, certExp: fullDate(dayOf(tn.now) + 1095), created: whenText(tn.now) };
  auditPush(tn, 'Add application', FL.name, [['Template', '', 'Fieldline CRM (gallery)']], 'Core Directory');
  auditPush(tn, 'Add service principal', FL.name, [['Assignment required', '', 'Yes']], 'Core Directory');
  return { ok: true, summary: 'Added Fieldline CRM from the gallery: its enterprise application and its app registration.' };
}
function opRegisterApp(tn, name) {
  const n = (name || '').trim();
  if (!n) return { err: 'Give the app a name.' };
  const A = tn.apps, id = 'ar-' + (tn.seq || 0) + '-' + Object.keys(A.reg).length;
  A.reg[id] = { id, name: n, appId: guidFrom(id + ':app'), objId: guidFrom(id + ':obj'), created: whenText(tn.now), by: 'You', owners: ['u-you'], secrets: [], certs: [], roles: [], perms: [['Microsoft Graph', 'User.Read', 'Delegated']] };
  A.ent['ea-' + id] = { id: 'ea-' + id, name: n, regId: id, enabled: true, assignReq: false, visible: true, assigned: [], roles: [], sso: 'oidc', created: whenText(tn.now) };
  auditPush(tn, 'Add application', n, [['Sign-in audience', '', 'This organization only']], 'Core Directory');
  return { ok: true, id, summary: 'Registered “' + n + '” in App registrations.' };
}
function opSaveProps(tn, id, d) {
  const a = tn.apps.ent[id];
  if (!a) return { err: 'That app isn’t in Tallis anymore.' };
  const yn = b => b ? 'Yes' : 'No';
  const props = [];
  if (a.enabled !== d.enabled) props.push(['Enabled for users to sign in', yn(a.enabled), yn(d.enabled)]);
  if (a.assignReq !== d.assignReq) props.push(['Assignment required', yn(a.assignReq), yn(d.assignReq)]);
  if (a.visible !== d.visible) props.push(['Visible to users', yn(a.visible), yn(d.visible)]);
  if (!props.length) return { ok: true, none: true };
  a.enabled = d.enabled; a.assignReq = d.assignReq; a.visible = d.visible;
  auditPush(tn, 'Update service principal', a.name, props, 'Core Directory');
  return { ok: true, summary: 'Changed ' + a.name + ': ' + props.map(p => p[0] + ' → ' + p[2]).join('; ') + '.' };
}
function opSaveSaml(tn, d) {
  const a = flApp(tn);
  if (!a) return { err: 'Add Fieldline CRM from the gallery first.' };
  const props = [];
  if (a.saml.identifier !== d.identifier) props.push(['Identifier (Entity ID)', a.saml.identifier, d.identifier]);
  if (a.saml.reply !== d.reply) props.push(['Reply URL (Assertion Consumer Service URL)', a.saml.reply, d.reply]);
  if (a.saml.login !== d.login) props.push(['Sign on URL', a.saml.login, d.login]);
  if (!props.length) return { ok: true, none: true };
  a.saml = { identifier: d.identifier, reply: d.reply, login: d.login };
  auditPush(tn, 'Update service principal', a.name, props.map(p => [p[0], p[1] || '—', p[2] || '—']), 'Core Directory');
  const short = u => (FL_URLS.find(x => x[0] === u) || [u, u || 'empty'])[1];
  return { ok: true, summary: 'Changed Fieldline’s SAML settings: ' + props.map(p => p[0].split(' (')[0] + ' → ' + (p[2] ? 'the ' + short(p[2]) : 'empty')).join('; ') + '.' };
}
function opSendMeta(tn) {
  if (!flApp(tn)) return { err: 'Add Fieldline CRM first.' };
  if (tn.apps.fl.metaSent) return { err: 'You already sent it.' };
  tn.apps.fl.metaSent = tn.now;
  tn.apps.fl.vendorReady = true;
  return { ok: true, summary: 'Sent Fieldline the App Federation Metadata URL. They switched Tallis to single sign-on the same morning.' };
}
function opAssign(tn, appId, who, role) {
  const a = tn.apps.ent[appId];
  if (!a) return { err: 'That app isn’t in Tallis anymore.' };
  if (!who) return { err: 'Choose a user or group.' };
  if (a.assigned.some(x => x.who === who && x.role === role)) return { err: 'Already assigned with that role.' };
  a.assigned.push({ id: 'as-' + (tn.seq || 0) + '-' + a.assigned.length, who, role, when: whenText(tn.now) });
  const kind = who.indexOf('g:') === 0 ? 'group' : 'user';
  auditPush(tn, kind === 'group' ? 'Add app role assignment to group' : 'Add app role assignment grant to user', a.name, [['Principal', '', principalName(tn, who)], ['App role', '', role]], 'Core Directory');
  return { ok: true, summary: 'Assigned ' + principalName(tn, who) + ' to ' + a.name + ' as ' + role + '.' };
}
function opUnassign(tn, appId, asId) {
  const a = tn.apps.ent[appId];
  const x = a && a.assigned.find(y => y.id === asId);
  if (!x) return { err: 'That assignment is already gone.' };
  a.assigned = a.assigned.filter(y => y.id !== asId);
  auditPush(tn, 'Remove app role assignment', a.name, [['Principal', principalName(tn, x.who), ''], ['App role', x.role, '']], 'Core Directory');
  return { ok: true, summary: 'Removed ' + principalName(tn, x.who) + ' (' + x.role + ') from ' + a.name + '.' };
}
function opAddSecret(tn, regId, desc, life) {
  const r = tn.apps.reg[regId];
  if (!r) return { err: 'That app registration no longer exists.' };
  const n = r.secrets.length + (tn.seq || 0);
  const s = { id: 'sec-' + (tn.seq || 0) + '-' + r.secrets.length, desc: (desc || '').trim() || 'Client secret', hint: 'ABCDEFGHJKMNPQRSTUVWXYZ'.charAt(n % 23) + (n % 9) + '~', start: tn.now, exp: tn.now + life * 86400, by: 'You', life };
  r.secrets.push(s);
  auditPush(tn, 'Update application – Certificates and secrets management', r.name, [['Client secret', '', s.desc + ' · expires ' + longWhen(s.exp)]], 'Core Directory');
  return { ok: true, secret: s, summary: 'Added a client secret to ' + r.name + ', “' + s.desc + '”, for ' + monthsOf(life) + ' months (until ' + longWhen(s.exp) + ').' };
}
function opDelSecret(tn, regId, sid) {
  const r = tn.apps.reg[regId];
  const s = r && r.secrets.find(x => x.id === sid);
  if (!s) return { err: 'That secret is already gone.' };
  r.secrets = r.secrets.filter(x => x.id !== sid);
  auditPush(tn, 'Update application – Certificates and secrets management', r.name, [['Client secret', s.desc, '(deleted)']], 'Core Directory');
  return { ok: true, summary: 'Deleted the client secret “' + s.desc + '” from ' + r.name + '.' };
}
/* Noah moves the script to a secret you hand him. In the case, he does it within the hour. */
function opHandSecret(tn, sid) {
  const r = tn.apps.reg['ar-mes'], s = r && r.secrets.find(x => x.id === sid);
  if (!s) return { err: 'That secret no longer exists.' };
  if (s.exp <= tn.now) return { err: 'That secret has already expired.' };
  s.handed = true;
  tn.apps.job = { auth: 'secret', secretId: s.id };
  return { ok: true, summary: 'Gave Noah the secret “' + s.desc + '” through the password manager. He moved the export script to it.' };
}
function opSetVmIdentity(tn, on) {
  const vm = tn.apps.az['vm-mesx'];
  if (vm.sysMI === on) return { ok: true, none: true };
  vm.sysMI = on;
  vm.miObj = on ? '6f1e9d2a-3b84-4c57-a0d6-' + guidFrom('mi' + (tn.seq || 0)).slice(-12) : null;
  /* Turning a system-assigned identity off deletes it. Its role assignments stay behind, pointing at nothing,
     and an identity turned on later is a different principal that doesn't inherit them. */
  if (!on) tn.apps.az['st-mes'].roles.forEach(r => { if (r.who === 'mi:vm-mesx') r.orphan = true; });
  auditPush(tn, on ? 'Enable system-assigned managed identity' : 'Disable system-assigned managed identity', 'mes-export-vm', [['Status', on ? 'Off' : 'On', on ? 'On' : 'Off']], 'Azure activity log');
  return { ok: true, summary: (on ? 'Turned on' : 'Turned off') + ' the system-assigned managed identity for mes-export-vm.' };
}
function opAddRole(tn, role, who) {
  const st = tn.apps.az['st-mes'];
  if (!role) return { err: 'Choose a role.' };
  if (!who) return { err: 'Choose who gets the role.' };
  if (st.roles.some(r => r.role === role && r.who === who && !r.orphan)) return { err: 'That role assignment already exists.' };
  st.roles.push({ id: 'ra-' + (tn.seq || 0) + '-' + st.roles.length, role, who, when: whenText(tn.now), by: 'You' });
  auditPush(tn, 'Create role assignment', 'tallismesdata', [['Role', '', role], ['Assigned to', '', principalName(tn, who) + ' (' + principalType(who) + ')']], 'Azure activity log');
  return { ok: true, summary: 'Gave ' + principalName(tn, who) + ' (' + principalType(who).toLowerCase() + ') the ' + role + ' role on tallismesdata.' };
}
function opDelRole(tn, raId) {
  const st = tn.apps.az['st-mes'];
  const ra = st.roles.find(r => r.id === raId);
  if (!ra) return { err: 'That role assignment is already gone.' };
  st.roles = st.roles.filter(r => r.id !== raId);
  auditPush(tn, 'Delete role assignment', 'tallismesdata', [['Role', ra.role, ''], ['Assigned to', ra.orphan ? 'Identity not found' : principalName(tn, ra.who), '']], 'Azure activity log');
  return { ok: true, summary: 'Removed ' + ra.role + ' for ' + (ra.orphan ? 'a deleted identity' : principalName(tn, ra.who)) + ' from tallismesdata.' };
}
function opSwitchToMi(tn) {
  if (!tn.apps.az['vm-mesx'].sysMI) return { err: 'mes-export-vm has no managed identity turned on, so there’s nothing to switch to. Turn it on first.' };
  if (tn.apps.job.auth === 'mi') return { ok: true, none: true };
  tn.apps.job = { auth: 'mi' };
  return { ok: true, summary: 'Noah switched the export script to mes-export-vm’s managed identity.' };
}
