/* ================= cases: the casebook =================
   Every case is one ticket, worked in the same five steps. Each case starts from its own tenant,
   as if the cases before it were solved, so they can be played in any order and replayed. */

const STAGES = [['read', 'Read'], ['investigate', 'Investigate'], ['fix', 'Fix'], ['verify', 'Verify'], ['close', 'Close']];
const CHAPTERS = [
  { title: 'The Brno plant', sub: 'Conditional Access, locations and legacy sign-ins' },
  { title: 'MFA for everyone', sub: 'Authentication methods, a safe rollout, and admins' },
  { title: 'The new apps', sub: 'Enterprise apps, app registrations and managed identities' }
];
const CH3 = 17; /* Monday 19 Oct, when the new apps arrive */

/* People outside the directory who write to you. */
const OUTSIDERS = { vendor: { name: 'Sam Ortiz', title: 'Customer success, Fieldline' } };
const personName = id => id === 'you' ? 'You' : U[id] ? U[id].name : (OUTSIDERS[id] || {}).name || id;
const personTitle = id => id === 'you' ? 'Identity engineer' : U[id] ? U[id].title : (OUTSIDERS[id] || {}).title || '';

/* ----- documents the cases point to ----- */
const DOCS = {
  'CHG-0412': { title: 'CHG-0412 · Brno plant: internet provider change', meta: 'Resolved · owner Dana Whitfield · opened Mon 21 Sep', thread: [
    ['Mon 21 Sep, 09:14', 'u-petra', 'Our provider MoravNet is ending our line. Jiho Fiber switches us over on Friday 2 October at 18:00. Our new public range is 203.0.113.80/28. MoravNet takes the old range (198.51.100.0/27) back on Monday 5 October and will reassign it to other customers.'],
    ['Tue 22 Sep, 16:40', 'u-dana', 'Thanks Petra. I’ll add the new range to Conditional Access before the switch.'],
    ['Fri 2 Oct, 17:45', 'u-dana', 'Created the named location “Brno plant – new ISP”. I’ll update the CA policies on Monday. Closing this since it’s my last day. Good luck, everyone! — D']
  ] },
  'fieldline-mail': { title: 'Fieldline’s setup email', meta: 'From Sam Ortiz, Fieldline · Fri 16 Oct, 15:12', body: [
    'Hi Tallis team, and welcome to Fieldline! To set up single sign-on with Microsoft Entra ID, add “Fieldline CRM” from the Entra gallery and use these values:',
    ['Entity ID', FL.entity], ['ACS URL', FL.acs], ['Login URL', FL.login],
    'Then send us your App Federation Metadata URL, and we’ll switch Tallis over to single sign-on.',
    'Fieldline has two roles: User sees their own deals, Manager sees the whole pipeline. We create each person’s account on their first sign-in and bill for every active user.'
  ] }
};

/* ----- audit entries that were there before you ----- */
const AUDIT_SEED = {
  c1: [
    { id: 'a-hq', t: -1330 * 86400, when: '10 Feb 2023, 14:22', service: 'Conditional Access', category: 'Policy', activity: 'Add named location', actor: 'dana.whitfield@' + DOMAIN, target: 'Tallis HQ (Milwaukee)', props: [['IP ranges', '', '192.0.2.0/27'], ['Trusted', '', 'Yes']] },
    { id: 'a-brno', t: -864 * 86400, when: '21 May 2024, 10:05', service: 'Conditional Access', category: 'Policy', activity: 'Add named location', actor: 'dana.whitfield@' + DOMAIN, target: 'Brno plant', props: [['IP ranges', '', '198.51.100.0/27'], ['Trusted', '', 'Yes']] },
    { id: 'a-ca07', t: -851 * 86400, when: '3 Jun 2024, 15:40', service: 'Conditional Access', category: 'Policy', activity: 'Add conditional access policy', actor: 'dana.whitfield@' + DOMAIN, target: 'CA07 · Frontline: block outside the plant network', props: [['Users', '', 'Include SG-Frontline-Brno'], ['Network', '', 'Any network or location, excluding Brno plant'], ['Grant', '', 'Block access'], ['State', '', 'On']] },
    { id: 'a-ca02', t: -851 * 86400 + 600, when: '3 Jun 2024, 15:50', service: 'Conditional Access', category: 'Policy', activity: 'Update conditional access policy', actor: 'dana.whitfield@' + DOMAIN, target: 'CA02 · Require MFA outside trusted networks', props: [['Excluded groups', 'SG-Emergency-Access', 'SG-Emergency-Access, SG-Frontline-Brno']] },
    { id: 'a-ca09', t: -49 * 86400, when: '14 Aug 2026, 11:18', service: 'Conditional Access', category: 'Policy', activity: 'Add conditional access policy', actor: 'dana.whitfield@' + DOMAIN, target: 'CA09 · TEST frontline MFA (Dana)', props: [['State', '', 'Report-only'], ['Grant', '', 'Require multifactor authentication']] },
    { id: 'a-ca06', t: -22 * 86400, when: '10 Sep 2026, 16:02', service: 'Conditional Access', category: 'Policy', activity: 'Update conditional access policy', actor: 'dana.whitfield@' + DOMAIN, target: 'CA06 · Block countries we don’t operate in', props: [['Excluded groups', 'SG-Emergency-Access', '(none)']] },
    { id: 'a-newloc', t: at(0, 17, 42, 11), service: 'Conditional Access', category: 'Policy', activity: 'Add named location', actor: 'dana.whitfield@' + DOMAIN, target: 'Brno plant – new ISP', props: [['IP ranges', '', '203.0.113.64/28'], ['Trusted', '', 'Yes']] },
    { id: 'a-disable', t: at(0, 18, 30, 2), service: 'Core Directory', category: 'UserManagement', activity: 'Disable account', actor: 'HR provisioning', target: 'Dana Whitfield', props: [['AccountEnabled', 'true', 'false']] }
  ],
  c2: [
    { id: 'a-ca01', t: -1330 * 86400 + 900, when: '10 Feb 2023, 14:37', service: 'Conditional Access', category: 'Policy', activity: 'Add conditional access policy', actor: 'dana.whitfield@' + DOMAIN, target: 'CA01 · Block legacy authentication', props: [['Users', '', 'All users, excluding SG-Emergency-Access'], ['Client apps', '', 'Exchange ActiveSync clients, Other clients'], ['Grant', '', 'Block access']] }
  ]
};

/* ----- the tenant at the start of each case ----- */
function tenantAt(now) { return { now, seq: 0, cfg: clone(CFG0), reg: {}, taps: {}, keys: {}, disabled: {}, pwReset: {}, apps: null, audit: [], sessions: [], keysLeft: 25, plan: null }; }
function appsFresh() {
  const exp = at(CH3 + 6, 23, 59, 0), made = CH3 + 6 - 730;
  return {
    danaExp: exp,
    reg: {
      'ar-mes': { id: 'ar-mes', name: 'MES-Export', appId: '5d2e8c41-7a3b-4f0e-9b6a-2c81f4d0a937', objId: '0b7f3e19-2c4d-4a8e-9f61-d3a5c7e2b104', created: fullDate(made), by: 'Dana Whitfield', owners: ['u-dana'],
        secrets: [{ id: 'sec-dana', desc: 'mes-export-vm job', hint: 'Qx7', start: at(made, 23, 59, 0), exp, by: 'Dana Whitfield', life: 730 }], certs: [], roles: [], perms: [['Microsoft Graph', 'User.Read', 'Delegated']] },
      'ar-clock': { id: 'ar-clock', name: 'Tallis Time Clock', appId: 'c41a9e77-5b20-4d36-8e1f-6a2b9c0d7e53', objId: '8e2d61b0-74f9-4c1a-b3e5-2f90a6c4d817', created: '3 Mar 2025', by: 'Dana Whitfield', owners: ['u-dana', 'u-noah'],
        secrets: [], certs: [{ id: 'cert-clock', desc: 'CN=timeclock.tallis.example', thumb: '7A3F…C21E', expText: '3 Mar 2027' }], roles: [['Supervisor', 'Approves shift swaps'], ['Operator', 'Clocks in and out']], perms: [['Microsoft Graph', 'User.Read', 'Delegated']] }
    },
    ent: {
      'ea-mes': { id: 'ea-mes', name: 'MES-Export', regId: 'ar-mes', enabled: true, assignReq: false, visible: false, assigned: [], roles: [], sso: 'none', created: fullDate(made) },
      'ea-clock': { id: 'ea-clock', name: 'Tallis Time Clock', regId: 'ar-clock', enabled: true, assignReq: true, visible: true, assigned: [{ id: 'as-1', who: 'g:g-floor', role: 'Operator', when: '3 Mar 2025' }, { id: 'as-2', who: 'u:u-tomas', role: 'Supervisor', when: '3 Mar 2025' }], roles: ['Supervisor', 'Operator'], sso: 'oidc', created: '3 Mar 2025' }
    },
    az: {
      'vm-mesx': { id: 'vm-mesx', name: 'mes-export-vm', rg: 'rg-mes', sysMI: false, miObj: null },
      'st-mes': { id: 'st-mes', name: 'tallismesdata', rg: 'rg-mes', roles: [
        { id: 'ra-1', role: 'Storage Blob Data Contributor', who: 'sp:ar-mes', when: fullDate(made), by: 'Dana Whitfield' },
        { id: 'ra-2', role: 'Owner', who: 'u:u-dana', when: '21 May 2024', by: 'Dana Whitfield' },
        { id: 'ra-3', role: 'Reader', who: 'u:u-noah', when: '21 May 2024', by: 'Dana Whitfield' }] }
    },
    job: { auth: 'secret', secretId: 'sec-dana' },
    fl: { metaSent: null, vendorReady: false }
  };
}
/* The solved state of earlier cases, applied in order. */
const FIX = {
  brno(tn) { locById('loc-brno', tn.cfg).ranges = ['203.0.113.80/28']; tn.cfg.locations = tn.cfg.locations.filter(l => l.id !== 'loc-brno-new'); },
  floorKeys(tn) {
    const m = tn.cfg.methods;
    m.passkey.include = ['g-emergency', 'g-floor'];
    Object.assign(m.tap, { state: 'on', include: ['g-floor'], oneTime: true });
    floorIds().forEach(uid => { tn.reg[uid] = ['passkey']; tn.keys[uid] = true; });
    tn.keysLeft = 25 - floorIds().length;
  },
  mfaAll(tn) {
    tn.cfg.policies = tn.cfg.policies.filter(p => p.id !== 'CA09');
    tn.cfg.policies.push({ id: 'CA11', name: 'CA11 · Require multifactor authentication for all users', state: 'on', users: { include: { all: true }, exclude: { groups: ['g-emergency'] } }, resources: { include: 'all' }, network: null, clientApps: null, grant: { controls: ['str:mfa'], op: 'all' }, modified: 'Mon 12 Oct' });
    tn.reg['u-lena'] = ['authenticator'];
  },
  admins(tn) {
    const m = tn.cfg.methods;
    m.passkey.include = uniq(m.passkey.include.concat(['g-it']));
    ['u-you', 'u-marcus'].forEach(uid => { tn.reg[uid] = uniq(regOf(tn, uid).concat(['passkey'])); });
    tn.cfg.policies.push({ id: 'CA12', name: 'CA12 · Require phishing-resistant MFA for administrators', state: 'on', users: { include: { roles: ADMIN_ROLES.slice() }, exclude: { groups: ['g-emergency'] } }, resources: { include: 'all' }, network: null, clientApps: null, grant: { controls: ['str:phish'], op: 'all' }, modified: 'Wed 14 Oct' });
  },
  apps(tn) { tn.apps = appsFresh(); },
  fieldline(tn) {
    opAddFieldline(tn);
    flApp(tn).saml = { identifier: FL.entity, reply: FL.acs, login: FL.login };
    tn.apps.fl = { metaSent: at(CH3, 10, 5), vendorReady: true };
  }
};
function build(now, fixes) { const tn = tenantAt(now); fixes.forEach(f => FIX[f](tn)); tn.audit = []; tn.seq = 0; return tn; }

/* ----- small helpers the cases share ----- */
const ipLocs = (tn, e) => e.matched.map(id => locById(id, tn.cfg)).filter(l => l && l.type === 'ip');
function blockReason(tn, e) {
  if (!e) return '';
  const b = blockerOf(e);
  if (e.code !== 53003 || !b) return e.reason;
  const locs = ipLocs(tn, e);
  return b.pid + ' blocked them. ' + e.ip + (locs.length ? ' is in “' + locs.map(l => l.name).join('” and “') + '”, which ' + b.pid + ' doesn’t exclude.' : ' isn’t in any location ' + b.pid + ' excludes.');
}
const verdictText = e => passed(e) ? (usedMfa(e) ? 'Signed in with MFA' + (e.usedMethod ? ' (' + METHODS[e.usedMethod] + ')' : '') : e.viaDevice ? 'Signed in, the device satisfied the policy' : 'Signed in with just a password') : e.status === 'Interrupted' ? 'Stuck at an MFA prompt' : 'Blocked (' + e.code + ')';
/* A What If-style check against the tenant as it is now. good/bad are strings or functions of the entry. */
function check(tn, id, att, expect, good, bad) {
  const a = Object.assign({ t: tn.now, browser: 'Edge 141' }, att);
  a.id = 'chk-' + id + '-' + (tn.seq || 0);
  const e = evalSignIn(tn, a);
  const ok = !!expect(e);
  const pick = f => typeof f === 'function' ? f(e) : f;
  return { ok, e, text: ok ? pick(good) : pick(bad) };
}
function visitorEvent(tn, t, title, e, who, owner) {
  const base = { t, title, e };
  if (usedMfa(e)) return Object.assign(base, { ok: true, text: who + ' was asked for MFA. That network isn’t Tallis’s, so that’s right.' });
  if (!passed(e)) return Object.assign(base, { ok: false, text: who + ' couldn’t sign in at all. ' + blockReason(tn, e) });
  const p2 = policyById('CA02', tn.cfg);
  if (!p2 || p2.state === 'off') return Object.assign(base, { ok: false, text: who + ' got in without MFA, because CA02 is off.' });
  if (p2.state === 'reportOnly') return Object.assign(base, { ok: false, text: who + ' got in without MFA, because CA02 is only in report-only mode.' });
  const trusted = ipLocs(tn, e).filter(l => l.trusted);
  if (trusted.length) return Object.assign(base, { ok: false, text: who + ' got in without MFA. ' + e.ip + ' is inside “' + trusted.map(l => l.name).join('” and “') + '”, a trusted location, but ' + owner + '.' });
  const r2 = e.ca.find(r => r.pid === 'CA02');
  return Object.assign(base, { ok: false, text: who + ' got in without MFA. ' + (r2 ? r2.why : '') });
}
function homeEvent(tn, t, e) {
  const base = { t, title: 'Lukáš opens Teams from home', e };
  if (!passed(e)) {
    const b = blockerOf(e);
    return Object.assign(base, { ok: true, text: b ? b.pid + ' blocked Lukáš on a home connection. That’s the policy doing its job.' : 'Lukáš couldn’t sign in from home: ' + e.reason });
  }
  const p7 = policyById('CA07', tn.cfg);
  let why;
  if (!p7 || p7.state === 'off') why = 'CA07 is off.';
  else if (p7.state === 'reportOnly') why = 'CA07 is in report-only mode, so it only logged what it would have done.';
  else {
    const r = e.ca.find(x => x.pid === 'CA07');
    const n = ipToInt(e.ip), locs = ipLocs(tn, e);
    if (r && /^Users/.test(r.why)) why = 'CA07 doesn’t apply to Lukáš: ' + r.why.replace(/^Users: /, '');
    else if (r && /^Network: excluded/.test(r.why) && locs.length) why = 'His home address, ' + e.ip + ', is inside ' + locs.map(l => '“' + l.name + '” (' + l.ranges.filter(x => inRange(n, x)).join(', ') + ')').join(' and ') + ', so CA07 treats that house as part of the plant.';
    else why = r ? r.why : 'CA07 didn’t apply.';
  }
  return Object.assign(base, { ok: false, text: 'Lukáš signed in to Teams from home. ' + why + ' The floor is excluded from CA02, so a password was all it took.' });
}
/* The people at HQ and the Brno office, signing in on a normal morning. */
function officeMorning(tn, d, tag) {
  const list = HQ_PEOPLE.concat(BRNO_OFFICE).concat(SALES.filter(x => x !== 'u-jordan' && x !== 'u-diego'));
  const out = { stuck: [], blocked: [], registered: [], sms: [], ok: 0, n: list.length, sample: null };
  list.forEach((uid, i) => {
    const brno = BRNO_OFFICE.indexOf(uid) >= 0;
    const r = signIn(tn, { id: tag + '-' + i, t: at(d, 8, 0, 0) + i * 37, user: uid, ip: brno ? '203.0.113.' + (84 + (i % 2)) : '192.0.2.' + (10 + (i % 15)), device: U[uid].devices[0] || null, app: i % 2 ? 'teams' : 'exo', client: 'mobileDesktop', browser: i % 2 ? 'Teams desktop' : 'Outlook desktop' });
    const e = r.final;
    if (passed(e)) { out.ok++; if (e.usedMethod === 'sms') out.sms.push(uid); }
    else if (e.code === 53003) { out.blocked.push(uid); out.sample = out.sample || e; }
    else { out.stuck.push(uid); out.sample = out.sample || e; }
    if (r.registered) out.registered.push(uid);
  });
  return out;
}

/* ================= the eight cases ================= */
const CASES = [];
const CASE = {};
function defCase(c) { CASES.push(c); CASE[c.id] = c; }

/* ---------------------------------------------------------------- 1 */
defCase({
  id: 'c1', no: 'INC-2217', kind: 'Incident', chapter: 0, mins: 15,
  title: 'The floor can’t sign in',
  brief: 'Nobody on the Brno shop floor can open Teams since 06:00. Petra says nothing changed.',
  skills: ['Sign-in logs', 'Conditional Access', 'Named and trusted locations', 'What If'],
  now: at(3, 6, 14),
  base: () => build(at(3, 6, 14), []),
  seed() {
    const tn = this.base(), F = floorIds(), A = [];
    const add = (id, att) => A.push(evalSignIn(tn, Object.assign({ id }, att)));
    add('c1-maya-fri', { t: at(0, 3, 12, 44), user: 'u-maya', app: 'exo', ip: '198.51.100.231', client: 'browser', badPassword: true, os: 'Linux', browser: 'Unknown' });
    F.forEach((uid, i) => add('c1-fri-' + i, { t: at(0, 6, 0, 5) + i * 47, user: uid, app: i % 3 === 0 ? 'mes' : 'teams', ip: i % 2 ? '198.51.100.11' : '198.51.100.10', client: 'browser', device: kiosk(i), browser: 'Edge 141', atKiosk: true }));
    add('c1-petra-fri', { t: at(0, 7, 55, 10), user: 'u-petra', app: 'teams', ip: '198.51.100.10', client: 'mobileDesktop', device: 'BRN-LT-014', browser: 'Teams desktop' });
    add('c1-radek-fri', { t: at(0, 8, 10, 2), user: 'u-radek', app: 'mes', ip: '198.51.100.11', client: 'browser', device: 'BRN-LT-021', browser: 'Edge 141' });
    add('c1-jordan-fri', { t: at(0, 9, 40, 31), user: 'u-jordan', app: 'exo', ip: '198.51.100.70', client: 'mobileDesktop', device: 'HQ-LT-221', browser: 'Outlook desktop' });
    add('c1-copier-fri', { t: at(0, 11, 5, 0), user: 'u-copier', app: 'exo', ip: '192.0.2.9', client: 'other', os: 'Embedded', browser: 'Authenticated SMTP' });
    add('c1-maya-fri2', { t: at(0, 14, 20, 12), user: 'u-maya', app: 'exo', ip: '192.0.2.12', client: 'mobileDesktop', device: 'HQ-LT-118', browser: 'Outlook desktop' });
    add('c1-dana-fri', { t: at(0, 17, 40, 3), user: 'u-dana', app: 'azure', ip: '192.0.2.14', client: 'browser', device: 'HQ-LT-090', browser: 'Edge 141', enabled: true });
    add('c1-chris-fri', { t: at(0, 21, 15, 40), user: 'u-chris', app: 'teams', ip: '192.0.2.150', client: 'mobileDesktop', os: 'iOS 26', browser: 'Teams mobile' });
    F.forEach((uid, i) => add('c1-mon-' + i, { t: at(3, 6, 0, 5) + i * 21, user: uid, app: i % 3 === 0 ? 'mes' : 'teams', ip: i % 2 ? '203.0.113.85' : '203.0.113.84', client: 'browser', device: kiosk(i), browser: 'Edge 141', atKiosk: true }));
    add('c1-petra-mon', { t: at(3, 6, 5, 12), user: 'u-petra', app: 'teams', ip: '203.0.113.84', client: 'mobileDesktop', device: 'BRN-LT-014', browser: 'Teams desktop' });
    add('c1-radek-mon', { t: at(3, 6, 7, 40), user: 'u-radek', app: 'mes', ip: '203.0.113.85', client: 'browser', device: 'BRN-LT-021', browser: 'Edge 141' });
    return A;
  },
  read: {
    status: 'Open · priority 2',
    msgs: [{ from: 'u-petra', t: at(3, 6, 12), text: 'Nobody on the floor can get into Teams or the MES dashboard since the 6:00 shift started. They all get a “can’t access this right now” screen. We didn’t change anything!' }],
    asks: [
      { id: 'screen', q: 'Can you send me a screenshot of the error?', from: 'u-petra', a: 'Here’s what everyone sees:', shot: 'e53003' },
      { id: 'who', q: 'Who exactly is affected?', from: 'u-petra', a: 'Everyone on the shop floor, about 23 people on the kiosks by the lines. The office staff here are fine.' },
      { id: 'change', q: 'Did anything change at the plant recently?', from: 'u-petra', a: 'Not on our side. Well, the internet company switched us to the new fiber line on Friday evening. Dana said IT had it covered. There was a ticket about it.' },
      { id: 'self', q: 'Could you sign in yourself this morning?', from: 'u-petra', a: 'Yes, but my phone asked me to approve the sign-in, which never happens at the plant. I assumed it was some new security thing.' }
    ],
    next: 'Find out what’s stopping the floor.'
  },
  investigate: {
    goal: 'Find what’s blocking the floor, and why it started this morning.',
    evidence: [
      { label: 'Jan Novotný’s sign-in, Monday 06:00', sub: 'Failure · a plant kiosk', open: { type: 'signin', id: 'c1-mon-1' } },
      { label: 'Petra’s sign-in, Monday 06:05', sub: 'Success · her laptop at the plant', open: { type: 'signin', id: 'c1-petra-mon' } },
      { label: 'Jan Novotný’s sign-in, last Friday 06:00', sub: 'Success · before the ISP switch', open: { type: 'signin', id: 'c1-fri-1' } },
      { label: 'Sign-in log', sub: 'Everyone, Friday and Monday', open: { type: 'signins' } },
      { label: 'Conditional Access policies', sub: '9 policies', open: { type: 'policies' } },
      { label: 'Named locations', sub: 'The networks policies can point to', open: { type: 'locations' } },
      { label: 'CHG-0412 · Brno plant: internet provider change', sub: 'Dana’s ticket, closed Friday', open: { type: 'doc', id: 'CHG-0412' } },
      { label: 'Audit log', sub: 'Changes to the tenant', open: { type: 'audit' } }
    ],
    notes: [
      { id: 'policy', q: 'Which policy blocked the floor?', a: 'CA07', opts: [
        ['CA02', 'CA02 · Require MFA outside trusted networks', 'CA02 asks for MFA. It never blocks, and the floor is excluded from it.'],
        ['CA06', 'CA06 · Block countries we don’t operate in', 'CA06 blocks other countries. The plant is still in Czechia.'],
        ['CA07', 'CA07 · Frontline: block outside the plant network', 'Right. CA07 blocks the floor everywhere except the “Brno plant” location.'],
        ['CA09', 'CA09 · TEST frontline MFA (Dana)', 'CA09 is in report-only mode, so it never blocks anyone.']] },
      { id: 'ip', q: 'Where do the floor’s Monday sign-ins come from?', a: 'new', opts: [
        ['old', '198.51.100.10 and .11, the plant’s old ISP', 'That was Friday. Open a Monday sign-in’s Location tab.'],
        ['new', '203.0.113.84 and .85, the plant’s new ISP', 'Right. Since Friday evening the plant reaches the internet through Jiho Fiber.'],
        ['hq', '192.0.2.x, the HQ office line', 'That’s Milwaukee. The floor is in Brno.']] },
      { id: 'why', q: 'Why doesn’t CA07 let them in from there?', a: 'loc', opts: [
        ['loc', 'Their new addresses aren’t in the “Brno plant” named location', 'Right. CA07 excludes only “Brno plant”, and it still lists the old range.'],
        ['disabled', 'Their accounts are disabled', 'Their passwords worked. A 53003 comes after authentication succeeds.'],
        ['changed', 'Someone changed CA07 over the weekend', 'The audit log shows CA07 hasn’t changed since June 2024.'],
        ['device', 'The kiosks aren’t compliant', 'CA07 doesn’t look at devices. It looks at the network.']] },
      { id: 'range', q: 'What range did the ISP actually assign the plant?', a: '80', opts: [
        ['64', '203.0.113.64/28, the range in Dana’s new location', 'That’s what Dana typed on Friday. Compare it with CHG-0412.'],
        ['80', '203.0.113.80/28', 'Right. Sixteen addresses, .80 to .95, from CHG-0412.'],
        ['32', '203.0.113.84/32 and 203.0.113.85/32', 'Those are the two addresses you saw. The ISP assigned a whole range, and a failover can use any address in it.'],
        ['24', '203.0.113.0/24', 'That’s 256 addresses, most of them other customers’.']] }
    ]
  },
  fix: {
    goal: 'Make the plant’s real range count as the plant for CA07, and stop trusting addresses Tallis doesn’t own.',
    tools: [
      { label: 'Named locations', sub: 'Edit ranges and the trusted mark', open: { type: 'locations' } },
      { label: 'CA07 · Frontline: block outside the plant network', sub: 'The policy that blocks the floor', open: { type: 'policy', id: 'CA07' } },
      { label: 'Conditional Access policies', sub: 'All of them', open: { type: 'policies' } },
      { label: 'CHG-0412', sub: 'The range the ISP assigned', open: { type: 'doc', id: 'CHG-0412' } }
    ],
    status(tn) { const f = brnoFacets(tn); return [{ ok: f.plant === 'ok', text: f.plant === 'ok' ? 'The floor can sign in at the plant now.' : f.plant === 'partial' ? 'Half the floor can sign in at the plant.' : 'The floor is still blocked at the plant.' }]; }
  },
  verify: {
    goal: 'Test from the plant and from places that aren’t the plant, then ask the floor to try again.',
    tests: [
      { id: 'plant', label: 'Jan at a plant kiosk', sub: '203.0.113.84 · should get in', run: tn => check(tn, 'plant', { user: 'u-f1', app: 'teams', ip: '203.0.113.84', client: 'browser', device: 'BRN-KIOSK-01', atKiosk: true }, passed, 'Signed in. The plant counts as the plant again.', e => 'Still blocked. ' + blockReason(tn, e)) },
      { id: 'failover', label: 'Jan after a firewall failover', sub: '203.0.113.86 · should get in', run: tn => check(tn, 'failover', { user: 'u-f1', app: 'mes', ip: '203.0.113.86', client: 'browser', device: 'BRN-KIOSK-02', atKiosk: true }, passed, 'Signed in. Any address in the plant’s range works.', e => 'Blocked. The ISP can move the plant to any address in 203.0.113.80/28. ' + blockReason(tn, e)) },
      { id: 'home', label: 'Lukáš at home', sub: '203.0.113.200 · should be blocked', run: tn => check(tn, 'home', PROBE.home, e => !passed(e), e => (blockerOf(e) ? blockerOf(e).pid : 'A policy') + ' blocked it. A home connection isn’t the plant.', () => 'Got in from home. ' + homeEvent(tn, tn.now, evalSignIn(tn, PROBE.home)).text.replace(/^Lukáš signed in to Teams from home\. /, '')) },
      { id: 'kovo', label: 'Radek at Kovo, the supplier next door', sub: '203.0.113.70 · should be asked for MFA', run: tn => check(tn, 'kovo', PROBE.radek, usedMfa, 'Asked for MFA. Kovo’s network isn’t Tallis’s.', e => passed(e) ? 'Got in without MFA. ' + e.ip + ' is inside a trusted location, but it belongs to Kovo.' : verdictText(e) + '. ' + e.reason) },
      { id: 'valtek', label: 'Jordan at Valtek, a customer in Brno', sub: '198.51.100.23 · should be asked for MFA', run: tn => check(tn, 'valtek', PROBE.jordan, usedMfa, 'Asked for MFA. MoravNet gave that range to other customers.', e => passed(e) ? 'Got in without MFA. ' + e.ip + ' is still trusted, and MoravNet gave it to other customers.' : verdictText(e) + '. ' + e.reason) },
      { id: 'retry', label: 'Ask the floor to try again', sub: 'All 23, at the kiosks', retry: true, run: tn => {
        const res = floorBatch(tn, tn.now + 60, floorIds(), { idp: 'retry-' + (tn.seq || 0) + '-', tag: 'retry' });
        return { ok: res.ok === res.n, e: res.sample || res.okSample, text: res.ok === res.n ? 'Petra: “That did it! Everyone on the floor is in. Thank you!”' : res.ok ? 'Petra: “' + res.ok + ' of ' + res.n + ' got in. The rest are still blocked.”' : 'Petra: “Still the same. Everyone gets the can’t-access screen.”' };
      } }
    ]
  },
  close: {
    button: 'Close INC-2217',
    replayTitle: 'Tuesday at Tallis',
    replay(tn0) {
      const tn = clone(tn0); tn.now = at(4, 6, 0);
      const F = floorIds(), out = [];
      const shift = F.map((uid, i) => evalSignIn(tn, { id: 'c1r-shift-' + i, t: at(4, 6, 0, 5) + i * 23, user: uid, app: i % 3 === 0 ? 'mes' : 'teams', ip: i % 2 ? '203.0.113.85' : '203.0.113.84', client: 'browser', device: kiosk(i), browser: 'Edge 141', atKiosk: true }));
      const ok = shift.filter(passed).length, bad = shift.find(e => !passed(e));
      out.push({ t: at(4, 6, 0), ok: ok === shift.length, title: 'The day shift starts', text: ok === shift.length ? 'All 23 people on the floor signed in normally.' : (ok ? (shift.length - ok) + ' of 23 were blocked again. ' : 'The whole floor was blocked again. ') + blockReason(tn, bad), e: bad || shift[0] });
      out.push(visitorEvent(tn, at(4, 10, 30), 'Jordan visits Valtek, a customer in Brno', evalSignIn(tn, Object.assign({ id: 'c1r-jordan', t: at(4, 10, 30, 14) }, PROBE.jordan)), 'Jordan', 'MoravNet took that range back on Monday and now gives it to other customers, Valtek included'));
      out.push(visitorEvent(tn, at(4, 11, 40), 'Radek works from Kovo Systems, next door', evalSignIn(tn, Object.assign({ id: 'c1r-radek', t: at(4, 11, 40, 51) }, PROBE.radek)), 'Radek', 'that address belongs to Kovo, another Jiho Fiber customer'));
      const fo = F.slice(0, 12).map((uid, i) => evalSignIn(tn, { id: 'c1r-fo-' + i, t: at(4, 13, 5, 10) + i * 31, user: uid, app: 'mes', ip: '203.0.113.86', client: 'browser', device: kiosk(i), browser: 'Edge 141', atKiosk: true }));
      const foOk = fo.filter(passed).length, foBad = fo.find(e => !passed(e));
      out.push({ t: at(4, 13, 5), ok: foOk === fo.length, title: 'The plant’s firewall fails over', text: foOk === fo.length ? 'During ISP maintenance the plant’s traffic moved to 203.0.113.86. Nobody noticed, because the plant’s whole range works.' : 'During ISP maintenance the plant’s traffic moved to 203.0.113.86, and the floor was blocked for 40 minutes. That address is in the plant’s range, but not in what you let in. ' + blockReason(tn, foBad), e: foBad || fo[0] });
      out.push(homeEvent(tn, at(4, 23, 10), evalSignIn(tn, Object.assign({ id: 'c1r-home', t: at(4, 23, 10, 33) }, PROBE.home))));
      return out;
    },
    solved: tn => brnoOk(brnoFacets(tn)),
    tidy(tn) {
      const out = [], cfg = tn.cfg;
      const typo = locById('loc-brno-new', cfg);
      if (typo && !typo.trusted && !usedBy(typo.id, cfg).length) out.push('Dana’s typo location still exists. It’s harmless while it’s untrusted and unused, but nobody should be able to trust it again by accident.');
      const p7 = policyById('CA07', cfg);
      if (p7 && p7.network && p7.network.exclude === 'trusted') out.push('CA07 excludes every trusted location, so trusting any other network later, like a supplier’s, would let the floor in from there too.');
      cfg.locations.filter(l => l.type === 'ip' && l.ranges.some(r => { const c = parseCidr(r); return c && c.mask < 28 && inRange(c.net, '203.0.113.0/24'); })).forEach(l => out.push('“' + l.name + '” covers more than the plant’s 203.0.113.80/28.'));
      if (p7 && ((p7.users.exclude || {}).users || []).some(onFloor)) out.push('CA07 excludes some people on the floor one by one.');
      return out;
    },
    good: 'The floor works, CA07 still blocks them everywhere else, and Tallis only trusts addresses it owns.',
    learned: ['signinlogs', 'authn', 'authz', 'ca', 'namedloc', 'trustedloc', 'auditlogs', 'whatif'],
    exam: ['q-isp-change', 'q-53003', 'q-cidr', 'q-kovo'],
    extra: 'One more thing hides in these policies: CA06 is the only one that doesn’t exclude the emergency access accounts. The audit log shows Dana removed that exclusion on 10 September. If an admin ever needed a break-glass account while abroad, CA06 would lock them out too.',
    expert: 'The plant didn’t change; its public address did, and Conditional Access only sees that address. When a site changes ISP, its named location has to change with it: the new range in, exactly as the ISP assigned it, and the old range out once it’s handed back. A range left behind or typed wrong stays trusted for whoever uses it next, so check it against the paperwork, test with What If, and have real users retry before you close.'
  },
  hints: {
    investigate: ['Petra can sign in, but her floor can’t. Open a failed sign-in from the floor and read its Conditional Access tab.', 'Compare the Location tab of Monday’s failed sign-in with Friday’s. What changed?', 'CHG-0412 has the range the ISP gave the plant. Compare it with what Dana typed on Friday, in Named locations.'],
    fix: ['CA07 lets the floor in only from the “Brno plant” location. What’s in it right now?', 'Put the plant’s real range, 203.0.113.80/28, into “Brno plant”, and remove the old range MoravNet took back.', 'Dana’s “Brno plant – new ISP” is trusted and covers Kovo’s addresses. Untrust it, then delete it.'],
    verify: ['Run the checks from the plant, the failover address and a home connection.', 'Then ask the floor to try again.']
  }
});

/* ---------------------------------------------------------------- 2 */
const C2_PLANS = [
  { id: 'exclude-user', label: 'Exclude the scan-copier account from CA01 until the new firmware arrives.', apply: p => { p.users.exclude.users = ['u-copier']; } },
  { id: 'exclude-hq', label: 'Exclude HQ’s network from CA01.', apply: p => { p.network = { include: 'any', exclude: ['loc-hq'] }; } },
  { id: 'reportonly', label: 'Switch CA01 to report-only for a few weeks.', apply: p => { p.state = 'reportOnly'; } },
  { id: 'relay', label: 'Keep CA01 as it is. Ask Marcus to send the copier’s mail through an Exchange Online connector (an SMTP relay), so the copier doesn’t sign in at all.', apply: () => {} }
];
function c2Pick(tn, id) {
  const P = C2_PLANS.find(x => x.id === id);
  if (!P) return { err: 'Pick a plan.' };
  const p = clone(policyById('CA01', CFG0));
  P.apply(p);
  const i = tn.cfg.policies.findIndex(x => x.id === 'CA01');
  const before = i >= 0 ? JSON.stringify(tn.cfg.policies[i]) : '';
  if (i >= 0) tn.cfg.policies[i] = p; else tn.cfg.policies.unshift(p);
  tn.plan = id;
  if (before !== JSON.stringify(p)) auditPush(tn, 'Update conditional access policy', p.name, [['Plan', '', P.label]]);
  return { ok: true, summary: 'Plan: ' + P.label + (id === 'relay' ? '' : ' CA01 changed to match.') };
}
const copierAtt = (id, t) => ({ id, t, user: 'u-copier', app: 'exo', ip: '192.0.2.9', client: 'other', os: 'Embedded', browser: 'Authenticated SMTP' });
const wifiAtt = (id, t) => ({ id, t, user: 'u-copier', app: 'exo', ip: '192.0.2.25', client: 'other', os: 'Windows 11', browser: 'IMAP client', oldPassword: true });
function copierScan(tn, id, t) {
  if (tn.plan === 'relay') return { ok: true, relay: true, text: 'The scans arrived through the Exchange Online connector. The copier didn’t sign in at all, so CA01 had nothing to block.' };
  const e = evalSignIn(tn, copierAtt(id, t));
  return passed(e) ? { ok: true, e, text: 'The scans arrived. The copier signed in to Exchange with just a password over SMTP.' } : { ok: false, e, text: 'Still “SMTP authentication failed”. ' + (blockerOf(e) ? blockerOf(e).pid + ' blocked the copier’s sign-in.' : e.reason) };
}
defCase({
  id: 'c2', no: 'INC-2209', kind: 'Incident', chapter: 0, mins: 8,
  title: 'The copier and legacy sign-ins',
  brief: 'The HQ copier can’t scan to email. Marcus wants to exclude it from the legacy authentication block.',
  skills: ['Legacy authentication', 'Client apps condition', 'Exclusions', 'Sign-in logs'],
  now: at(4, 9, 10),
  base: () => build(at(4, 9, 10), ['brno']),
  seed() {
    const tn = this.base(), A = [];
    const add = (id, att) => A.push(evalSignIn(tn, Object.assign({}, att, { id })));
    add('c2-copier-thu', copierAtt('', at(-1, 10, 2, 9)));
    add('c2-copier-mon', copierAtt('', at(3, 8, 45, 30)));
    add('c2-spray-1', { t: at(3, 23, 41, 7), user: 'u-copier', app: 'exo', ip: '192.0.2.140', client: 'other', os: 'Unknown', browser: 'SMTP client', badPassword: true });
    add('c2-spray-2', { t: at(3, 23, 41, 52), user: 'u-copier', app: 'exo', ip: '192.0.2.140', client: 'other', os: 'Unknown', browser: 'SMTP client', badPassword: true });
    add('c2-spray-3', { t: at(3, 23, 42, 30), user: 'u-copier', app: 'exo', ip: '192.0.2.140', client: 'other', os: 'Unknown', browser: 'SMTP client' });
    add('c2-copier-tue', copierAtt('', at(4, 8, 58, 14)));
    add('c2-lena-tue', { t: at(4, 8, 30, 2), user: 'u-lena', app: 'exo', ip: '192.0.2.15', client: 'mobileDesktop', device: 'HQ-LT-150', browser: 'Outlook desktop' });
    return A;
  },
  read: {
    status: 'Open · priority 3',
    msgs: [
      { from: 'u-lena', t: at(-1, 10, 2), text: 'The copier on floor 2 says “SMTP authentication failed” when I scan to email.' },
      { from: 'u-marcus', t: at(-1, 11, 30), text: 'It uses basic SMTP authentication, which CA01 blocks on purpose. Waiting on the vendor for firmware with modern authentication.' },
      { from: 'u-lena', t: at(4, 9, 2), text: 'Still can’t scan to email. Finance needs the signed invoices scanned today.' },
      { from: 'u-marcus', t: at(4, 9, 10), text: 'The vendor says the firmware is six weeks out. Could we exclude the copier’s account from CA01 until then? Or HQ’s network? You own Conditional Access now, so it’s your call.' }
    ],
    asks: [
      { id: 'how', q: 'How does the copier send email today?', from: 'u-marcus', a: 'It signs in to Exchange Online as scan-copier@tallis.example over SMTP, with a password typed into the copier’s settings. Same password for years. It’s on a sticky note on the side, if I’m honest.' },
      { id: 'other', q: 'Is anything else at HQ still using old protocols?', from: 'u-marcus', a: 'Noah’s old phone still has an IMAP mail app. It stopped working when CA01 went on, and he never complained.' }
    ],
    next: 'Find out what CA01 is protecting before you change it.'
  },
  investigate: {
    goal: 'Understand why CA01 blocks the copier, and what an exclusion would let through.',
    evidence: [
      { label: 'The copier’s sign-in this morning', sub: 'Failure · Other clients', open: { type: 'signin', id: 'c2-copier-tue' } },
      { label: 'Sign-in log: scan-copier this week', sub: 'Including Monday night', open: { type: 'signins', user: 'u-copier' } },
      { label: 'CA01 · Block legacy authentication', sub: 'The policy that blocks it', open: { type: 'policy', id: 'CA01' } },
      { label: 'The scan-copier account', sub: 'A service account', open: { type: 'user', id: 'u-copier' } }
    ],
    notes: [
      { id: 'mfa', q: 'Why can’t the copier answer an MFA prompt?', a: 'proto', opts: [
        ['proto', 'SMTP basic authentication sends a username and password, and has no way to ask for more', 'Right. That’s what makes it legacy: the protocol itself can’t do MFA.'],
        ['phone', 'The copier has no phone to approve on', 'Even with one, SMTP basic authentication has no way to ask.'],
        ['license', 'Service accounts can’t be licensed for MFA', 'Licensing isn’t the problem. The protocol is.']] },
      { id: 'cond', q: 'How does CA01 recognize a legacy sign-in?', a: 'clients', opts: [
        ['clients', 'By the client app: Exchange ActiveSync clients and Other clients', 'Right. SMTP, IMAP and POP all count as Other clients.'],
        ['device', 'By the device platform', 'CA01 doesn’t look at devices.'],
        ['risk', 'By sign-in risk', 'Risk is ID Protection’s job. CA01 uses the Client apps condition.']] },
      { id: 'spray', q: 'On Monday night someone tried scan-copier’s password from Chicago three times. What stopped the third try, which had the right password?', a: 'ca01', opts: [
        ['ca01', 'CA01, because legacy authentication is blocked for every account', 'Right. With the copier excluded, CA01 wouldn’t have applied to that try.'],
        ['pw', 'A wrong password', 'The first two were wrong. The third was right: its error is 53003, not 50126.'],
        ['nothing', 'Nothing. It got in.', 'Open the third attempt: Failure, 53003.']] }
    ]
  },
  fix: {
    goal: 'Decide what to do about the copier, so Tallis can still answer “yes” to “Is legacy authentication blocked for all users?”',
    plans: C2_PLANS,
    tools: [
      { label: 'CA01 · Block legacy authentication', sub: 'View or edit it yourself', open: { type: 'policy', id: 'CA01' } },
      { label: 'The scan-copier account', sub: 'Reset its password or turn off its sign-in', open: { type: 'user', id: 'u-copier' } }
    ],
    status(tn) {
      const ls = legacyStatus(tn.cfg);
      const P = C2_PLANS.find(x => x.id === tn.plan);
      return [{ ok: tn.plan === 'relay' ? true : tn.plan ? false : null, text: P ? 'Your plan: ' + P.label : 'No plan picked yet.' }, { ok: ls.ok, text: ls.ok ? 'CA01 blocks legacy sign-ins for everyone.' : ls.why }];
    }
  },
  userActions: ['u-copier'],
  verify: {
    goal: 'Check that the copier can send scans, and that a password-only sign-in still can’t get in.',
    tests: [
      { id: 'scan', label: 'Lena scans to email', sub: 'Should arrive', run: tn => copierScan(tn, 'chk-scan-' + (tn.seq || 0), tn.now) },
      { id: 'wifi', label: 'Someone on HQ’s guest Wi-Fi tries the copier’s password over IMAP', sub: '192.0.2.25 · should fail', run: tn => check(tn, 'wifi', wifiAtt('', tn.now), e => !passed(e), e => e.code === 50126 ? 'Wrong password: you reset it, so the sticky note is useless.' : 'Blocked. ' + (blockerOf(e) ? blockerOf(e).pid + ' stops password-only sign-ins.' : e.reason), e => 'Got in with just a password and could read the scan mailbox. ' + (legacyStatus(tn.cfg).ok ? '' : legacyStatus(tn.cfg).why)) },
      { id: 'noah', label: 'Noah’s old IMAP app at HQ', sub: 'Should be blocked', run: tn => check(tn, 'noah', { user: 'u-noah', app: 'exo', ip: '192.0.2.16', client: 'other', os: 'Android 9', browser: 'IMAP client' }, e => !passed(e), e => 'Blocked. ' + (blockerOf(e) ? blockerOf(e).pid + ' stops it.' : e.reason), 'Got in over IMAP with just a password.') }
    ]
  },
  close: {
    button: 'Close INC-2209',
    replayTitle: 'The rest of the week',
    replay(tn0) {
      const tn = clone(tn0), out = [];
      const scan = copierScan(tn, 'c2r-scan', at(5, 8, 45, 10));
      out.push({ t: at(5, 8, 45), ok: scan.ok, title: 'Lena scans the signed invoices', text: scan.text, e: scan.e });
      const w = evalSignIn(tn, wifiAtt('c2r-wifi', at(5, 12, 20, 40)));
      out.push({ t: at(5, 12, 20), ok: !passed(w), title: 'A visitor on the guest Wi-Fi tries the password from the sticky note', text: passed(w) ? 'They read the scan mailbox over IMAP with just a password. HQ’s guest Wi-Fi goes out through the office line, and nothing asked for more.' : w.code === 50126 ? 'Wrong password. You reset it after Monday night.' : 'Blocked. ' + (blockerOf(w) ? blockerOf(w).pid + ' stopped a password-only sign-in.' : w.reason), e: w });
      const ls = legacyStatus(tn.cfg);
      out.push({ t: at(6, 10, 0), ok: ls.ok, title: 'The insurer asks: “Is legacy authentication blocked for all users?”', text: ls.ok ? 'Aisha can answer yes.' : 'Aisha has to answer no. ' + ls.why });
      return out;
    },
    solved: tn => legacyStatus(tn.cfg).ok && tn.plan === 'relay',
    tidy(tn) {
      const out = [];
      if (!tn.pwReset['u-copier'] && !tn.disabled['u-copier']) out.push('Someone used scan-copier’s real password from Chicago on Monday night. Reset it, or turn off the account’s sign-in once the relay is in place.');
      return out;
    },
    good: 'The scans flow through the relay, and legacy authentication stays blocked for everyone.',
    learned: ['legacy', 'ca', 'signinlogs', 'breakglass'],
    exam: ['q-legacy-cond', 'q-mfp', 'q-block-wins'],
    expert: 'Legacy protocols send a password and nothing else, so the only safe answer to them is a block for everyone except the emergency accounts. Every exclusion, for an account or a network, is a door that opens with a password alone. Devices like copiers should send through a relay connector that accepts mail from your own addresses, or move to modern authentication, rather than be exempted.'
  },
  hints: {
    investigate: ['Open the copier’s sign-in. Which client app did it use, and which policy said no?', 'Read CA01’s Client apps condition. What does it target?', 'Look at Monday night’s attempts on scan-copier. What would an exclusion have let through?'],
    fix: ['Should a sign-in that can only send a password ever be allowed because of who or where it is?', 'The copier doesn’t have to sign in at all. Exchange Online can accept mail from HQ’s address through a connector.', 'Pick the relay plan, and reset the copier’s password while you’re there.'],
    verify: ['Run all three checks. The scans should arrive and both password-only sign-ins should fail.']
  }
});

/* ---------------------------------------------------------------- 3 */
const SESSION_TIMES = [at(7, 6, 0), at(10, 6, 0), at(11, 6, 0), at(12, 6, 0)];
const nextSessionT = tn => SESSION_TIMES[Math.min(tn.sessions.length, SESSION_TIMES.length - 1)];
function c3Session(tn, gid) {
  const g = grp(gid);
  if (!g) return { err: 'Pick a group.' };
  if (tn.sessions.length >= SESSION_TIMES.length) return { err: 'Tomáš has run every session he can fit in before the deadline.' };
  const t = nextSessionT(tn);
  const members = g.members.filter(onFloor);
  const res = runSession(tn, members, t, tn.keysLeft);
  tn.keysLeft -= res.reg.length;
  tn.sessions.push({ t, gid, lines: res.lines, reg: res.reg.length, of: members.length });
  return { ok: true, summary: 'Ran a key registration session with ' + g.name + ' (' + whenText(t) + '): ' + res.lines.join(' ') };
}
const floorWithKeys = tn => floorIds().filter(uid => hasKey(tn, uid) && tn.keys[uid] && methodOn('passkey', uid, tn.cfg));
const bgKeyWorks = tn => methodOn('passkey', 'u-bg1', tn.cfg) && methodOn('passkey', 'u-bg2', tn.cfg);
function riskyPasses(tn) { return Object.keys(tn.taps || {}).filter(uid => { const p = tn.taps[uid]; return !p.oneTime || p.end - p.start > 8 * 3600; }); }
defCase({
  id: 'c3', no: 'CHG-0420', kind: 'Change', chapter: 1, mins: 12,
  title: 'Can the floor do MFA?',
  brief: 'The insurer wants MFA for everyone. Phones stay in lockers on the shop floor.',
  skills: ['Authentication methods policy', 'Passkeys (FIDO2)', 'Temporary Access Pass', 'Emergency access'],
  now: at(6, 8, 30),
  base: () => build(at(6, 8, 30), ['brno']),
  read: {
    status: 'In progress · due Fri 16 Oct',
    msgs: [
      { from: 'u-ben', t: at(6, 7, 32), text: 'Our cyber insurer sent the renewal questionnaire. They need three things in place by Friday 16 October, or the premium jumps. Can you own this? One rule from me: don’t stop the plant.' },
      { from: 'u-aisha', t: at(6, 8, 10), text: 'I’ll check the tenant against the three requirements on Friday 16 Oct at 12:00. Start with the floor: today none of them can do MFA at all.' }
    ],
    box: { title: 'What the insurer requires by Friday 16 Oct', items: ['MFA for every person, from any location.', 'Legacy authentication blocked for all users.', 'Administrators use phishing-resistant MFA.'] },
    asks: [
      { id: 'phones', q: 'Could people on the floor use their own phones for MFA?', from: 'u-petra', a: 'Phones stay in the lockers on the floor. It’s a safety rule, and the works council won’t agree to requiring personal phones.' },
      { id: 'keys', q: 'Do we have any security keys?', from: 'u-petra', a: 'Purchasing ordered 25 FIDO2 security keys after Monday. They arrived yesterday, and Tomáš has them locked in his office.' },
      { id: 'pilot', q: 'Could one line try it first?', from: 'u-tomas', a: 'Line 2 can go first. Seven people, and they’re the most patient. Shift start at 06:00 is the best time: everyone’s at the kiosks.' }
    ],
    next: 'Get the floor ready to do MFA. Nothing gets enforced in this case.'
  },
  investigate: {
    goal: 'Work out what the floor can use for MFA, and how they get it set up.',
    evidence: [
      { label: 'Registration report', sub: 'Who can do MFA today', open: { type: 'regreport' } },
      { label: 'Authentication methods policy', sub: 'Which methods are on, and for whom', open: { type: 'methods' } },
      { label: 'Jan Novotný’s account', sub: 'A machine operator', open: { type: 'user', id: 'u-f1' } },
      { label: 'A floor kiosk', sub: 'BRN-KIOSK-01', open: { type: 'device', id: 'BRN-KIOSK-01' } }
    ],
    notes: [
      { id: 'what', q: 'What can people on the floor use for MFA at a shared kiosk?', a: 'keys', opts: [
        ['app', 'Microsoft Authenticator on their phones', 'Their phones stay in the lockers.'],
        ['sms', 'SMS codes', 'Same problem: no phones on the floor.'],
        ['keys', 'FIDO2 security keys', 'Right. A key works at any kiosk, needs no phone, and is phishing-resistant.']] },
      { id: 'first', q: 'Someone with nothing registered needs to sign in once to add a key. What lets them?', a: 'tap', opts: [
        ['tap', 'A Temporary Access Pass', 'Right. A pass counts as strong authentication for a short time, which is what registering a key needs.'],
        ['pw', 'Their password alone', 'Registering a passkey needs a recent MFA. A password isn’t enough.'],
        ['sms', 'A one-time SMS code', 'They have no phone on the floor, and SMS isn’t registered for them anyway.']] },
      { id: 'where', q: 'Where do you allow the floor to use security keys?', a: 'methods', opts: [
        ['methods', 'In the authentication methods policy, under Passkey (FIDO2)', 'Right. That’s where a method is made available, and to whom.'],
        ['ca', 'In a Conditional Access policy', 'Conditional Access decides when MFA is required. The methods policy decides which methods people may use.'],
        ['user', 'On each person’s account', 'You can add a pass there, but whether keys are allowed at all is set in the methods policy.']] }
    ]
  },
  fix: {
    goal: 'Get everyone on the floor registered with a security key, without breaking the emergency accounts’ keys.',
    tools: [
      { label: 'Authentication methods policy', sub: 'Passkey (FIDO2) and Temporary Access Pass', open: { type: 'methods' } },
      { label: 'Create Temporary Access Passes', sub: 'For a group, from a start time you choose', open: { type: 'tapform', target: 'g:g-floor' } },
      { label: 'Key registration session with Tomáš', sub: 'At the next shift start', open: { type: 'session' } },
      { label: 'Registration report', sub: 'Who has what', open: { type: 'regreport' } }
    ],
    status(tn) {
      const n = floorWithKeys(tn).length;
      return [{ ok: n === 23, text: 'People on the floor with a security key: ' + n + ' of 23.' }, { ok: null, text: 'Keys left in Tomáš’s office: ' + tn.keysLeft + '.' }];
    }
  },
  verify: {
    goal: 'Check the floor is ready, and that you didn’t break anything for the emergency accounts.',
    tests: [
      { id: 'ready', label: 'Readiness check: could everyone on the floor answer an MFA prompt at a kiosk?', sub: 'Should be 23 of 23', run: tn => { const n = floorWithKeys(tn).length; return { ok: n === 23, text: n === 23 ? 'All 23 have a key and the methods policy lets them use it.' : n + ' of 23 could. ' + (floorIds().filter(uid => !floorWithKeys(tn).includes(uid)).length ? 'Still without a usable key: ' + nameList(floorIds().filter(uid => !floorWithKeys(tn).includes(uid)), 5) + '.' : '') }; } },
      { id: 'bg', label: 'Break-glass drill: Aisha signs in to bg-admin-01 with its security key', sub: 'Should work', run: tn => bgKeyWorks(tn) ? { ok: true, text: 'The key worked. Passkeys are still enabled for SG-Emergency-Access.' } : { ok: false, text: 'The key was refused: passkeys aren’t enabled for SG-Emergency-Access anymore. In a real emergency, nobody could get in.' } }
    ]
  },
  close: {
    button: 'Mark this part of CHG-0420 done',
    replayTitle: 'The following days',
    replay(tn0) {
      const tn = clone(tn0), out = [];
      if (!tn.sessions.length) out.push({ t: at(7, 6, 0), ok: false, title: 'No key registration happened', text: 'Nobody ran a session with Tomáš, so the floor still can’t do MFA.' });
      tn.sessions.forEach(s => out.push({ t: s.t, ok: s.reg === s.of, title: 'Key registration with ' + gName(s.gid), text: 'Tomáš: “' + s.lines.join(' ') + '”' }));
      out.push({ t: at(10, 9, 0), ok: bgKeyWorks(tn), title: 'Aisha’s monthly break-glass drill', text: bgKeyWorks(tn) ? 'bg-admin-01 signed in with its key from the IT safe.' : 'bg-admin-01’s key was refused, because passkeys aren’t enabled for SG-Emergency-Access anymore.' });
      const risky = riskyPasses(tn);
      out.push({ t: at(11, 10, 0), ok: !risky.length, title: 'Aisha reviews the passes you issued', text: risky.length ? plural(risky.length, 'pass was', 'passes were') + ' reusable or valid for more than 8 hours. Printed at a kiosk, that’s a shared password.' : Object.keys(tn.taps || {}).length ? 'All passes were one-time and short. A used pass can’t be used again.' : 'No passes were issued.' });
      return out;
    },
    solved: tn => floorWithKeys(tn).length === 23 && bgKeyWorks(tn),
    tidy(tn) { const r = riskyPasses(tn); return r.length ? [plural(r.length, 'pass is', 'passes are') + ' reusable or longer than 8 hours. Keep passes one-time and short.'] : []; },
    good: 'All 23 people on the floor can now answer an MFA prompt with a security key, and the emergency keys still work.',
    learned: ['authmethod', 'passkey', 'tap', 'breakglass', 'mfa'],
    exam: ['q-tap-onboard', 'q-methods-policy', 'q-tap-onetime'],
    expert: 'On a shared kiosk with no phones, hardware security keys are the usual answer: they hold a passkey, work anywhere, and are phishing-resistant. Getting them registered is the hard part. People with no method at all need a short, one-time Temporary Access Pass that’s valid when they’re actually at the kiosk, and the methods policy has to allow both the pass and the keys for their group. Change it by adding groups, never by replacing the emergency accounts’ access.'
  },
  hints: {
    investigate: ['Ask Petra about phones on the floor, and whether there are any security keys.', 'Open the registration report and the authentication methods policy.', 'Security keys work at shared kiosks without a phone. A Temporary Access Pass gets someone with nothing registered signed in once, to add one.'],
    fix: ['Start with the methods policy: who can use passkeys, and who can sign in with a pass?', 'Add SG-Frontline-Brno to Passkey (FIDO2) and keep SG-Emergency-Access in it. Enable Temporary Access Pass for SG-Frontline-Brno.', 'Create one-time passes that start at the next shift, then run the session with Tomáš for the whole floor.'],
    verify: ['Run the readiness check and the break-glass drill.']
  }
});

/* ---------------------------------------------------------------- 4 */
const newPolicies = tn => tn.cfg.policies.filter(p => +p.id.slice(2) > 10);
function policyImpact(tn, pid) {
  const p = policyById(pid, tn.cfg);
  const out = { mfa: [], register: [], fail: [], none: [] };
  if (!p) return out;
  const tn2 = clone(tn); policyById(pid, tn2.cfg).state = 'on';
  peopleInScope().forEach(u => {
    if (u.type === 'Guest') return;
    const a = coveragePaths(u)[0];
    const att = Object.assign({ user: u.id, t: at(nextWorkday(dayOf(tn.now)), 8, 0), browser: 'Edge 141' }, a);
    const net = netOf(a.ip, tn2.cfg);
    if (whyNot(policyById(pid, tn2.cfg), u, att, net, tn2.cfg)) { out.none.push(u.id); return; }
    const e = evalSignIn(tn2, att);
    if (passed(e)) out.mfa.push(u.id);
    else if (e.status === 'Interrupted' && tryRegister(tn2, att, e.need, true)) out.register.push(u.id);
    else out.fail.push(u.id);
  });
  return out;
}
defCase({
  id: 'c4', no: 'CHG-0420', kind: 'Change', chapter: 1, mins: 12,
  title: 'Turn on MFA without stopping the plant',
  brief: 'Everyone needs MFA from any location. Ben’s one rule: don’t stop the plant.',
  skills: ['Conditional Access templates', 'Report-only mode', 'What If', 'Exclusions'],
  now: at(10, 8, 30),
  base: () => build(at(10, 8, 30), ['brno', 'floorKeys']),
  seed() {
    const tn = this.base(), A = [];
    A.push(evalSignIn(tn, { id: 'c4-jan', t: at(10, 6, 0, 26), user: 'u-f1', app: 'teams', ip: '203.0.113.85', client: 'browser', device: 'BRN-KIOSK-02', browser: 'Edge 141', atKiosk: true }));
    A.push(evalSignIn(tn, { id: 'c4-lena', t: at(10, 8, 2, 11), user: 'u-lena', app: 'exo', ip: '192.0.2.15', client: 'mobileDesktop', device: 'HQ-LT-150', browser: 'Outlook desktop' }));
    A.push(evalSignIn(tn, { id: 'c4-noah', t: at(10, 8, 9, 40), user: 'u-noah', app: 'teams', ip: '192.0.2.16', client: 'mobileDesktop', device: 'HQ-LT-160', browser: 'Teams desktop' }));
    return A;
  },
  read: {
    status: 'In progress · due Fri 16 Oct',
    msgs: [
      { from: 'u-aisha', t: at(10, 8, 5), text: 'Nice work: everyone on the floor has a key now. Requirement 1 is next: MFA for every person, from any location. Today CA02 skips trusted networks and excludes the floor, so that’s a no. Can you get a policy in place this week?' },
      { from: 'u-ben', t: at(10, 8, 20), text: 'Same rule as before: don’t stop the plant. And please don’t flood Marcus with helpdesk calls.' }
    ],
    asks: [
      { id: 'who', q: 'Who might get stuck when MFA is required everywhere?', from: 'u-marcus', a: 'Lena never set up MFA. Noah only has SMS on his old phone. Everyone else in the offices has Authenticator, and the floor has their keys.' },
      { id: 'keys', q: 'Is everyone on the floor carrying their key?', from: 'u-tomas', a: 'On lanyards, all 23. I check at the start of every shift.' }
    ],
    next: 'Find out why the current policies don’t meet requirement 1.'
  },
  investigate: {
    goal: 'Find the gaps in today’s policies, and how to change them safely.',
    evidence: [
      { label: 'CA02 · Require MFA outside trusted networks', sub: 'Today’s MFA policy', open: { type: 'policy', id: 'CA02' } },
      { label: 'CA09 · TEST frontline MFA (Dana)', sub: 'Report-only since August', open: { type: 'policy', id: 'CA09' } },
      { label: 'Jan’s sign-in this morning', sub: 'Look at the Report-only tab', open: { type: 'signin', id: 'c4-jan', tab: 'ro' } },
      { label: 'Lena’s sign-in this morning', sub: 'At HQ', open: { type: 'signin', id: 'c4-lena' } },
      { label: 'Registration report', sub: 'Who can do MFA', open: { type: 'regreport' } },
      { label: 'Conditional Access policies', sub: 'All of them', open: { type: 'policies' } }
    ],
    notes: [
      { id: 'gap', q: 'Why doesn’t CA02 meet requirement 1?', a: 'skips', opts: [
        ['skips', 'It skips trusted locations and excludes the floor', 'Right. MFA “from any location” rules out a trusted-location exception, and the floor is people too.'],
        ['ro', 'It’s in report-only mode', 'CA02 is on.'],
        ['admins', 'It only covers admins', 'That’s CA03. CA02 covers all users, with exceptions.']] },
      { id: 'exclude', q: 'Before you require MFA for all users, which accounts must the policy exclude?', a: 'bg', opts: [
        ['bg', 'The two emergency access accounts', 'Right. If a policy ever locks every admin out, they’re how you get back in.'],
        ['admins', 'All admins', 'Admins need MFA more than anyone.'],
        ['floor', 'The floor', 'They have keys now, and the insurer wants every person covered.'],
        ['none', 'Nobody', 'If a bad policy locks every admin out, the emergency accounts are the way back in.']] },
      { id: 'safe', q: 'How can you see who a new policy would affect, without enforcing it?', a: 'ro', opts: [
        ['ro', 'Create it in report-only mode first', 'Right. Report-only logs what it would have done on every real sign-in.'],
        ['day', 'Turn it on for a day and watch the helpdesk', 'That’s finding out the hard way.'],
        ['ask', 'Email everyone and ask', 'Report-only tells you without asking anyone.']] }
    ]
  },
  fix: {
    goal: 'Require MFA for every person, everywhere, with nobody locked out.',
    tools: [
      { label: 'New policy from a template', sub: 'Microsoft’s recommended policies', open: { type: 'newpolicy' } },
      { label: 'Conditional Access policies', sub: 'Edit, switch on, or delete', open: { type: 'policies' } },
      { label: 'Report-only impact', sub: 'What a report-only policy would do if it were on', open: { type: 'impact' } },
      { label: 'Who’d be locked out', sub: 'Everyone’s next sign-in, with the tenant as it is now', open: { type: 'lockrisk' } }
    ],
    status(tn) {
      const r = evaluateRequirements(tn, tn.now), lr = lockRisk(tn, tn.now);
      return [{ ok: r.r1.ok, text: 'People who must use MFA everywhere: ' + (r.r1.total - r.r1.none.length - r.r1.badEx.length) + ' of ' + r.r1.total + '.' }, { ok: !lr.count, text: lr.count ? plural(lr.count, 'person', 'people') + ' would be locked out at their next sign-in.' : 'Nobody would be locked out at their next sign-in.' }];
    }
  },
  verify: {
    goal: 'Test the people most likely to get stuck, and the emergency account.',
    tests: [
      { id: 'jan', label: 'Jan at a plant kiosk', sub: 'Should be asked for MFA, and use his key', run: tn => check(tn, 'jan', { user: 'u-f1', app: 'teams', ip: '203.0.113.84', client: 'browser', device: 'BRN-KIOSK-01', atKiosk: true }, e => usedMfa(e) && e.usedMethod === 'passkey', 'Asked for MFA, and his security key answered it.', e => passed(e) ? 'Signed in without MFA. ' + (newPolicies(tn).some(p => p.state === 'reportOnly') ? 'Your policy is still in report-only, so it only logged what it would do.' : 'Nothing requires MFA for him yet.') : verdictText(e) + '. ' + e.reason) },
      { id: 'lena', label: 'Lena at HQ', sub: 'Nothing registered yet · should be able to set up MFA', run: tn => check(tn, 'lena', { user: 'u-lena', app: 'exo', ip: '192.0.2.15', client: 'mobileDesktop', device: 'HQ-LT-150' }, e => usedMfa(e) || (e.status === 'Interrupted' && !!tryRegister(tn, { user: 'u-lena', t: tn.now }, e.need, true)), e => usedMfa(e) ? 'Asked for MFA, and she answered it.' : 'Asked to set up MFA. She’ll add Authenticator on her phone, then get in.', e => passed(e) ? 'Signed in without MFA. HQ is trusted, and nothing else requires it yet.' : verdictText(e) + '. ' + e.reason) },
      { id: 'you', label: 'You, to the admin portals', sub: 'Should be asked for MFA', run: tn => check(tn, 'you', { user: 'u-you', app: 'portals', ip: '192.0.2.12', client: 'browser', device: 'HQ-LT-240' }, usedMfa, e => 'Asked for MFA, and you answered it with ' + (METHODS[e.usedMethod] || 'your phone') + '.', e => passed(e) ? 'Signed in without MFA.' + (newPolicies(tn).some(p => ((p.users.exclude || {}).users || []).indexOf('u-you') >= 0) ? ' Your new policy excludes you by name: templates exclude whoever creates them.' : '') : verdictText(e) + '. ' + e.reason) },
      { id: 'bg', label: 'bg-admin-01, the emergency account', sub: 'Should get in', run: tn => check(tn, 'bg', { user: 'u-bg1', app: 'portals', ip: '192.0.2.20', client: 'browser', os: 'Windows 11' }, passed, 'Signed in. The emergency accounts are excluded.', e => verdictText(e) + '. ' + (blockerOf(e) ? blockerOf(e).pid + ' blocks it.' : e.reason)) },
      { id: 'lock', label: 'Everyone’s next sign-in', sub: 'Should be nobody locked out', run: tn => { const lr = lockRisk(tn, tn.now); return { ok: !lr.count, text: lr.count ? nameList(lr.who, 5) + ' couldn’t sign in. ' + lr.why[lr.who[0]] : 'Everyone could sign in tomorrow morning.' }; } }
    ]
  },
  close: {
    button: 'Mark this part of CHG-0420 done',
    replayTitle: 'Tuesday 13 Oct',
    replay(tn0) {
      const tn = clone(tn0), out = [];
      tn.now = at(11, 6, 0);
      const res = floorBatch(tn, at(11, 6, 0, 5), floorIds(), { idp: 'c4r-floor-', tag: 'shift' });
      out.push({ t: at(11, 6, 0), ok: res.ok === res.n, title: 'The day shift starts', text: floorSummary(res), e: res.sample || res.okSample });
      const om = officeMorning(tn, 11, 'c4r-office');
      const lines = [];
      if (om.registered.length) lines.push(nameList(om.registered) + ' set up Authenticator when asked.');
      if (om.sms.length) lines.push(nameList(om.sms) + ' used SMS.');
      if (om.stuck.length || om.blocked.length) lines.push(nameList(om.stuck.concat(om.blocked)) + ' couldn’t sign in: ' + (om.sample ? om.sample.reason : '') );
      out.push({ t: at(11, 8, 0), ok: !om.stuck.length && !om.blocked.length, title: 'The offices start work', text: lines.join(' ') || 'Everyone signed in as usual.', e: om.sample });
      out.push(visitorEvent(tn, at(11, 10, 30), 'Jordan visits Valtek again', evalSignIn(tn, Object.assign({ id: 'c4r-jordan', t: at(11, 10, 30) }, PROBE.jordan)), 'Jordan', 'it isn’t Tallis’s network'));
      const r = evaluateRequirements(tn, tn.now);
      out.push({ t: at(11, 12, 0), ok: r.r1.ok, title: 'Aisha checks requirement 1', text: r.r1.ok ? 'Every person has to use MFA from any location.' : (r.r1.none.length ? nameList(r.r1.none.map(x => x.uid), 4) + ' still don’t: ' + r.r1.none[0].why + '.' : 'Office laptops can skip MFA through ' + r.r1.badEx[0].pid + '’s device option.') });
      return out;
    },
    solved: tn => evaluateRequirements(tn, tn.now).r1.ok && !lockRisk(tn, tn.now).count,
    tidy(tn) {
      const out = [];
      newPolicies(tn).filter(p => p.state !== 'off' && ((p.users.exclude || {}).groups || []).indexOf('g-emergency') < 0).forEach(p => out.push(p.id + ' doesn’t exclude the emergency access accounts.'));
      tn.cfg.policies.filter(p => p.state !== 'off' && ((p.users.exclude || {}).users || []).indexOf('u-you') >= 0).forEach(p => out.push(p.id + ' excludes you by name. Templates exclude whoever creates them; remove yourself once you’ve tested.'));
      if (policyById('CA09', tn.cfg) && policyById('CA09', tn.cfg).state !== 'off') out.push('Dana’s CA09 test policy is still there. Delete it so nobody mistakes it for a real one.');
      return out;
    },
    good: 'Every person has to use MFA from anywhere, and nobody was locked out.',
    learned: ['reportonly', 'whatif', 'mfa', 'ca', 'breakglass'],
    exam: ['q-reportonly', 'q-whatif', 'q-exclude-bg', 'q-ro-result'],
    expert: 'Start from the template, leave it in report-only, and read what it would do before it does it. Exclude the emergency accounts, not yourself: a template excludes its creator so you can’t lock yourself out while testing, and that exclusion is easy to forget. When report-only and What If agree that everyone can satisfy it, switch it on.'
  },
  hints: {
    investigate: ['Open CA02. Who does it skip, and from where?', 'Look at the registration report. Who has nothing, or only SMS?', 'Report-only shows a policy’s effect on every real sign-in without enforcing it.'],
    fix: ['Start from the template for MFA for all users. It begins in report-only.', 'Templates exclude the admin who creates them. Exclude SG-Emergency-Access instead of you.', 'When nobody would be locked out, switch it to On. Delete Dana’s CA09 while you’re there.'],
    verify: ['Run each check. Jan should use his key, Lena should be able to set up Authenticator, and nobody should be locked out.']
  }
});

/* ---------------------------------------------------------------- 5 */
function c5SelfPasskey(tn) {
  if (hasKey(tn, 'u-you')) return { err: 'You already have one.' };
  if (!methodOn('passkey', 'u-you', tn.cfg) || tn.cfg.methods.passkey.selfService === false) return { err: 'Microsoft Authenticator says passkeys aren’t enabled for your account. Enable them for a group you’re in first.' };
  tn.reg['u-you'] = regOf(tn, 'u-you').concat(['passkey']);
  auditPush(tn, 'User registered security info', 'You', [['Method', '', 'Passkey (Microsoft Authenticator)']], 'Authentication Methods');
  return { ok: true, summary: 'You added a passkey in Microsoft Authenticator.' };
}
function c5AskMarcus(tn) {
  if (hasKey(tn, 'u-marcus')) return { err: 'Marcus already has one.' };
  if (!methodOn('passkey', 'u-marcus', tn.cfg) || tn.cfg.methods.passkey.selfService === false) return { err: 'Marcus: “I tried, but it says passkeys aren’t enabled for my account.”' };
  tn.reg['u-marcus'] = regOf(tn, 'u-marcus').concat(['passkey']);
  auditPush(tn, 'User registered security info', 'Marcus Hill', [['Method', '', 'Passkey (Microsoft Authenticator)']], 'Authentication Methods');
  return { ok: true, summary: 'Marcus added a passkey in Microsoft Authenticator.' };
}
const adminRows = tn => adminStatus(tn, tn.now).rows;
/* Did a policy requiring phishing-resistant MFA apply to this sign-in, and was it met? */
const phishMet = e => passed(e) && e.ca.some(r => r.result === 'Success' && /Phishing-resistant/.test(r.why));
defCase({
  id: 'c5', no: 'CHG-0420', kind: 'Change', chapter: 1, mins: 10,
  title: 'Admins on phishing-resistant MFA',
  brief: 'The last insurance requirement, then Aisha’s check on Friday at 12:00.',
  skills: ['Authentication strengths', 'Phishing-resistant MFA', 'Microsoft Entra roles', 'Passkeys'],
  now: at(12, 8, 30),
  base: () => build(at(12, 8, 30), ['brno', 'floorKeys', 'mfaAll']),
  seed() {
    const tn = this.base(), A = [];
    A.push(evalSignIn(tn, { id: 'c5-you', t: at(12, 8, 2, 30), user: 'u-you', app: 'portals', ip: '192.0.2.12', client: 'browser', device: 'HQ-LT-240', browser: 'Edge 141' }));
    A.push(evalSignIn(tn, { id: 'c5-marcus', t: at(12, 8, 45, 3), user: 'u-marcus', app: 'portals', ip: '192.0.2.13', client: 'browser', device: 'HQ-LT-133', browser: 'Edge 141' }));
    return A;
  },
  read: {
    status: 'In progress · due Fri 16 Oct',
    msgs: [
      { from: 'u-aisha', t: at(12, 8, 10), text: 'Requirement 1 is covered, and CA01 still blocks legacy sign-ins, so that’s 2. Requirement 3 is left: administrators on phishing-resistant MFA. Today CA03 covers three admin roles and accepts any MFA. I check on Friday at 12:00.' },
      { from: 'u-ben', t: at(12, 8, 40), text: 'Friday at 16:00 I sign the renewal, if Aisha says yes.' }
    ],
    asks: [
      { id: 'marcus', q: 'What do you use for MFA today?', from: 'u-marcus', a: 'Authenticator push notifications. I’d add a passkey in Authenticator if it were allowed for IT.' },
      { id: 'who', q: 'Who counts as an admin for the insurer?', from: 'u-aisha', a: 'Anyone with an admin role in Entra. The emergency accounts are covered separately: they already sign in with security keys.' }
    ],
    next: 'Find out who the admins are and what protects them today.'
  },
  investigate: {
    goal: 'Find who holds admin roles, and why today’s policies don’t meet requirement 3.',
    evidence: [
      { label: 'Directory roles', sub: 'Who holds which admin role', open: { type: 'roles' } },
      { label: 'CA03 · Require MFA for admin roles', sub: 'Today’s admin policy', open: { type: 'policy', id: 'CA03' } },
      { label: 'Marcus’s sign-in this morning', sub: 'Admin portals', open: { type: 'signin', id: 'c5-marcus' } },
      { label: 'Passkey (FIDO2)', sub: 'In the methods policy', open: { type: 'method', id: 'passkey' } },
      { label: 'Your account', sub: 'Roles and methods', open: { type: 'user', id: 'u-you' } }
    ],
    notes: [
      { id: 'control', q: 'Which grant control enforces phishing-resistant MFA?', a: 'strength', opts: [
        ['strength', 'Require authentication strength: Phishing-resistant MFA', 'Right. A strength narrows which methods count.'],
        ['mfa', 'Require multifactor authentication', 'Any MFA method satisfies that, push and SMS included.'],
        ['compliant', 'Require device to be marked as compliant', 'That checks the device, not how the person signed in.']] },
      { id: 'gap', q: 'Why doesn’t CA03 cover Marcus?', a: 'role', opts: [
        ['role', 'It doesn’t include the Helpdesk Administrator role', 'Right. CA03 covers Global, Security and Conditional Access administrators only.'],
        ['excluded', 'Marcus is excluded from it', 'Open CA03: nobody is excluded but the emergency accounts.'],
        ['off', 'CA03 is off', 'CA03 is on.']] },
      { id: 'order', q: 'What has to happen before the new policy is on, so you and Marcus aren’t locked out?', a: 'register', opts: [
        ['register', 'You both register a passkey, which means passkeys must be enabled for IT', 'Right. Otherwise the policy asks for something you can’t give it.'],
        ['nothing', 'Nothing', 'You’d both be stuck at a prompt you can’t answer.'],
        ['exclude', 'Exclude yourselves', 'Then the policy wouldn’t protect the admins it’s for.']] }
    ]
  },
  fix: {
    goal: 'Require phishing-resistant MFA for every admin role, and make sure every admin can satisfy it.',
    tools: [
      { label: 'Passkey (FIDO2)', sub: 'Who may use passkeys', open: { type: 'method', id: 'passkey' } },
      { label: 'Add a passkey for yourself', sub: 'In Microsoft Authenticator', act: 'c5-self' },
      { label: 'Ask Marcus to add a passkey', sub: 'He’ll do it right away if he can', act: 'c5-marcus' },
      { label: 'New policy from a template', sub: 'Microsoft’s recommended policies', open: { type: 'newpolicy' } },
      { label: 'Conditional Access policies', sub: 'Edit, switch on, or delete', open: { type: 'policies' } }
    ],
    status(tn) {
      const rows = adminRows(tn);
      return [{ ok: rows.every(r => r.covered), text: 'Admins required to use phishing-resistant MFA: ' + rows.filter(r => r.covered).length + ' of ' + rows.length + '.' }, { ok: rows.every(r => r.ready), text: 'Admins with a passkey they can use: ' + rows.filter(r => r.ready).length + ' of ' + rows.length + '.' }];
    }
  },
  verify: {
    goal: 'Sign in as each admin, check the emergency account, and run Aisha’s pre-check.',
    tests: [
      { id: 'you', label: 'You, to the admin portals', sub: 'Should require and get a passkey', run: tn => check(tn, 'you', { user: 'u-you', app: 'portals', ip: '192.0.2.12', client: 'browser', device: 'HQ-LT-240' }, phishMet, 'A policy required phishing-resistant MFA, and your passkey met it.', e => passed(e) ? 'Signed in with ' + (METHODS[e.usedMethod] || 'a password') + ', but nothing required phishing-resistant MFA for you.' + (((e.ca.find(r => /excluded/.test(r.why) && /this user is excluded/.test(r.why))) ? ' A policy excludes you by name.' : '')) : verdictText(e) + '. ' + e.reason) },
      { id: 'marcus', label: 'Marcus, to the admin portals', sub: 'Should require and get a passkey', run: tn => check(tn, 'marcus', { user: 'u-marcus', app: 'portals', ip: '192.0.2.13', client: 'browser', device: 'HQ-LT-133' }, phishMet, 'A policy required phishing-resistant MFA, and his passkey met it.', e => passed(e) ? 'Signed in with ' + (METHODS[e.usedMethod] || 'a password') + ', but nothing required phishing-resistant MFA for him.' : verdictText(e) + '. ' + e.reason) },
      { id: 'bg', label: 'bg-admin-01, the emergency account', sub: 'Should get in', run: tn => check(tn, 'bg', { user: 'u-bg1', app: 'portals', ip: '192.0.2.20', client: 'browser', os: 'Windows 11' }, passed, 'Signed in. The emergency accounts are excluded.', e => verdictText(e) + '. ' + e.reason) },
      { id: 'pre', label: 'Aisha’s pre-check of all three requirements', sub: 'Should be three yeses', run: tn => { const r = evaluateRequirements(tn, tn.now), lr = lockRisk(tn, tn.now); const ok = r.r1.ok && r.r2.ok && r.r3.ok && r.r3.rows.every(x => x.ready) && !lr.count; return { ok, text: ['1. MFA for everyone: ' + (r.r1.ok ? 'yes.' : 'no.'), '2. Legacy authentication blocked: ' + (r.r2.ok ? 'yes.' : 'no. ' + r.r2.why), '3. Admins on phishing-resistant MFA: ' + (r.r3.ok ? (r.r3.rows.every(x => x.ready) ? 'yes.' : 'required, but ' + nameList(r.r3.rows.filter(x => !x.ready).map(x => x.uid)) + ' can’t satisfy it yet.') : 'no.')].concat(lr.count ? [nameList(lr.who) + ' would be locked out tomorrow.'] : []).join(' ') }; } }
    ]
  },
  close: {
    button: 'Tell Aisha it’s ready for Friday',
    replayTitle: 'Friday 16 Oct',
    replay(tn0) {
      const tn = clone(tn0), out = [];
      tn.now = at(14, 8, 0);
      const you = evalSignIn(tn, { id: 'c5r-you', t: at(14, 8, 30, 12), user: 'u-you', app: 'portals', ip: '192.0.2.12', client: 'browser', device: 'HQ-LT-240', browser: 'Edge 141' });
      out.push({ t: at(14, 8, 30), ok: passed(you), title: 'You sign in to the admin center', text: passed(you) ? verdictText(you) + '.' : 'You couldn’t: ' + you.reason, e: you });
      const m = evalSignIn(tn, { id: 'c5r-marcus', t: at(14, 8, 45, 40), user: 'u-marcus', app: 'portals', ip: '192.0.2.13', client: 'browser', device: 'HQ-LT-133', browser: 'Edge 141' });
      out.push({ t: at(14, 8, 45), ok: passed(m), title: 'Marcus opens the helpdesk', text: passed(m) ? verdictText(m) + '.' : 'Marcus couldn’t sign in: ' + m.reason + ' The helpdesk was down until lunchtime.', e: m });
      const r = evaluateRequirements(tn, tn.now);
      const all = r.r1.ok && r.r2.ok && r.r3.ok;
      out.push({ t: at(14, 12, 0), ok: all, title: 'Aisha checks the tenant', text: ['1. MFA for everyone: ' + (r.r1.ok ? 'yes.' : 'no.'), '2. Legacy authentication blocked: ' + (r.r2.ok ? 'yes.' : 'no.'), '3. Admins on phishing-resistant MFA: ' + (r.r3.ok ? 'yes.' : 'no, ' + nameList(r.r3.rows.filter(x => !x.covered).map(x => x.uid)) + ' aren’t covered.')].join(' ') });
      out.push({ t: at(14, 16, 0), ok: all, title: 'Ben and the renewal', text: all ? 'Ben: “Signed. Thanks for getting this done without drama.”' : 'Ben: “I can’t sign this as it stands. I’ve asked the insurer for two more weeks, and the quote went up.”' });
      return out;
    },
    solved(tn) { const r = evaluateRequirements(tn, tn.now); return r.r1.ok && r.r2.ok && r.r3.ok && r.r3.rows.every(x => x.ready) && !lockRisk(tn, tn.now).count; },
    tidy(tn) {
      const out = [];
      newPolicies(tn).filter(p => p.state !== 'off' && ((p.users.exclude || {}).groups || []).indexOf('g-emergency') < 0).forEach(p => out.push(p.id + ' doesn’t exclude the emergency access accounts.'));
      tn.cfg.policies.filter(p => p.state !== 'off' && ((p.users.exclude || {}).users || []).indexOf('u-you') >= 0).forEach(p => out.push(p.id + ' excludes you by name. Remove yourself once you’ve tested.'));
      if (!(tn.cfg.methods.passkey.include === 'all' || tn.cfg.methods.passkey.include.indexOf('g-emergency') >= 0)) out.push('Passkeys aren’t enabled for the emergency accounts anymore.');
      return out;
    },
    good: 'All three requirements are met, and Ben signed the renewal.',
    learned: ['authstrength', 'phishres', 'entraroles', 'passkey'],
    exam: ['q-authstrength', 'q-phish-method', 'q-breakglass', 'q-least-priv'],
    expert: '“Require MFA” is satisfied by any method, including push and SMS, which attackers can phish. For admins, require the phishing-resistant authentication strength and cover every admin role, not just Global Administrator. Order matters: make passkeys available, have each admin register one, then enforce. And keep the emergency accounts out of it, on their own security keys.'
  },
  hints: {
    investigate: ['Open Directory roles. Who holds admin roles today?', 'Open CA03. Which roles does it cover, and what does it require?', 'Phishing-resistant MFA is an authentication strength. Only passkeys, Windows Hello for Business and certificates satisfy it.'],
    fix: ['Before any policy, make passkeys available to SG-IT in the methods policy.', 'Add your own passkey, and ask Marcus to add his.', 'Create the policy from the administrators template, exclude SG-Emergency-Access instead of yourself, and switch it on.'],
    verify: ['Sign in as yourself and as Marcus, then run Aisha’s pre-check.']
  }
});

/* ---------------------------------------------------------------- 6 */
defCase({
  id: 'c6', no: 'CHG-0431', kind: 'Change', chapter: 2, mins: 10,
  title: 'Single sign-on for Fieldline',
  brief: 'Sales bought a CRM. Set up SAML single sign-on before Thursday’s kickoff.',
  skills: ['Enterprise applications', 'The app gallery', 'SAML single sign-on'],
  now: at(CH3, 8, 30),
  base: () => build(at(CH3, 8, 30), ['brno', 'floorKeys', 'mfaAll', 'admins', 'apps']),
  read: {
    status: 'In progress · kickoff Thu 22 Oct, 08:00',
    msgs: [
      { from: 'u-sofia', t: at(CH3, 8, 5), text: 'Morning! We signed with Fieldline, a CRM. My team starts on it at Thursday’s 08:00 kickoff, and we want to sign in with our Tallis accounts. Fieldline’s setup email is attached. Can you own the Entra side?', doc: 'fieldline-mail' }
    ],
    asks: [
      { id: 'who', q: 'Who will open Fieldline on Thursday?', from: 'u-sofia', a: 'My five: Grace, Tyler, Jordan, Diego and me. And Ben, who wants to see the whole pipeline.' },
      { id: 'roles', q: 'Do I have the rights to add an app?', from: 'u-marcus', a: 'Ben and I made you Cloud Application Administrator this morning, with the emergency account. That covers enterprise apps and app registrations.' }
    ],
    next: 'Work out where Fieldline goes and what each URL is for.'
  },
  investigate: {
    goal: 'Know where Fieldline belongs in Entra, and what each value in the email is for.',
    evidence: [
      { label: 'Fieldline’s setup email', sub: 'From Sam Ortiz', open: { type: 'doc', id: 'fieldline-mail' } },
      { label: 'Enterprise applications', sub: 'Apps people sign in to', open: { type: 'entapps' } },
      { label: 'App registrations', sub: 'Apps defined in Tallis', open: { type: 'appregs' } },
      { label: 'The Microsoft Entra gallery', sub: 'Pre-integrated SaaS apps', open: { type: 'gallery' } }
    ],
    notes: [
      { id: 'where', q: 'Where do you add Fieldline?', a: 'ent', opts: [
        ['ent', 'Enterprise applications, from the gallery', 'Right. A gallery app comes with its SAML template, and adding it creates its registration too.'],
        ['reg', 'App registrations, as a new registration', 'That’s for apps Tallis builds. A gallery app brings its own SAML setup.'],
        ['ca', 'Conditional Access, as a target resource', 'Conditional Access can point at Fieldline once it exists. It doesn’t add apps.']] },
      { id: 'reply', q: 'Which of Fieldline’s URLs is the Reply URL?', a: 'acs', opts: [
        ['entity', 'The Entity ID', 'That’s the Identifier: the name Fieldline uses for itself.'],
        ['acs', 'The ACS URL', 'Right. The Assertion Consumer Service is where Entra posts the signed SAML token.'],
        ['login', 'The Login URL', 'That’s the optional Sign on URL, where people start.']] },
      { id: 'trust', q: 'What does Fieldline need from Tallis to trust Entra’s tokens?', a: 'meta', opts: [
        ['meta', 'Tallis’s App Federation Metadata URL, which carries the signing certificate', 'Right. Fieldline checks every token’s signature against it.'],
        ['secret', 'A client secret', 'SAML apps don’t use client secrets. They check signatures.'],
        ['pw', 'Sofia’s password', 'Single sign-on means Fieldline never sees a password.']] }
    ]
  },
  fix: {
    goal: 'Add Fieldline from the gallery, enter its SAML settings, and send Fieldline the metadata.',
    tools: [
      { label: 'The Microsoft Entra gallery', sub: 'Add Fieldline CRM', open: { type: 'gallery' } },
      { label: 'Fieldline CRM · Single sign-on', sub: 'Basic SAML configuration and metadata', open: { type: 'entapp', id: FL.ent, tab: 'sso' }, needs: tn => !!flApp(tn) },
      { label: 'Fieldline’s setup email', sub: 'The values to enter', open: { type: 'doc', id: 'fieldline-mail' } }
    ],
    status(tn) {
      const s = flState(tn);
      const text = !s.added ? 'Fieldline isn’t in Tallis yet.' : !s.idOk || !s.replyOk ? 'Fieldline is added. Its SAML settings aren’t complete.' : !s.meta ? 'SAML settings entered. Fieldline doesn’t have Tallis’s metadata yet.' : 'Fieldline is set up for single sign-on. Test it.';
      return [{ ok: s.ssoOk && s.meta, text }];
    }
  },
  verify: {
    goal: 'Test single sign-on as yourself, the way Sales will sign in.',
    tests: [
      { id: 'sso', label: 'Test sign-in to Fieldline, as you', sub: 'From the Single sign-on page', run: tn => {
        const r = flEval(tn, { id: 'chk-sso-' + (tn.seq || 0), t: tn.now, user: 'u-you', ip: '192.0.2.12', device: 'HQ-LT-240', client: 'browser', browser: 'Edge 141' });
        if (r.stage === 'vendor') return { ok: false, text: flApp(tn) ? 'Fieldline’s page says single sign-on isn’t set up for Tallis yet. They need your metadata.' : 'Fieldline isn’t in Tallis yet.' };
        if (r.ok) return { ok: true, e: r.e, text: 'You got into Fieldline as ' + r.role + '. Single sign-on works.' };
        if (r.e.code === 50105) return { ok: true, e: r.e, text: 'AADSTS50105: you aren’t assigned. That’s good news here: Entra found Fieldline and the Reply URL matched. Who gets in is the next case.' };
        return { ok: false, e: r.e, text: 'AADSTS' + r.e.code + ': ' + r.e.reason };
      } }
    ]
  },
  close: {
    button: 'Tell Sofia single sign-on is ready',
    replayTitle: 'Monday afternoon',
    replay(tn0) {
      const tn = clone(tn0), out = [];
      const r = flEval(tn, flAtt('u-sofia', at(CH3, 14, 10, 20), 0, 'try'));
      const sso = r.stage === 'entra' && (r.ok || r.e.code === 50105);
      out.push({ t: at(CH3, 14, 10), ok: sso, title: 'Sofia tries Fieldline', text: r.stage === 'vendor' ? 'Fieldline’s page said single sign-on isn’t set up for Tallis yet.' : r.ok ? 'Sofia got in as ' + r.role + '.' : r.e.code === 50105 ? 'Entra signed Sofia in, then refused her: she isn’t assigned (50105). Single sign-on itself works.' : flSaw('u-sofia', r), e: r.e });
      out.push({ t: at(CH3, 14, 35), ok: null, title: 'Marcus has an idea', text: 'Marcus: “Sofia called about that error. I’ll set Assignment required to No so she can test. We can tidy it up tomorrow.”' });
      return out;
    },
    solved: tn => { const s = flState(tn); return s.ssoOk && s.meta && s.vendor; },
    tidy(tn) { const a = flApp(tn); return a && !a.assignReq ? ['Assignment required is No, so anyone at Tallis can sign in to Fieldline.'] : []; },
    good: 'Fieldline trusts Tallis’s tokens, and Entra knows where to send them.',
    learned: ['entapp', 'appreg', 'sso'],
    exam: ['q-gallery', 'q-50011', 'p-appreg-entapp'],
    expert: 'A SaaS app from the gallery is added as an enterprise application, which creates its app registration for you. SAML needs both sides: Entra must know the app’s Identifier and Reply URL exactly as the vendor gives them, and the vendor must trust Entra’s signing certificate from the federation metadata. A 50105 on your first test is normal: it means everything up to assignment works.'
  },
  hints: {
    investigate: ['Read Fieldline’s setup email first.', 'A SaaS app from the gallery goes in Enterprise applications.', 'The Reply URL is where Entra posts the SAML token: Fieldline’s ACS URL.'],
    fix: ['Add Fieldline CRM from the gallery.', 'On its Single sign-on page, set the Identifier to the Entity ID and the Reply URL to the ACS URL.', 'Send Fieldline the App Federation Metadata URL, so they trust Tallis’s tokens.'],
    verify: ['Use Test sign-in. AADSTS50105 means SAML works and you just aren’t assigned yet.']
  }
});

/* ---------------------------------------------------------------- 7 */
defCase({
  id: 'c7', no: 'CHG-0431', kind: 'Change', chapter: 2, mins: 10,
  title: 'Who gets into Fieldline, and as what',
  brief: 'Sofia can only see her own deals. The all-staff email links to Fieldline on Thursday.',
  skills: ['Assignment required', 'Users and groups', 'App roles'],
  now: at(CH3 + 1, 9, 0),
  base() {
    const tn = build(at(CH3 + 1, 9, 0), ['brno', 'floorKeys', 'mfaAll', 'admins', 'apps', 'fieldline']);
    flApp(tn).assignReq = false;
    return tn;
  },
  seed() {
    const tn = this.base();
    const r = flEval(tn, Object.assign(flAtt('u-sofia', at(CH3, 16, 40, 12), 0, 'try'), { id: 'c7-sofia' }));
    return r.e ? [r.e] : [];
  },
  read: {
    status: 'In progress · kickoff Thu 22 Oct, 08:00',
    msgs: [
      { from: 'u-marcus', t: at(CH3, 14, 35), text: 'Sofia couldn’t get into Fieldline (50105), so I set Assignment required to No. She’s in now.' },
      { from: 'u-sofia', t: at(CH3 + 1, 8, 50), text: 'I’m in, but I only see my own deals. I need the whole pipeline, and so does Ben. Thursday at 08:00: Grace, Tyler, Jordan, Diego, me, and Ben.' },
      { from: 'u-maya', t: at(CH3 + 1, 8, 58), text: 'Heads-up: Fieldline bills for every active user, and we pay for 8 seats.' }
    ],
    asks: [
      { id: 'email', q: 'Ben, are you announcing Fieldline anywhere?', from: 'u-ben', a: 'Yes! Thursday’s all-staff email at 07:30 has a link to it, so everyone knows we have a CRM now.' }
    ],
    next: 'Find out who can get in right now, and what decides what they see.'
  },
  investigate: {
    goal: 'Work out who can sign in to Fieldline now, and what decides what they see.',
    evidence: [
      { label: 'Fieldline CRM · Properties', sub: 'Enabled, assignment, visibility', open: { type: 'entapp', id: FL.ent, tab: 'props' } },
      { label: 'Fieldline CRM · Users and groups', sub: 'Who is assigned', open: { type: 'entapp', id: FL.ent, tab: 'users' } },
      { label: 'Fieldline CRM · App roles', sub: 'On its app registration', open: { type: 'appreg', id: FL.reg, tab: 'roles' } },
      { label: 'Sofia’s Fieldline sign-in', sub: 'Monday 16:40', open: { type: 'signin', id: 'c7-sofia' } },
      { label: 'SG-Sales', sub: 'The sales team', open: { type: 'group', id: 'g-sales' } }
    ],
    notes: [
      { id: 'who', q: 'With Assignment required set to No, who can sign in to Fieldline?', a: 'all', opts: [
        ['all', 'Anyone at Tallis', 'Right. No means every user in the tenant can get a token for it.'],
        ['sofia', 'Only Sofia', 'Nobody is assigned at all. Sofia got in because nothing requires it.'],
        ['sales', 'Only Sales', 'Nothing limits it to Sales yet.']] },
      { id: 'see', q: 'What decides that Sofia sees the whole pipeline?', a: 'role', opts: [
        ['role', 'The app role she’s assigned: Manager', 'Right. Fieldline reads the role from her token.'],
        ['title', 'Her job title', 'Fieldline doesn’t read job titles. It reads app roles.'],
        ['ca', 'A Conditional Access policy', 'Conditional Access decides whether she gets in, not what she sees.']] },
      { id: 'how', q: 'What’s the cleanest way to give Sales access?', a: 'group', opts: [
        ['group', 'Assign SG-Sales as User, and Sofia and Ben as Manager', 'Right. New hires in SG-Sales get access without a ticket.'],
        ['each', 'Assign each person as User, one by one', 'It works, but every new hire needs a ticket, and nobody gets Manager.'],
        ['leave', 'Leave Assignment required on No, and set roles for Sofia and Ben', 'Then anyone with the link gets in, and Maya pays for them.']] }
    ]
  },
  fix: {
    goal: 'Only the six people who need Fieldline can sign in, and Sofia and Ben see the whole pipeline.',
    tools: [
      { label: 'Fieldline CRM · Properties', sub: 'Assignment required', open: { type: 'entapp', id: FL.ent, tab: 'props' } },
      { label: 'Fieldline CRM · Users and groups', sub: 'Assign people and groups, with a role', open: { type: 'entapp', id: FL.ent, tab: 'users' } },
      { label: 'Access preview', sub: 'Who can sign in now, and as what', open: { type: 'access' } }
    ],
    status(tn) {
      const s = flState(tn), roleOf = uid => { const r = flRolesOf(tn, uid); return r.indexOf('Manager') >= 0 ? 'Manager' : r.length ? 'User' : (flApp(tn).assignReq ? 'can’t sign in' : 'User, by default'); };
      return [{ ok: !s.extra.length && !s.missing.length, text: 'People who can sign in: ' + s.canIn.length + (s.extra.length ? ', including ' + s.extra.length + ' outside Sales.' : '.') }, { ok: !s.wrongRole.length && !s.missing.length, text: 'Sofia: ' + roleOf('u-sofia') + '. Ben: ' + roleOf('u-ben') + '.' }];
    }
  },
  verify: {
    goal: 'Have the right people try, and someone who shouldn’t get in.',
    tests: [
      { id: 'sofia', label: 'Ask Sofia to try now', sub: 'Should get in as Manager', run: tn => { const r = flEval(tn, Object.assign(flAtt('u-sofia', tn.now, 0, 'try'), { id: 'chk-sofia-' + (tn.seq || 0) })); return { ok: flOutcome('u-sofia', r) === 'in', e: r.e, text: flSaw('u-sofia', r) }; } },
      { id: 'ben', label: 'Ask Ben to try', sub: 'Should get in as Manager', run: tn => { const r = flEval(tn, Object.assign(flAtt('u-ben', tn.now, 5, 'try'), { id: 'chk-ben-' + (tn.seq || 0) })); return { ok: flOutcome('u-ben', r) === 'in', e: r.e, text: flSaw('u-ben', r) }; } },
      { id: 'grace', label: 'Ask Grace to try', sub: 'Should get in as User', run: tn => { const r = flEval(tn, Object.assign(flAtt('u-grace', tn.now, 1, 'try'), { id: 'chk-grace-' + (tn.seq || 0) })); return { ok: flOutcome('u-grace', r) === 'in', e: r.e, text: flSaw('u-grace', r) }; } },
      { id: 'priya', label: 'Priya from HR opens the link', sub: 'Should be refused', run: tn => { const r = flEval(tn, { id: 'chk-priya-' + (tn.seq || 0), t: tn.now, user: 'u-priya', ip: '192.0.2.14', device: 'HQ-LT-104', client: 'browser', browser: 'Edge 141' }); return { ok: !r.ok, e: r.e, text: r.ok ? 'Priya got in as ' + r.role + '. She isn’t in Sales, and she’d take a paid seat.' : 'Refused: ' + flSaw('u-priya', r).replace(/^Priya /, '') }; } }
    ]
  },
  close: {
    button: 'Tell Sofia it’s ready for Thursday',
    replayTitle: 'Thursday 22 Oct',
    replay(tn0) {
      const tn = clone(tn0), out = [], d = CH3 + 3;
      const users = { 'u-sofia': true };
      const got = [], stopped = [];
      CURIOUS.forEach((uid, i) => {
        const brno = BRNO_OFFICE.indexOf(uid) >= 0;
        const r = flLive(tn, { id: 'c7r-all-' + i, t: at(d, 7, 35) + i * 140, user: uid, ip: brno ? '203.0.113.84' : '192.0.2.' + (10 + i), device: U[uid].devices[0] || null, client: 'browser', browser: 'Edge 141' });
        if (r.ok) { got.push(uid); users[uid] = true; } else stopped.push(uid);
      });
      out.push({ t: at(d, 7, 30), ok: !got.length, title: 'Ben’s all-staff email links to Fieldline', text: got.length ? nameList(got) + ' clicked the link and got into Fieldline. They aren’t in Sales.' : nameList(stopped) + ' clicked the link. Entra refused them: they aren’t assigned (50105).' });
      const res = SALES.concat(['u-ben']).map((uid, i) => { const r = flLive(tn, Object.assign(flAtt(uid, at(d, 8, 0) + i * 45, i, 'kickoff'), { id: 'c7r-k-' + i })); if (r.ok) users[uid] = true; return { uid, r, oc: flOutcome(uid, r) }; });
      const bad = res.filter(x => x.oc !== 'in');
      out.push({ t: at(d, 8, 0), ok: !bad.length, title: 'The Sales kickoff', text: !bad.length ? 'All six got in: Sofia and Ben as Managers, the rest as Users.' : bad.map(x => flSaw(x.uid, x.r)).join(' '), e: (bad[0] && bad[0].r.e) || (res[0].r.e) });
      const n = Object.keys(users).length;
      out.push({ t: at(d + 1, 9, 0), ok: n <= FL.seats, title: 'Fieldline counts active users for the invoice', text: plural(n, 'active user') + ' for ' + FL.seats + ' paid seats.' + (n > FL.seats ? ' Maya: “Who are the other ' + (n - FL.seats) + '?”' : '') });
      return out;
    },
    solved: tn => { const s = flState(tn); return s.assignReq && !s.missing.length && !s.wrongRole.length && !s.extra.length; },
    tidy(tn) { const a = flApp(tn); return a && !a.assigned.some(x => x.who === 'g:g-sales') ? ['Sales members are assigned one by one. Assign SG-Sales instead, so new hires get access without a ticket.'] : []; },
    good: 'Only Sales and Ben get into Fieldline, and Sofia and Ben see the whole pipeline.',
    learned: ['assignreq', 'approle', 'entapp'],
    exam: ['q-50105', 'q-assignreq', 'q-approle', 'p-approle-assignreq'],
    expert: 'Assignment required is the gate: with No, every user in the tenant can get a token, whatever you assign. With Yes, assign groups rather than people, so access follows membership. App roles are a separate decision: the app defines them, you hand them out with each assignment, and they reach the app in the token.'
  },
  hints: {
    investigate: ['Open Fieldline’s properties. What does Assignment required say?', 'App roles come from the app registration: User and Manager.', 'Assigning a group means new Sales hires get access without a ticket.'],
    fix: ['Set Assignment required back to Yes.', 'Assign SG-Sales with the User role.', 'Assign Sofia and Ben individually with the Manager role.'],
    verify: ['Have Sofia, Ben and Grace try, and check that Priya is refused.']
  }
});

/* ---------------------------------------------------------------- 8 */
const MONDAY_RUN = at(CH3 + 7, 2, 0, 40);
defCase({
  id: 'c8', no: 'INC-2238', kind: 'Incident', chapter: 2, mins: 12,
  title: 'Dana’s secret expires on Sunday',
  brief: 'A note in Dana’s calendar: “Sun 25 Oct – MES-Export renew!!”. Nobody knows what MES-Export is.',
  skills: ['App registrations', 'Client secrets', 'Managed identities', 'Azure role assignments'],
  now: at(CH3, 8, 25),
  base: () => build(at(CH3, 8, 25), ['brno', 'floorKeys', 'mfaAll', 'admins', 'apps']),
  seed() {
    const tn = this.base(), A = [];
    for (let d = CH3 - 6; d <= CH3; d++) { const r = runExport(tn, at(d, 2, 0, 40)); r.sp.id = 'c8-sp-' + d; A.push(r.sp); }
    return A;
  },
  read: {
    status: 'Open · priority 3',
    msgs: [
      { from: 'u-marcus', t: at(CH3, 8, 20), text: 'Going through Dana’s handover folder. Her calendar has one item left: “Sun 25 Oct – MES-Export renew!!”. No idea what MES-Export is. Can you take it? Ben and I made you Cloud Application Administrator this morning, and you’re Owner of rg-mes in Azure now. That’s where Dana kept the MES things.' }
    ],
    asks: [
      { id: 'noah', q: 'Noah, what uses MES-Export?', from: 'u-noah', a: 'That’s the nightly export. A script on mes-export-vm signs in as MES-Export at 02:00 and writes the day’s production data to tallismesdata. The Brno dashboard reads it at 06:00 for Petra’s 07:00 meeting. Dana set it up; I just look after the script.' },
      { id: 'petra', q: 'Petra, how much do you rely on the production dashboard?', from: 'u-petra', a: 'Every morning at 07:00. Without it we run the meeting from paper, and nobody enjoys that.' }
    ],
    next: 'Find out what expires, and what depends on it.'
  },
  investigate: {
    goal: 'Find what expires on Sunday, what breaks when it does, and what a lasting fix looks like.',
    evidence: [
      { label: 'MES-Export · Certificates & secrets', sub: 'App registration', open: { type: 'appreg', id: 'ar-mes', tab: 'secrets' } },
      { label: 'Service principal sign-ins', sub: 'Apps signing in as themselves', open: { type: 'spsignins' } },
      { label: 'mes-export-vm', sub: 'The VM that runs the export', open: { type: 'vm' } },
      { label: 'tallismesdata · Access control (IAM)', sub: 'Who can do what with the data', open: { type: 'storage' } }
    ],
    notes: [
      { id: 'break', q: 'If nothing changes, what happens at 02:00 on Monday 26 Oct?', a: 'token', opts: [
        ['token', 'The export can’t get a token (AADSTS7000222), so the dashboard shows old numbers', 'Right. An expired secret stops working the second it expires.'],
        ['renew', 'Nothing: secrets renew themselves', 'Nothing renews a client secret. That’s why Dana wrote the note.'],
        ['write', 'It signs in, but can’t write the file', 'That would be a 403 from storage. Here it never gets a token.']] },
      { id: 'lasting', q: 'Which fix leaves nothing to renew?', a: 'mi', opts: [
        ['mi', 'A managed identity on mes-export-vm', 'Right. Azure looks after its credentials.'],
        ['long', 'A new 24-month secret', 'It moves the outage to 2028, and a long-lived secret is a long window if it leaks.'],
        ['owner', 'Make Noah an owner of MES-Export', 'Owners can add secrets. Someone still has to renew them.']] },
      { id: 'role', q: 'Which role lets an identity write blobs in tallismesdata?', a: 'sbdc', opts: [
        ['sbdc', 'Storage Blob Data Contributor', 'Right. That’s what MES-Export has today.'],
        ['contrib', 'Contributor', 'Contributor manages the account, but gives no access to its data through Entra sign-in.'],
        ['reader', 'Reader', 'Reader can see the account exists. Nothing more.']] }
    ]
  },
  fix: {
    goal: 'Keep Monday’s export working. Best: with nothing left to renew.',
    tools: [
      { label: 'MES-Export · Certificates & secrets', sub: 'Add or delete client secrets', open: { type: 'appreg', id: 'ar-mes', tab: 'secrets' } },
      { label: 'mes-export-vm · Identity', sub: 'Turn on a managed identity', open: { type: 'vm', tab: 'identity' } },
      { label: 'tallismesdata · Access control (IAM)', sub: 'Add or remove role assignments', open: { type: 'storage' } },
      { label: 'Ask Noah to switch the script to the managed identity', sub: 'He’ll do it within the hour', act: 'c8-switch' }
    ],
    status(tn) {
      const x = xState(tn);
      const how = x.auth === 'mi' ? 'mes-export-vm’s managed identity' : x.sec ? (x.sec.id === 'sec-dana' ? 'Dana’s client secret, expiring Sun 25 Oct' : 'your client secret “' + x.sec.desc + '”') : 'a secret that no longer exists';
      const tonight = runExport(clone(tn), at(dayOf(tn.now) + 1, 2, 0, 40));
      return [{ ok: null, text: 'The export signs in with ' + how + '.' }, { ok: tonight.ok, text: tonight.ok ? 'Tonight’s 02:00 run would work.' : 'Tonight’s 02:00 run would fail: ' + tonight.detail }];
    }
  },
  verify: {
    goal: 'Run the export now, then as next Monday’s 02:00 run would.',
    tests: [
      { id: 'now', label: 'Run the export now', sub: 'A test run, writing today’s file', run: tn => { const r = runExport(clone(tn), tn.now); return { ok: r.ok, sp: r.sp, text: r.ok ? 'It worked: signed in with ' + (r.auth === 'mi' ? 'the managed identity' : 'the client secret') + ' and wrote the file.' : 'It failed at the ' + (r.step === 'token' ? 'sign-in' : 'storage') + ' step. ' + r.detail }; } },
      { id: 'monday', label: 'Run it as Monday 26 Oct, 02:00 would', sub: 'After Dana’s secret expires', run: tn => { const r = runExport(clone(tn), MONDAY_RUN); return { ok: r.ok, sp: r.sp, text: r.ok ? 'It would work: ' + r.detail : 'It would fail. ' + r.detail }; } }
    ]
  },
  close: {
    button: 'Close INC-2238',
    replayTitle: 'The week, night by night',
    replay(tn0) {
      const tn = clone(tn0), out = [];
      const nights = [];
      for (let d = CH3 + 1; d <= CH3 + 6; d++) nights.push(runExport(tn, at(d, 2, 0, 40)));
      const badN = nights.filter(r => !r.ok);
      out.push({ t: at(CH3 + 1, 2, 0), ok: !badN.length, title: 'Tuesday to Sunday, 02:00', text: !badN.length ? 'Every night the export signed in and wrote its file.' : badN.length + ' of 6 runs failed. ' + badN[0].detail, sp: (badN[0] || nights[0]).sp });
      const r0 = tn.apps.reg['ar-mes'], dana = r0 && r0.secrets.find(s => s.id === 'sec-dana');
      if (dana) out.push({ t: tn.apps.danaExp, ok: null, title: 'Dana’s MES-Export secret expires', text: tn.apps.job.auth === 'secret' && tn.apps.job.secretId === 'sec-dana' ? 'The export still uses it.' : 'Nothing uses it anymore.' });
      const mon = runExport(tn, MONDAY_RUN);
      out.push({ t: MONDAY_RUN, ok: mon.ok, title: 'Monday 26 Oct, 02:00', text: mon.ok ? 'The export ran and wrote the weekend’s data. ' + (mon.auth === 'mi' ? 'It signed in as mes-export-vm’s managed identity.' : 'It signed in with your new client secret.') : mon.detail, sp: mon.sp });
      out.push({ t: at(CH3 + 7, 7, 0), ok: mon.ok, title: 'Petra’s 07:00 meeting', text: mon.ok ? 'The dashboard was up to date.' : 'Petra: “The dashboard still shows Friday’s numbers. We ran the meeting from paper again.”' });
      return out;
    },
    solved: tn => runExport(clone(tn), MONDAY_RUN).ok,
    tidy(tn) {
      const out = [], x = xState(tn), r = tn.apps.reg['ar-mes'];
      if (r) r.secrets.filter(s => s.by === 'You' && s.life > 365).forEach(s => out.push('Your secret “' + s.desc + '” lasts ' + monthsOf(s.life) + ' months. Microsoft recommends less than 12.'));
      if (r && x.auth === 'mi') r.secrets.filter(s => s.exp > MONDAY_RUN).forEach(s => out.push('MES-Export still has a valid secret, “' + s.desc + '”, that nothing uses. Delete it.'));
      tn.apps.az['st-mes'].roles.filter(ra => ra.who === 'mi:vm-mesx' && !ra.orphan && !(AZ_ROLES[ra.role] || {}).data).forEach(ra => out.push('mes-export-vm’s identity has ' + ra.role + ', which it doesn’t need for writing data.'));
      return out;
    },
    good: 'Monday’s export ran, and the dashboard was ready for Petra’s meeting.',
    learned: ['appreg', 'sp', 'secret', 'mi', 'rbac', 'authz'],
    exam: ['q-7000222', 'q-mi', 'q-rbac403', 'q-secret-life', 'q-mi-system'],
    expert: 'A client secret is a password with a date on it, and nothing renews it for you. For code that runs in Azure, a managed identity removes the secret altogether. Getting a token and being allowed to write are separate decisions, though: the identity still needs a data role, like Storage Blob Data Contributor, on exactly the resource it writes to. Then retire the old secret so it can’t be misused.'
  },
  hints: {
    investigate: ['Open MES-Export’s Certificates & secrets. When does the secret expire?', 'Ask Noah what uses MES-Export, and look at the 02:00 service principal sign-ins.', 'A managed identity on the VM means no secret to renew. It still needs an Azure role on tallismesdata to write.'],
    fix: ['Turn on mes-export-vm’s system-assigned managed identity.', 'Give that identity Storage Blob Data Contributor on tallismesdata. Contributor isn’t enough for data.', 'Ask Noah to switch the script, then delete Dana’s old secret.'],
    verify: ['Run the export now, then as Monday 02:00 would.']
  }
});
