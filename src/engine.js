/* ================= engine: Tallis's directory and the access engines =================
   Pure functions over a tenant object (tn). No DOM, so tests can run it in Node.
   tn = { now, cfg: { locations, policies, methods }, reg, taps, keys, apps, audit } */

/* ----- utilities ----- */
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clone = o => JSON.parse(JSON.stringify(o));
const pad2 = n => String(n).padStart(2, '0');
const ascii = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '');
const uniq = a => a.filter((x, i) => a.indexOf(x) === i);
function hash32(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
const hash01 = s => (hash32(s) % 100000) / 100000;
function guidFrom(seed) {
  let out = '', h = hash32(seed);
  while (out.length < 32) { h = Math.imul(h ^ (h >>> 15), 2246822519) >>> 0; h = (h ^ (h >>> 13)) >>> 0; out += h.toString(16).padStart(8, '0'); }
  return out.slice(0, 8) + '-' + out.slice(8, 12) + '-' + out.slice(12, 16) + '-' + out.slice(16, 20) + '-' + out.slice(20, 32);
}
const plural = (n, one, many) => n + ' ' + (n === 1 ? one : (many || one + 's'));
function listText(items, max) {
  const m = max || 4;
  if (items.length > m) return items.slice(0, m).join(', ') + ' and ' + (items.length - m) + ' more';
  return items.length > 1 ? items.slice(0, -1).join(', ') + ' and ' + items[items.length - 1] : items.join('');
}

/* ----- story time: seconds since Friday 2 Oct 2026, 00:00 ----- */
const WD = ['Fri', 'Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu'];
const WDL = ['Friday', 'Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const at = (d, h, m, s) => ((d * 24 + h) * 60 + (m || 0)) * 60 + (s || 0);
const dayOf = t => Math.floor(t / 86400);
const wdi = d => ((d % 7) + 7) % 7;
const isWeekend = d => wdi(d) === 1 || wdi(d) === 2;
function dateOf(d) { const x = new Date(Date.UTC(2026, 9, 2 + d)); return x.getUTCDate() + ' ' + MONTHS[x.getUTCMonth()]; }
function fullDate(d) { const x = new Date(Date.UTC(2026, 9, 2 + d)); return x.getUTCDate() + ' ' + MONTHS[x.getUTCMonth()] + ' ' + x.getUTCFullYear(); }
function clk(t) {
  const d = Math.floor(t / 86400); let r = t - d * 86400;
  const h = Math.floor(r / 3600); r -= h * 3600;
  const m = Math.floor(r / 60), s = Math.floor(r - m * 60);
  return { d, wd: WD[wdi(d)], day: WD[wdi(d)] + ' ' + dateOf(d), dayLong: WDL[wdi(d)], date: dateOf(d), hm: pad2(h) + ':' + pad2(m), hms: pad2(h) + ':' + pad2(m) + ':' + pad2(s) };
}
const whenText = t => { const c = clk(t); return c.day + ', ' + c.hm; };
const longWhen = t => { const d = dayOf(t); return (d < -30 || d > 400 ? fullDate(d) : whenText(t).split(', ')[0]) + ', ' + clk(t).hm; };
function nextWorkday(d) { let n = d + 1; while (isWeekend(n)) n++; return n; }

/* ----- IPv4 ----- */
function ipToInt(ip) {
  const p = String(ip).trim().split('.');
  if (p.length !== 4) return null;
  let n = 0;
  for (const s of p) { if (!/^\d{1,3}$/.test(s)) return null; const v = +s; if (v > 255) return null; n = n * 256 + v; }
  return n;
}
const intToIp = n => [Math.floor(n / 16777216) % 256, Math.floor(n / 65536) % 256, Math.floor(n / 256) % 256, n % 256].join('.');
function parseCidr(str) {
  const m = /^\s*(\d{1,3}(?:\.\d{1,3}){3})\s*(?:\/\s*(\d{1,2}))?\s*$/.exec(String(str));
  if (!m) return null;
  const ip = ipToInt(m[1]);
  if (ip === null) return null;
  const mask = m[2] === undefined ? 32 : +m[2];
  if (mask > 32) return null;
  const size = Math.pow(2, 32 - mask);
  const net = Math.floor(ip / size) * size;
  return { net, mask, size, text: intToIp(net) + '/' + mask, aligned: net === ip, first: intToIp(net), last: intToIp(net + size - 1) };
}
const inRange = (n, r) => { const c = parseCidr(r); return !!c && n !== null && n >= c.net && n < c.net + c.size; };
const isPrivate = n => ['10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16', '127.0.0.0/8', '169.254.0.0/16', '100.64.0.0/10'].some(r => inRange(n, r));
const rangeSize = r => { const c = parseCidr(r); return c ? c.size : 0; };

/* ----- the directory ----- */
const DOMAIN = 'tallis.example';
const upnOf = name => ascii(name).toLowerCase().replace(/[^a-z\s-]/g, '').trim().replace(/\s+/g, '.') + '@' + DOMAIN;
const USERS = [], U = {};
function addUser(id, name, o) {
  const u = Object.assign({ id, name, upn: upnOf(name), dept: '', title: '', site: 'HQ', type: 'Member', enabled: true, m0: ['authenticator'], source: 'Synced from on-premises AD', devices: [], note: '', service: false, emergency: false }, o || {});
  USERS.push(u); U[id] = u; return u;
}
const FLOOR = ['Jan Novotný', 'Lukáš Horák', 'Eva Kučerová', 'Martin Veselý', 'Hana Procházková', 'Jiří Černý', 'Lenka Svobodová', 'Pavel Marek', 'Kateřina Pokorná', 'Michal Hájek', 'Lucie Králová', 'Ondřej Jelínek', 'Veronika Fialová', 'David Beneš', 'Zdeněk Kolář', 'Tereza Zemanová', 'Jakub Sedláček', 'Alena Němcová', 'Václav Růžička', 'Marie Pospíšilová', 'Josef Navrátil', 'Jana Kopecká'];
addUser('u-tomas', 'Tomáš Dvořák', { dept: 'Production', title: 'Shift supervisor', site: 'Brno', m0: [] });
FLOOR.forEach((n, i) => addUser('u-f' + (i + 1), n, { dept: 'Production', title: 'Machine operator', site: 'Brno', m0: [] }));
addUser('u-petra', 'Petra Nováková', { dept: 'Operations', title: 'Plant manager', site: 'Brno', devices: ['BRN-LT-014'] });
addUser('u-radek', 'Radek Šimek', { dept: 'Maintenance', title: 'Maintenance planner', site: 'Brno', devices: ['BRN-LT-021'] });
addUser('u-ivana', 'Ivana Malá', { dept: 'Quality', title: 'Quality engineer', site: 'Brno', devices: ['BRN-LT-030'] });
addUser('u-karel', 'Karel Doležal', { dept: 'Logistics', title: 'Logistics lead', site: 'Brno', devices: ['BRN-LT-031'] });
addUser('u-jordan', 'Jordan Reyes', { dept: 'Sales', title: 'Account manager', site: 'Travel', devices: ['HQ-LT-221'] });
addUser('u-sofia', 'Sofia Alvarez', { dept: 'Sales', title: 'Sales director', devices: ['HQ-LT-230'] });
addUser('u-grace', 'Grace Kim', { dept: 'Sales', title: 'Account manager', devices: ['HQ-LT-231'] });
addUser('u-tyler', 'Tyler Brandt', { dept: 'Sales', title: 'Inside sales', devices: ['HQ-LT-232'] });
addUser('u-diego', 'Diego Ramírez', { dept: 'Sales', title: 'Account manager', site: 'Monterrey', devices: ['MTY-LT-007'] });
addUser('u-maya', 'Maya Chen', { dept: 'Finance', title: 'Controller', devices: ['HQ-LT-118'] });
addUser('u-ben', 'Ben Walsh', { dept: 'Finance', title: 'Chief financial officer', devices: ['HQ-LT-101'] });
addUser('u-priya', 'Priya Natarajan', { dept: 'People', title: 'HR generalist', devices: ['HQ-LT-104'] });
addUser('u-marcus', 'Marcus Hill', { dept: 'IT', title: 'IT support technician', devices: ['HQ-LT-133'] });
addUser('u-aisha', 'Aisha Karimi', { dept: 'IT', title: 'Security analyst', devices: ['HQ-LT-140'] });
addUser('u-lena', 'Lena Brooks', { dept: 'Procurement', title: 'Buyer', devices: ['HQ-LT-150'], m0: [] });
addUser('u-noah', 'Noah Patel', { dept: 'Engineering', title: 'Process engineer', devices: ['HQ-LT-160'], m0: ['sms'] });
addUser('u-chris', 'Chris Doyle', { dept: 'Service', title: 'Field service technician', site: 'Remote' });
addUser('u-dana', 'Dana Whitfield', { dept: 'IT', title: 'Systems administrator', enabled: false, devices: ['HQ-LT-090'], note: 'Last day was Friday 2 Oct. Account disabled Friday at 18:30.' });
addUser('u-you', 'You', { upn: 'you@' + DOMAIN, dept: 'IT', title: 'Identity engineer (started Wed 30 Sep)', source: 'Cloud only', devices: ['HQ-LT-240'] });
addUser('u-bg1', 'Emergency access 01', { upn: 'bg-admin-01@tallis.onmicrosoft.com', title: 'Emergency access account', site: '—', m0: ['passkey'], source: 'Cloud only', emergency: true });
addUser('u-bg2', 'Emergency access 02', { upn: 'bg-admin-02@tallis.onmicrosoft.com', title: 'Emergency access account', site: '—', m0: ['passkey'], source: 'Cloud only', emergency: true });
addUser('u-copier', 'HQ scan copier', { upn: 'scan-copier@' + DOMAIN, dept: 'Facilities', title: 'Service account for scan to email', m0: [], source: 'Cloud only', service: true });
addUser('u-dieter', 'Dieter Meyer', { upn: 'dieter.meyer_kovo.example#EXT#@' + DOMAIN, type: 'Guest', dept: 'Kovo Systems', title: 'Supplier engineer', site: 'Guest', source: 'Invited guest' });
const floorIds = () => ['u-tomas'].concat(FLOOR.map((_, i) => 'u-f' + (i + 1)));
const fr = (a, b) => { const o = []; for (let i = a; i <= b; i++) o.push('u-f' + i); return o; };
const firstName = uid => uid === 'u-you' ? 'You' : U[uid].name.split(' ')[0];
const nameList = (uids, max) => listText(uids.map((u, i) => { const f = firstName(u); return f === 'You' && i > 0 ? 'you' : f; }), max);
const HQ_PEOPLE = ['u-maya', 'u-ben', 'u-priya', 'u-marcus', 'u-aisha', 'u-lena', 'u-noah'];
const BRNO_OFFICE = ['u-petra', 'u-radek', 'u-ivana', 'u-karel'];
const SALES = ['u-sofia', 'u-grace', 'u-tyler', 'u-jordan', 'u-diego'];

const GROUPS = [
  { id: 'g-floor', name: 'SG-Frontline-Brno', desc: 'Shop-floor staff at the Brno plant. They share kiosks by the lines, and phones stay in lockers on the floor.', members: floorIds(), source: 'Synced from on-premises AD' },
  { id: 'g-line1', name: 'SG-Frontline-Brno-Line1', desc: 'Line 1 operators.', members: fr(1, 8), source: 'Cloud only' },
  { id: 'g-line2', name: 'SG-Frontline-Brno-Line2', desc: 'Line 2 operators.', members: fr(9, 15), source: 'Cloud only' },
  { id: 'g-line3', name: 'SG-Frontline-Brno-Line3', desc: 'Line 3 operators, who also cover the weekend shift.', members: fr(16, 22), source: 'Cloud only' },
  { id: 'g-brno-office', name: 'SG-Brno-Office', desc: 'Office staff at the Brno plant.', members: BRNO_OFFICE.slice(), source: 'Synced from on-premises AD' },
  { id: 'g-emergency', name: 'SG-Emergency-Access', desc: 'The two break-glass accounts. Meant to be excluded from every Conditional Access policy.', members: ['u-bg1', 'u-bg2'], source: 'Cloud only' },
  { id: 'g-it', name: 'SG-IT', desc: 'IT staff.', members: ['u-marcus', 'u-aisha', 'u-dana', 'u-you'], source: 'Cloud only' },
  { id: 'g-sales', name: 'SG-Sales', desc: 'The sales team.', members: SALES.slice(), source: 'Synced from on-premises AD' }
];
const GMAP = {};
GROUPS.forEach(g => { GMAP[g.id] = g; });
const grp = id => GMAP[id] || null;
const memberOf = (uid, gid) => { const g = GMAP[gid]; return !!g && g.members.indexOf(uid) >= 0; };
const gName = id => { const g = GMAP[id]; return g ? g.name : '(deleted group)'; };
const onFloor = uid => memberOf(uid, 'g-floor');

/* Directory roles. `since` is story time: Marcus and Ben grant you roles as the weeks go on. */
const ROLES = {
  ga: { name: 'Global Administrator', members: ['u-bg1', 'u-bg2', 'u-dana'] },
  caa: { name: 'Conditional Access Administrator', members: ['u-you'] },
  secadmin: { name: 'Security Administrator', members: [] },
  helpdesk: { name: 'Helpdesk Administrator', members: ['u-marcus'] },
  authadmin: { name: 'Authentication Administrator', members: ['u-you'], since: { 'u-you': at(5, 17, 10) } },
  authpol: { name: 'Authentication Policy Administrator', members: ['u-you'], since: { 'u-you': at(5, 17, 10) } },
  privauth: { name: 'Privileged Authentication Administrator', members: [] },
  cloudapp: { name: 'Cloud Application Administrator', members: ['u-you'], since: { 'u-you': at(17, 8, 18) } },
  sr: { name: 'Security Reader', members: ['u-aisha'] }
};
const ADMIN_ROLES = ['ga', 'caa', 'secadmin', 'helpdesk', 'authadmin', 'authpol', 'privauth'];
function hasRole(uid, r, t) {
  const R = ROLES[r];
  if (!R || R.members.indexOf(uid) < 0) return false;
  const s = R.since && R.since[uid];
  return !(s && t < s);
}
const isAdmin = (uid, t) => ADMIN_ROLES.some(r => hasRole(uid, r, t));
const rolesOf = (uid, t) => Object.keys(ROLES).filter(r => hasRole(uid, r, t));

const APPS = { teams: 'Microsoft Teams', exo: 'Office 365 Exchange Online', spo: 'Office 365 SharePoint Online', mes: 'Tallis MES Dashboard', azure: 'Microsoft Azure Management', portals: 'Microsoft Admin Portals', fieldline: 'Fieldline CRM' };
const APP_SHORT = { teams: 'Teams', exo: 'Exchange', spo: 'SharePoint', mes: 'MES', azure: 'Azure', portals: 'Admin portals', fieldline: 'Fieldline' };
const APP_GROUPS = { office365: { name: 'Office 365', apps: ['teams', 'exo', 'spo'] } };
const expandApps = list => list === 'all' ? Object.keys(APPS) : [].concat(...list.map(a => APP_GROUPS[a] ? APP_GROUPS[a].apps : [a]));
const appLabel = a => APP_GROUPS[a] ? APP_GROUPS[a].name : (APPS[a] || a);
const CLIENTS = { browser: 'Browser', mobileDesktop: 'Mobile apps and desktop clients', eas: 'Exchange ActiveSync clients', other: 'Other clients' };
const isLegacy = c => c === 'eas' || c === 'other';
const COUNTRY = { US: 'United States', CZ: 'Czechia', MX: 'Mexico', RO: 'Romania', AT: 'Austria', '': 'Unknown' };

const DEVICES = {};
function addDev(id, o) { DEVICES[id] = Object.assign({ id, os: 'Windows 11', join: 'Microsoft Entra joined', compliant: true, managed: true, owner: '' }, o || {}); }
for (let i = 1; i <= 6; i++) addDev('BRN-KIOSK-0' + i, { join: 'Microsoft Entra hybrid joined', compliant: false, managed: false, owner: 'Shared kiosk, Brno floor' });
USERS.forEach(u => u.devices.forEach(d => addDev(d, { owner: u.name })));
const kiosk = i => 'BRN-KIOSK-0' + ((i % 6) + 1);

/* Where addresses are on the internet (documentation ranges, RFC 5737). */
const GEO = [
  ['192.0.2.0/27', 'Milwaukee, Wisconsin', 'US'],
  ['192.0.2.128/25', 'Chicago, Illinois', 'US'],
  ['198.51.100.0/27', 'Brno, South Moravia', 'CZ'],
  ['198.51.100.64/27', 'Prague', 'CZ'],
  ['198.51.100.160/27', 'Amsterdam (Azure West Europe)', 'NL'],
  ['198.51.100.224/27', 'Bucharest', 'RO'],
  ['203.0.113.64/28', 'Brno, South Moravia', 'CZ'],
  ['203.0.113.80/28', 'Brno, South Moravia', 'CZ'],
  ['203.0.113.128/27', 'Monterrey, Nuevo León', 'MX'],
  ['203.0.113.192/26', 'Brno, South Moravia', 'CZ']
];
COUNTRY.NL = 'Netherlands';
function geoOf(n) {
  if (n === null) return { city: 'Unknown', cc: '' };
  for (const g of GEO) if (inRange(n, g[0])) return { city: g[1], cc: g[2] };
  return { city: 'Unknown', cc: '' };
}

/* ----- the tenant on Monday morning ----- */
const METHODS = { passkey: 'Passkey (FIDO2)', authenticator: 'Microsoft Authenticator', sms: 'SMS', tap: 'Temporary Access Pass' };
const METHOD_KEYS = ['passkey', 'authenticator', 'sms', 'tap'];
const METHODS0 = {
  passkey: { state: 'on', include: ['g-emergency'], exclude: [], selfService: true },
  authenticator: { state: 'on', include: 'all', exclude: [] },
  sms: { state: 'on', include: 'all', exclude: [] },
  tap: { state: 'off', include: [], exclude: [], minMin: 60, maxMin: 480, defMin: 60, oneTime: false }
};
const CFG0 = {
  locations: [
    { id: 'loc-hq', name: 'Tallis HQ (Milwaukee)', type: 'ip', ranges: ['192.0.2.0/27'], trusted: true, created: '10 Feb 2023', by: 'Dana Whitfield' },
    { id: 'loc-brno', name: 'Brno plant', type: 'ip', ranges: ['198.51.100.0/27'], trusted: true, created: '21 May 2024', by: 'Dana Whitfield' },
    { id: 'loc-brno-new', name: 'Brno plant – new ISP', type: 'ip', ranges: ['203.0.113.64/28'], trusted: true, created: 'Fri 2 Oct, 17:42', by: 'Dana Whitfield' },
    { id: 'loc-countries', name: 'Countries we operate in', type: 'country', countries: ['US', 'CZ', 'MX'], unknown: false, created: '12 Jan 2025', by: 'Dana Whitfield' }
  ],
  policies: [
    { id: 'CA01', name: 'CA01 · Block legacy authentication', state: 'on', users: { include: { all: true }, exclude: { groups: ['g-emergency'] } }, resources: { include: 'all' }, network: null, clientApps: ['eas', 'other'], grant: { block: true }, modified: '10 Feb 2023' },
    { id: 'CA02', name: 'CA02 · Require MFA outside trusted networks', state: 'on', users: { include: { all: true }, exclude: { groups: ['g-emergency', 'g-floor'] } }, resources: { include: 'all' }, network: { include: 'any', exclude: 'trusted' }, clientApps: null, grant: { controls: ['mfa'], op: 'all' }, modified: '3 Jun 2024' },
    { id: 'CA03', name: 'CA03 · Require MFA for admin roles', state: 'on', users: { include: { roles: ['ga', 'secadmin', 'caa'] }, exclude: { groups: ['g-emergency'] } }, resources: { include: 'all' }, network: null, clientApps: null, grant: { controls: ['mfa'], op: 'all' }, modified: '10 Feb 2023' },
    { id: 'CA05', name: 'CA05 · Require MFA for guests', state: 'on', users: { include: { guests: true }, exclude: {} }, resources: { include: 'all' }, network: null, clientApps: null, grant: { controls: ['mfa'], op: 'all' }, modified: '10 Feb 2023' },
    { id: 'CA06', name: 'CA06 · Block countries we don’t operate in', state: 'on', users: { include: { all: true }, exclude: {} }, resources: { include: 'all' }, network: { include: 'any', exclude: ['loc-countries'] }, clientApps: null, grant: { block: true }, modified: '10 Sep 2026' },
    { id: 'CA07', name: 'CA07 · Frontline: block outside the plant network', state: 'on', users: { include: { groups: ['g-floor'] }, exclude: { groups: ['g-emergency'] } }, resources: { include: 'all' }, network: { include: 'any', exclude: ['loc-brno'] }, clientApps: null, grant: { block: true }, modified: '3 Jun 2024' },
    { id: 'CA08', name: 'CA08 · Require MFA for Azure management', state: 'on', users: { include: { all: true }, exclude: { groups: ['g-emergency'] } }, resources: { include: ['azure'] }, network: null, clientApps: null, grant: { controls: ['mfa'], op: 'all' }, modified: '10 Feb 2023' },
    { id: 'CA09', name: 'CA09 · TEST frontline MFA (Dana)', state: 'reportOnly', users: { include: { groups: ['g-floor'] }, exclude: {} }, resources: { include: ['office365'] }, network: null, clientApps: null, grant: { controls: ['mfa'], op: 'all' }, modified: '14 Aug 2026' },
    { id: 'CA10', name: 'CA10 · OLD MFA for everyone', state: 'off', users: { include: { all: true }, exclude: {} }, resources: { include: 'all' }, network: null, clientApps: null, grant: { controls: ['mfa'], op: 'all' }, modified: '9 Nov 2023' }
  ],
  methods: METHODS0
};

/* ----- Conditional Access ----- */
const CTRL = {
  mfa: 'Require multifactor authentication',
  'str:mfa': 'Require authentication strength: Multifactor authentication',
  'str:phish': 'Require authentication strength: Phishing-resistant MFA',
  compliant: 'Require device to be marked as compliant',
  hybrid: 'Require Microsoft Entra hybrid joined device'
};
const isMfaCtl = c => c === 'mfa' || c === 'str:mfa' || c === 'str:phish';
const isDevCtl = c => c === 'compliant' || c === 'hybrid';
const STATE = { on: 'On', reportOnly: 'Report-only', off: 'Off' };
const locById = (id, cfg) => cfg.locations.find(l => l.id === id);
const locName = (id, cfg) => { const l = locById(id, cfg); return l ? l.name : '(deleted location)'; };
const grantText = p => p.grant.block ? 'Block access' : p.grant.controls.map(c => CTRL[c]).join(p.grant.op === 'one' ? ' or ' : ' and ');
const policyById = (id, cfg) => cfg.policies.find(p => p.id === id);

function netOf(ip, cfg) {
  const n = ipToInt(ip);
  const geo = geoOf(n);
  const matched = [];
  let trusted = false;
  if (n !== null) cfg.locations.forEach(L => {
    if (L.type === 'ip') { if (L.ranges.some(r => inRange(n, r))) { matched.push(L.id); if (L.trusted) trusted = true; } }
    else if (L.type === 'country') { if (L.countries.indexOf(geo.cc) >= 0 || (L.unknown && geo.cc === '')) matched.push(L.id); }
  });
  return { ip, n, geo, matched, trusted };
}
function usersWhy(p, u, t) {
  const inc = p.users.include || {}, ex = p.users.exclude || {};
  const inScope = !!inc.all || (!!inc.guests && u.type === 'Guest') || (inc.users || []).indexOf(u.id) >= 0 || (inc.groups || []).some(g => memberOf(u.id, g)) || (inc.roles || []).some(r => hasRole(u.id, r, t));
  if (!inScope) return 'Users: this user isn’t included.';
  if ((ex.users || []).indexOf(u.id) >= 0) return 'Users: this user is excluded.';
  const g = (ex.groups || []).find(x => memberOf(u.id, x));
  if (g) return 'Users: excluded as a member of ' + gName(g) + '.';
  const r = (ex.roles || []).find(x => hasRole(u.id, x, t));
  if (r) return 'Users: excluded by role (' + ROLES[r].name + ').';
  if (ex.guests && u.type === 'Guest') return 'Users: guests are excluded.';
  return null;
}
function appWhy(p, app) {
  const inc = p.resources.include;
  if (!(inc === 'all' || expandApps(inc).indexOf(app) >= 0)) return 'Target resources: ' + (APPS[app] || app) + ' isn’t included.';
  if (p.resources.exclude && expandApps(p.resources.exclude).indexOf(app) >= 0) return 'Target resources: ' + APPS[app] + ' is excluded.';
  return null;
}
function netWhy(p, net, cfg) {
  const N = p.network;
  if (!N) return null;
  const inc = N.include;
  const incOk = inc === 'any' || (inc === 'trusted' && net.trusted) || (Array.isArray(inc) && inc.some(id => net.matched.indexOf(id) >= 0));
  if (!incOk) return inc === 'trusted' ? 'Network: the sign-in didn’t come from a trusted location.' : 'Network: the sign-in didn’t come from an included location.';
  if (N.exclude === 'trusted' && net.trusted) {
    const names = net.matched.filter(id => { const l = locById(id, cfg); return l && l.trusted; }).map(id => locName(id, cfg));
    return 'Network: excluded, because ' + net.ip + ' is in a trusted location (' + names.join(', ') + ').';
  }
  if (Array.isArray(N.exclude)) {
    const hit = N.exclude.filter(id => net.matched.indexOf(id) >= 0);
    if (hit.length) return 'Network: excluded, because ' + net.ip + ' is in ' + hit.map(id => locName(id, cfg)).join(', ') + '.';
  }
  return null;
}
function clientWhy(p, client) {
  if (!p.clientApps || !p.clientApps.length) return null;
  return p.clientApps.indexOf(client) >= 0 ? null : 'Client apps: ' + CLIENTS[client] + ' isn’t included.';
}
const whyNot = (p, u, att, net, cfg) => usersWhy(p, u, att.t) || appWhy(p, att.app) || netWhy(p, net, cfg) || clientWhy(p, att.client || 'browser');

/* ----- authentication methods ----- */
function methodOn(m, uid, cfg) {
  const M = cfg.methods;
  if (!M || !M[m]) return m !== 'tap';
  const p = M[m];
  if (p.state !== 'on') return false;
  const inc = p.include === 'all' || (p.include || []).some(g => memberOf(uid, g));
  return inc && !(p.exclude || []).some(g => memberOf(uid, g));
}
const regOf = (tn, uid) => (tn.reg && tn.reg[uid]) || U[uid].m0;
const tapOf = (tn, uid) => (tn.taps && tn.taps[uid]) || null;
function tapState(tn, uid, t) {
  const p = tapOf(tn, uid);
  if (!p) return 'none';
  if (p.oneTime && p.used) return 'used';
  if (t < p.start) return 'notyet';
  if (t >= p.end) return 'expired';
  if (!methodOn('tap', uid, tn.cfg)) return 'disabled';
  return 'valid';
}
const capable = (tn, uid) => regOf(tn, uid).some(m => m !== 'tap' && methodOn(m, uid, tn.cfg));
const hasKey = (tn, uid) => regOf(tn, uid).indexOf('passkey') >= 0;
/* What a person can use at this sign-in. Phones stay in lockers on the floor, so a kiosk needs a security key. */
function usableAt(tn, uid, att) {
  const cfg = tn.cfg, phone = !att.atKiosk, reg = regOf(tn, uid), out = [];
  const keyInHand = phone || !!(tn.keys && tn.keys[uid]) || U[uid].emergency;
  if (reg.indexOf('passkey') >= 0 && methodOn('passkey', uid, cfg) && !att.noKey && keyInHand) out.push('passkey');
  if (reg.indexOf('authenticator') >= 0 && methodOn('authenticator', uid, cfg) && phone) out.push('authenticator');
  if (reg.indexOf('sms') >= 0 && methodOn('sms', uid, cfg) && phone) out.push('sms');
  if (tapState(tn, uid, att.t === undefined ? tn.now : att.t) === 'valid') out.push('tap');
  return out;
}
function grantOutcome(p, ctx) {
  if (p.grant.block) return { ok: false, block: true, missing: [], used: null };
  const c = p.grant.controls, op = p.grant.op || 'all';
  const sat = x => (x === 'mfa' || x === 'str:mfa') ? ctx.mfa : x === 'str:phish' ? ctx.phish : x === 'compliant' ? ctx.compliant : x === 'hybrid' ? ctx.hybrid : false;
  const ok = op === 'all' ? c.every(sat) : c.some(sat);
  let used = null;
  if (ok) {
    if (op === 'one' && c.some(x => isDevCtl(x) && sat(x))) used = 'device';
    else if (c.indexOf('str:phish') >= 0 && (op === 'all' || !c.some(x => x !== 'str:phish' && sat(x)))) used = 'phish';
    else if (c.some(isMfaCtl)) used = 'mfa';
    else used = 'device';
  }
  return { ok, block: false, missing: c.filter(x => !sat(x)), used };
}

/* One interactive sign-in, evaluated against the tenant's configuration. */
function evalSignIn(tn, att) {
  const cfg = tn.cfg;
  const u = U[att.user];
  const t = att.t === undefined ? tn.now : att.t;
  const net = netOf(att.ip, cfg);
  const dev = att.devObj || (att.device ? DEVICES[att.device] : null);
  const id = att.id || ('si-' + hash32(JSON.stringify(att) + '|' + t + '|' + (tn.seq || 0)).toString(36));
  const e = {
    id, t, user: u.id, app: att.app, ip: att.ip, city: net.geo.city, cc: net.geo.cc,
    client: att.client || 'browser', device: dev ? (dev.id || 'Registered device') : null, devJoin: dev ? dev.join : '', devCompliant: !!(dev && dev.compliant), devManaged: !!(dev && dev.managed),
    os: att.os || (dev ? dev.os : 'Unknown'), browser: att.browser || '', matched: net.matched.slice(), trusted: net.trusted, atKiosk: !!att.atKiosk,
    status: 'Success', code: 0, reason: '', authReq: 'Single-factor authentication', steps: [['Password', 'Success']],
    ca: [], ro: [], caStatus: 'Not applied', tag: att.tag || '', corr: guidFrom(id + ':corr'), req: guidFrom(id + ':req'), need: null, usedMethod: null
  };
  const enabled = att.enabled !== undefined ? att.enabled : u.enabled && !(tn.disabled && tn.disabled[u.id]);
  if (!enabled) { e.status = 'Failure'; e.code = 50057; e.reason = 'The user account is disabled.'; e.steps = [['Password', 'Failure']]; return e; }
  /* oldPassword: someone uses a password that was reset since. */
  if (att.badPassword || (att.oldPassword && tn.pwReset && tn.pwReset[u.id])) { e.status = 'Failure'; e.code = 50126; e.reason = 'Error validating credentials due to invalid username or password.'; e.steps = [['Password', 'Failure']]; return e; }
  const legacy = isLegacy(e.client);
  const A = Object.assign({}, att, { t });
  const usable = legacy ? [] : usableAt(tn, u.id, A);
  const ctx = { mfa: usable.length > 0, phish: usable.indexOf('passkey') >= 0, compliant: !!(dev && dev.compliant), hybrid: !!(dev && /hybrid/i.test(dev.join || '')) };
  const evals = cfg.policies.map(p => ({ p, why: p.state === 'off' ? null : whyNot(p, u, A, net, cfg) }));
  const onApplying = evals.filter(x => x.p.state === 'on' && !x.why);
  const blockers = onApplying.filter(x => x.p.grant.block);
  const done = { mfa: false, phish: false };
  if (blockers.length) {
    e.status = 'Failure'; e.code = 53003;
    e.reason = 'Access has been blocked by Conditional Access policies. The access policy does not allow token issuance.';
  } else {
    const outs = onApplying.map(x => grantOutcome(x.p, ctx));
    const failing = outs.filter(o => !o.ok);
    if (failing.length) {
      let need = null, devNeed = null;
      failing.forEach(o => {
        const mf = o.missing.filter(isMfaCtl);
        if (mf.length) { if (mf.every(x => x === 'str:phish')) need = 'phish'; else if (need !== 'phish') need = 'mfa'; }
        else devNeed = devNeed || (o.missing.indexOf('compliant') >= 0 ? 'compliant' : 'hybrid');
      });
      if (need && legacy) {
        e.status = 'Failure'; e.code = 50076; e.reason = 'This client can’t do multifactor authentication, and a Conditional Access policy requires it.';
      } else if (need) {
        e.status = 'Interrupted'; e.code = 50079; e.need = need; e.authReq = 'Multifactor authentication';
        e.reason = need === 'phish' ? 'The user must sign in with a phishing-resistant method, such as a passkey, and has none they can use.' : 'The user must register security info to complete multifactor authentication.';
        e.steps.push([need === 'phish' ? 'Register a passkey' : 'Register security info', 'Interrupted']);
      } else if (devNeed === 'compliant') {
        e.status = 'Failure'; e.code = 53000; e.reason = 'Conditional Access policy requires a compliant device, and the device isn’t compliant.';
      } else {
        e.status = 'Failure'; e.code = 53001; e.reason = 'Conditional Access policy requires a domain joined device, and the device isn’t domain joined.';
      }
    } else {
      const mf = outs.filter(o => o.used === 'mfa' || o.used === 'phish');
      if (mf.length) {
        const m = mf.some(o => o.used === 'phish') ? 'passkey' : usable[0];
        done.mfa = true; done.phish = m === 'passkey';
        e.authReq = 'Multifactor authentication'; e.steps.push([METHODS[m], 'Success']); e.usedMethod = m;
      } else if (outs.some(o => o.used === 'device')) e.viaDevice = true;
    }
  }
  evals.forEach(x => {
    const p = x.p;
    const row = (result, why) => ({ pid: p.id, name: p.name, result, why });
    if (p.state === 'off') { e.ca.push(row('Disabled', 'The policy was off at the time of this sign-in.')); return; }
    if (p.state === 'reportOnly') {
      let r, why = x.why;
      if (x.why) r = 'Report-only: Not applied';
      else if (p.grant.block) { r = 'Report-only: Failure'; why = 'Would have blocked access.'; }
      else {
        const o = grantOutcome(p, { mfa: done.mfa, phish: done.phish, compliant: ctx.compliant, hybrid: ctx.hybrid });
        if (o.ok) { r = 'Report-only: Success'; why = 'Its requirements were already met in this sign-in.'; }
        else if (p.grant.controls.some(isMfaCtl) && !legacy) { r = 'Report-only: User action required'; why = 'Would have required ' + (p.grant.controls.indexOf('str:phish') >= 0 ? 'phishing-resistant MFA' : 'multifactor authentication') + '.' + (regOf(tn, u.id).length || usable.length ? '' : ' This user has no MFA method registered.'); }
        else { r = 'Report-only: Failure'; why = 'Would have failed: ' + o.missing.map(m => CTRL[m]).join(', ') + '.'; }
      }
      e.ro.push(row(r, why));
      return;
    }
    if (x.why) { e.ca.push(row('Not applied', x.why)); return; }
    if (p.grant.block) { e.ca.push(row('Failure', 'Applied. Grant control: Block access.')); return; }
    if (blockers.length) { e.ca.push(row('Failure', 'Applied, but the sign-in was blocked by ' + blockers.map(b => b.p.id).join(', ') + '.')); return; }
    const o = grantOutcome(p, ctx);
    e.ca.push(row(o.ok ? 'Success' : 'Failure', o.ok ? 'Applied and satisfied' + (o.used === 'device' ? ' by the device' : '') + ': ' + grantText(p) + '.' : 'Applied, not satisfied: ' + o.missing.map(m => CTRL[m]).join(p.grant.op === 'one' ? ' or ' : ', ') + '.'));
  });
  e.caStatus = e.ca.some(r => r.result === 'Failure') ? 'Failure' : e.ca.some(r => r.result === 'Success') ? 'Success' : 'Not applied';
  return e;
}
const passed = e => e.status === 'Success';
const usedMfa = e => e.status === 'Success' && e.authReq.indexOf('Multi') === 0;
const blockerOf = e => e.ca.find(r => r.result === 'Failure' && /Block access/.test(r.why));
/* A short verdict: blocked, MFA, in (password only), stuck. */
const verdictOf = e => passed(e) ? (usedMfa(e) ? 'mfa' : 'in') : e.status === 'Interrupted' ? 'stuck' : 'blocked';

/* Registration during a sign-in interrupt. Office staff can register on their phones; the floor can't at a kiosk. */
function tryRegister(tn, att, need, dry) {
  const uid = att.user, cfg = tn.cfg, u = U[uid];
  const phone = !att.atKiosk;
  if (u.type === 'Guest' || u.service) return null;
  const reg = regOf(tn, uid).slice();
  let got = null;
  if (need === 'phish') {
    if (!methodOn('passkey', uid, cfg) || !(cfg.methods.passkey && cfg.methods.passkey.selfService)) return null;
    if (!usableAt(tn, uid, att).length) return null;
    if (!phone && !(tn.keys && tn.keys[uid])) return null;
    got = 'passkey';
  } else {
    if (!phone) return null;
    if (methodOn('authenticator', uid, cfg)) got = 'authenticator';
    else if (methodOn('sms', uid, cfg)) got = 'sms';
    else return null;
  }
  if (!dry) { if (reg.indexOf(got) < 0) reg.push(got); tn.reg = tn.reg || {}; tn.reg[uid] = reg; }
  return got;
}
function useTap(tn, e) { if (e.usedMethod === 'tap') { const p = tn.taps && tn.taps[e.user]; if (p && p.oneTime) p.used = true; } }
/* A real attempt: an interrupt lets people register if they can, then they try again. */
function signIn(tn, att) {
  const e = evalSignIn(tn, att);
  useTap(tn, e);
  if (e.status === 'Interrupted') {
    const got = tryRegister(tn, att, e.need, false);
    if (got) {
      const e2 = evalSignIn(tn, Object.assign({}, att, { t: (att.t === undefined ? tn.now : att.t) + 75, id: att.id ? att.id + 'r' : undefined, tag: (att.tag || '') + '-registered' }));
      useTap(tn, e2);
      return { first: e, final: e2, registered: got };
    }
  }
  return { first: e, final: e, registered: null };
}

function whatIf(tn, q) {
  const cfg = tn.cfg, u = U[q.user], t = q.t === undefined ? tn.now : q.t;
  const net = netOf(q.ip, cfg);
  const att = { user: q.user, app: q.app, ip: q.ip, client: q.client, t };
  const apply = [], notApply = [];
  cfg.policies.forEach(p => { if (p.state === 'off') return; const why = whyNot(p, u, att, net, cfg); (why ? notApply : apply).push({ p, why }); });
  const devObj = q.dev === 'compliant' ? { id: 'What If device', os: q.platform || 'Windows', join: 'Microsoft Entra joined', compliant: true, managed: true }
    : q.dev === 'kiosk' ? { id: 'What If device', os: 'Windows', join: 'Microsoft Entra hybrid joined', compliant: false, managed: false }
    : q.dev === 'noncompliant' ? { id: 'What If device', os: q.platform || 'Windows', join: 'Microsoft Entra registered', compliant: false, managed: false } : null;
  const sim = evalSignIn(tn, { id: 'whatif', user: q.user, app: q.app, ip: q.ip, client: q.client, devObj, os: q.platform, t, atKiosk: q.dev === 'kiosk' });
  return { net, apply, notApply, sim, usable: isLegacy(q.client) ? [] : usableAt(tn, q.user, { t, atKiosk: q.dev === 'kiosk' }) };
}

/* ----- Brno: is the plant where CA07 thinks it is? ----- */
const PROBE = {
  p84: { user: 'u-f3', app: 'teams', ip: '203.0.113.84', client: 'browser', device: 'BRN-KIOSK-02', browser: 'Edge 141', atKiosk: true },
  p85: { user: 'u-f4', app: 'mes', ip: '203.0.113.85', client: 'browser', device: 'BRN-KIOSK-03', browser: 'Edge 141', atKiosk: true },
  p86: { user: 'u-f5', app: 'mes', ip: '203.0.113.86', client: 'browser', device: 'BRN-KIOSK-04', browser: 'Edge 141', atKiosk: true },
  jordan: { user: 'u-jordan', app: 'exo', ip: '198.51.100.23', client: 'mobileDesktop', device: 'HQ-LT-221', browser: 'Outlook desktop' },
  radek: { user: 'u-radek', app: 'teams', ip: '203.0.113.70', client: 'mobileDesktop', device: 'BRN-LT-021', browser: 'Teams desktop' },
  home: { user: 'u-f2', app: 'teams', ip: '203.0.113.200', client: 'mobileDesktop', device: null, os: 'Android 15', browser: 'Teams mobile' }
};
function brnoFacets(tn) {
  const blocked = att => evalSignIn(tn, Object.assign({ t: tn.now }, att)).code === 53003;
  const a = !blocked(PROBE.p84), b = !blocked(PROBE.p85);
  return {
    plant: a && b ? 'ok' : a || b ? 'partial' : 'blocked',
    pool: !blocked(PROBE.p86),
    homeBlocked: blocked(PROBE.home),
    oldTrusted: netOf('198.51.100.23', tn.cfg).trusted,
    typoTrusted: netOf('203.0.113.70', tn.cfg).trusted
  };
}
const brnoOk = f => f.plant === 'ok' && f.pool && f.homeBlocked && !f.oldTrusted && !f.typoTrusted;

/* ----- the insurer's three requirements ----- */
function legacyStatus(cfg) {
  const cands = cfg.policies.filter(p => p.grant.block && p.clientApps && p.clientApps.indexOf('eas') >= 0 && p.clientApps.indexOf('other') >= 0);
  const on = cands.filter(p => p.state === 'on');
  if (!on.length) return { ok: false, why: cands.length ? cands.map(p => p.id).join(', ') + (cands.length > 1 ? ' aren’t' : ' isn’t') + ' on, so nothing blocks legacy authentication.' : 'No policy blocks legacy authentication.' };
  const reasons = [];
  for (const p of on) {
    const inc = p.users.include || {}, ex = p.users.exclude || {};
    const exU = (ex.users || []).filter(id => !U[id].emergency);
    const exG = (ex.groups || []).filter(g => g !== 'g-emergency');
    let why = null;
    if (!inc.all) why = p.id + ' doesn’t apply to all users.';
    else if (exU.length || exG.length || (ex.roles || []).length) why = p.id + ' excludes ' + exU.map(id => U[id].name === 'You' ? 'you' : U[id].name).concat(exG.map(gName)).concat((ex.roles || []).map(r => ROLES[r].name)).join(', ') + ', so legacy sign-ins still work for them.';
    else if (p.resources.include !== 'all') why = p.id + ' doesn’t cover all resources.';
    else if (p.network && !(p.network.include === 'any' && !p.network.exclude)) {
      const N = p.network;
      const where = N.exclude === 'trusted' ? 'every trusted location' : Array.isArray(N.exclude) && N.exclude.length ? N.exclude.map(id => locName(id, cfg)).join(', ') : 'outside its included locations';
      why = p.id + ' lets legacy sign-ins through from ' + where + '.';
    }
    if (!why) return { ok: true, pid: p.id };
    reasons.push(why);
  }
  return { ok: false, why: reasons[0] };
}
function coveragePaths(u) {
  const floor = onFloor(u.id), office = memberOf(u.id, 'g-brno-office');
  const usual = floor ? { ip: '203.0.113.84', device: 'BRN-KIOSK-01', atKiosk: true, client: 'browser', app: 'teams', shared: true }
    : office ? { ip: '203.0.113.84', device: u.devices[0] || null, client: 'mobileDesktop', app: 'exo' }
    : u.type === 'Guest' ? { ip: '203.0.113.71', device: null, client: 'browser', app: 'teams' }
    : { ip: '192.0.2.12', device: u.devices[0] || null, client: 'mobileDesktop', app: 'exo' };
  const internet = { ip: floor || office ? '203.0.113.201' : '192.0.2.151', device: null, client: 'browser', app: 'exo' };
  return [usual, internet];
}
function pathKind(tn, u, a, t) {
  const cfg = tn.cfg;
  const att = Object.assign({ user: u.id, t }, a);
  const net = netOf(a.ip, cfg);
  const dev = a.device ? DEVICES[a.device] : null;
  const hasDev = x => (x === 'compliant' && dev && dev.compliant) || (x === 'hybrid' && dev && /hybrid/i.test(dev.join || ''));
  const applying = cfg.policies.filter(p => p.state === 'on' && !whyNot(p, u, att, net, cfg));
  if (applying.some(p => p.grant.block)) return { kind: 'blocked' };
  let strict = null, orMfa = null, orDev = null;
  applying.forEach(p => {
    const c = p.grant.controls, op = p.grant.op || 'all';
    if (!c.some(isMfaCtl)) return;
    if (op === 'all' || c.every(isMfaCtl)) strict = strict || p;
    else if (c.some(hasDev)) orDev = orDev || p;
    else orMfa = orMfa || p;
  });
  if (strict || orMfa) return { kind: 'mfa', p: strict || orMfa };
  if (orDev) return { kind: 'exception', p: orDev };
  return { kind: 'none' };
}
function coverageOf(tn, uid, t) {
  const u = U[uid];
  const rank = { none: 3, exception: 2, mfa: 1, blocked: 1 };
  let worst = { kind: 'mfa' };
  coveragePaths(u).forEach((a, i) => {
    const k = pathKind(tn, u, a, t);
    if (rank[k.kind] > rank[worst.kind]) worst = Object.assign({}, k, { path: i === 0 ? 'usual' : 'internet', shared: !!a.shared });
  });
  if (worst.kind === 'none') worst.why = worst.path === 'usual' ? 'no policy requires MFA where they usually work' : 'no policy requires MFA when they sign in from the internet';
  if (worst.kind === 'exception') worst.why = (worst.shared ? 'kiosk sign-ins' : 'their laptop sign-ins') + ' can skip MFA through ' + worst.p.id + '’s device option';
  return worst;
}
const peopleInScope = () => USERS.filter(u => u.enabled && !u.service && !u.emergency);
function adminStatus(tn, t) {
  const cfg = tn.cfg;
  const admins = USERS.filter(u => u.enabled && !u.emergency && isAdmin(u.id, t));
  const rows = admins.map(u => {
    const att = { user: u.id, app: 'portals', ip: '192.0.2.12', client: 'browser', device: u.devices[0] || null, t };
    const net = netOf(att.ip, cfg);
    const pol = cfg.policies.find(p => p.state === 'on' && !p.grant.block && p.grant.controls.indexOf('str:phish') >= 0 && ((p.grant.op || 'all') === 'all' || p.grant.controls.every(x => x === 'str:phish')) && p.resources.include === 'all' && !whyNot(p, u, att, net, cfg));
    return { uid: u.id, covered: !!pol, pid: pol ? pol.id : null, ready: regOf(tn, u.id).indexOf('passkey') >= 0 && methodOn('passkey', u.id, cfg) };
  });
  return { ok: rows.length > 0 && rows.every(r => r.covered), rows };
}
function evaluateRequirements(tn, t) {
  const people = peopleInScope();
  const r1 = { none: [], exceptions: [], total: people.length };
  people.forEach(u => {
    const c = coverageOf(tn, u.id, t);
    if (c.kind === 'none') r1.none.push({ uid: u.id, why: c.why });
    else if (c.kind === 'exception') r1.exceptions.push({ uid: u.id, why: c.why, shared: c.shared, pid: c.p.id });
  });
  r1.badEx = r1.exceptions.filter(x => !x.shared);
  r1.ok = !r1.none.length && !r1.badEx.length;
  return { r1, r2: legacyStatus(tn.cfg), r3: adminStatus(tn, t) };
}
/* Who couldn't sign in at their next usual sign-in, if it happened with the tenant as it is now. */
function lockRisk(tn, t) {
  const d = nextWorkday(dayOf(t));
  const out = { count: 0, floor: 0, you: false, who: [], why: {} };
  USERS.filter(u => u.enabled && !u.service && !u.emergency && u.type !== 'Guest').forEach(u => {
    const a = coveragePaths(u)[0];
    const tt = onFloor(u.id) ? at(d, 6, 0, 30) : at(d, 8, 30, 0);
    const att = Object.assign({ user: u.id, t: tt, browser: 'Edge 141' }, a, u.id === 'u-you' ? { app: 'portals' } : {});
    const e = evalSignIn(tn, att);
    let stuck = !passed(e);
    if (e.status === 'Interrupted' && tryRegister(tn, att, e.need, true)) stuck = false;
    if (stuck) {
      out.count++; out.who.push(u.id); if (onFloor(u.id)) out.floor++; if (u.id === 'u-you') out.you = true;
      const b = blockerOf(e);
      out.why[u.id] = b ? b.pid + ' would block them.' : e.need === 'phish' ? 'A policy would require a passkey they can’t use or register there.' : e.code === 50079 ? 'A policy would require MFA, and they have no method they can use' + (onFloor(u.id) ? ' at a kiosk.' : '.') : e.reason;
    }
  });
  return out;
}

/* ----- floor batches, passes and key registration ----- */
function floorBatch(tn, t0, uids, o) {
  const res = { n: uids.length, ok: 0, tap: 0, key: 0, device: 0, plain: 0, blocked: 0, stuck: 0, blockers: {}, sample: null, okSample: null, badIds: [], okIds: [], entries: [] };
  uids.forEach((uid, i) => {
    const noKey = !!(o.forgot && o.forgot === uid && regOf(tn, uid).indexOf('passkey') >= 0);
    const att = { id: o.idp ? o.idp + i : undefined, t: t0 + i * 23, user: uid, app: i % 3 === 0 ? 'mes' : 'teams', ip: o.ip || (i % 2 ? '203.0.113.85' : '203.0.113.84'), client: 'browser', device: kiosk(i), browser: 'Edge 141', atKiosk: true, noKey, tag: o.tag || 'shift' };
    const e = signIn(tn, att).final;
    res.entries.push(e);
    if (passed(e)) { res.ok++; res.okIds.push(uid); if (e.usedMethod === 'tap') res.tap++; else if (e.usedMethod === 'passkey') res.key++; else if (e.viaDevice) res.device++; else res.plain++; res.okSample = res.okSample || e; }
    else if (e.code === 53003) { res.blocked++; res.badIds.push(uid); const b = blockerOf(e); if (b) res.blockers[b.pid] = (res.blockers[b.pid] || 0) + 1; res.sample = res.sample || e; }
    else { res.stuck++; res.badIds.push(uid); res.sample = res.sample || e; }
  });
  return res;
}
function floorSummary(res) {
  if (!res.n) return 'Nobody was scheduled.';
  if (res.ok === res.n) {
    const how = [];
    if (res.key) how.push(res.key + ' with security keys');
    if (res.tap) how.push(res.tap + ' with Temporary Access Passes');
    if (res.device) how.push(res.device + ' through the kiosk device option');
    return 'All ' + res.n + ' signed in' + (how.length ? ': ' + how.join(', ') : '') + '.';
  }
  const parts = [];
  if (res.blocked) parts.push(res.blocked + ' blocked by ' + Object.keys(res.blockers).join(' and '));
  if (res.stuck) parts.push(res.stuck + ' stuck at an MFA prompt with no phone or key to answer it');
  return (res.ok ? res.ok + ' of ' + res.n + ' got in. ' : 'None of the ' + res.n + ' got in. ') + parts.join('; ') + '.';
}
const LIFETIMES = [[60, '1 hour'], [240, '4 hours'], [480, '8 hours'], [1440, '1 day'], [10080, '7 days'], [43200, '30 days']];
const lifeLabel = m => { const x = LIFETIMES.find(l => l[0] === m); return x ? x[1] : m + ' minutes'; };
/* Passes for a group or a person. Admins need a Privileged Authentication Administrator, and nobody makes their own. */
function createTaps(tn, uids, o) {
  const made = [], skipped = [];
  uids.forEach(uid => {
    const u = U[uid];
    if (uid === 'u-you' || isAdmin(uid, tn.now) || u.emergency || !u.enabled || u.type === 'Guest' || u.service) { skipped.push(uid); return; }
    tn.taps = tn.taps || {};
    tn.taps[uid] = { start: o.start, end: o.start + o.life * 60, oneTime: !!o.oneTime, used: false };
    made.push(uid);
  });
  return { made, skipped };
}
const TAP_WHY = { none: 'had no Temporary Access Pass', notyet: 'had a pass that wasn’t valid yet', expired: 'had a pass that had already expired', used: 'had a one-time pass that was already used', disabled: 'had a pass, but Temporary Access Pass sign-in isn’t enabled for them' };
/* Tomáš runs a key registration session at shift start: each person signs in once at a kiosk, then registers a key. */
function runSession(tn, uids, t, keysAvailable) {
  const cfg = tn.cfg;
  const res = { reg: [], already: [], noKey: [], disabled: [], tap: {}, lines: [] };
  let keys = keysAvailable;
  uids.forEach(uid => {
    if (regOf(tn, uid).indexOf('passkey') >= 0) { res.already.push(uid); return; }
    if (keys <= 0) { res.noKey.push(uid); return; }
    if (!methodOn('passkey', uid, cfg) || !cfg.methods.passkey.selfService) { res.disabled.push(uid); return; }
    if (!usableAt(tn, uid, { t, atKiosk: true }).length) { const st = tapState(tn, uid, t); (res.tap[st] = res.tap[st] || []).push(uid); return; }
    tn.reg = tn.reg || {}; tn.keys = tn.keys || {};
    tn.reg[uid] = regOf(tn, uid).concat(['passkey']);
    tn.keys[uid] = true; keys--;
    const tp = tn.taps && tn.taps[uid]; if (tp && tp.oneTime && tapState(tn, uid, t) === 'valid') tp.used = true;
    res.reg.push(uid);
  });
  const L = res.lines;
  L.push(res.reg.length + ' of ' + uids.length + ' registered a security key.');
  if (res.already.length) L.push(nameList(res.already) + (res.already.length > 1 ? ' already had keys.' : ' already had one.'));
  if (res.noKey.length) L.push('We ran out of keys for ' + nameList(res.noKey) + '.');
  if (res.disabled.length) L.push('The sign-in page said security keys aren’t enabled for ' + (res.disabled.length === uids.length ? 'any of us' : nameList(res.disabled)) + '.');
  Object.keys(res.tap).forEach(k => L.push(nameList(res.tap[k]) + ' ' + TAP_WHY[k] + ', so they couldn’t sign in to register.'));
  return res;
}

/* ----- apps and workload identities ----- */
const FL = { ent: 'ea-fieldline', reg: 'ar-fieldline', name: 'Fieldline CRM', publisher: 'Fieldline, Inc.', entity: 'https://tallis.fieldlinecrm.com/saml/metadata', acs: 'https://tallis.fieldlinecrm.com/saml/acs', login: 'https://tallis.fieldlinecrm.com/login', seats: 8, vendor: 'Sam Ortiz, Fieldline' };
const FL_URLS = [[FL.entity, 'Entity ID'], [FL.acs, 'ACS URL'], [FL.login, 'Login URL']];
const FL_NEED = { 'u-sofia': 'Manager', 'u-grace': 'User', 'u-tyler': 'User', 'u-jordan': 'User', 'u-diego': 'User', 'u-ben': 'Manager' };
const CURIOUS = ['u-maya', 'u-priya', 'u-lena', 'u-noah', 'u-marcus', 'u-petra', 'u-radek', 'u-ivana', 'u-karel'];
const AZ_ROLES = {
  'Storage Blob Data Contributor': { data: true, read: true, write: true, note: 'Read, write and delete blobs.' },
  'Storage Blob Data Reader': { data: true, read: true, write: false, note: 'Read blobs.' },
  'Storage Blob Data Owner': { data: true, read: true, write: true, note: 'Full access to blobs, including their access control lists.' },
  'Reader': { data: false, note: 'See the storage account. No access to its data.' },
  'Contributor': { data: false, note: 'Manage the storage account. No access to its data through Entra sign-in.' },
  'Owner': { data: false, note: 'Manage the storage account and who has access. No access to its data through Entra sign-in.' }
};
const GALLERY = [['fieldline', 'Fieldline CRM', 'Fieldline, Inc. · CRM · SAML'], ['salesforce', 'Salesforce', 'Salesforce · CRM · SAML, provisioning'], ['servicenow', 'ServiceNow', 'ServiceNow · IT service management · SAML'], ['docusign', 'Docusign', 'Docusign · e-signature · SAML, provisioning'], ['zoom', 'Zoom', 'Zoom · meetings · SAML, provisioning']];
const SECRET_LIVES = [[90, '90 days (3 months)'], [180, '180 days (6 months)'], [365, '365 days (12 months)'], [545, '545 days (18 months)'], [730, '730 days (24 months)']];
const VM_IP = '198.51.100.168';
const monthsOf = days => Math.round(days / 30.4);

function principalName(tn, who) {
  const i = who.indexOf(':'), k = who.slice(0, i), id = who.slice(i + 1);
  if (k === 'u') return U[id] ? (id === 'u-you' ? 'You' : U[id].name) : 'Unknown user';
  if (k === 'g') return GMAP[id] ? GMAP[id].name : 'Deleted group';
  if (k === 'sp') { const r = tn.apps && tn.apps.reg[id]; return r ? r.name : 'Identity not found'; }
  if (k === 'mi') { const v = tn.apps && tn.apps.az[id]; return v && v.sysMI ? v.name : 'Identity not found'; }
  return who;
}
const principalType = who => ({ u: 'User', g: 'Group', sp: 'App', mi: 'Managed identity' })[who.split(':')[0]] || '';
function principalExists(tn, who) {
  const i = who.indexOf(':'), k = who.slice(0, i), id = who.slice(i + 1);
  if (k === 'sp') return !!tn.apps.reg[id];
  if (k === 'mi') return !!(tn.apps.az[id] && tn.apps.az[id].sysMI);
  return k === 'u' ? !!U[id] : k === 'g' ? !!GMAP[id] : false;
}
function dataAccess(tn, who) {
  const st = tn.apps.az['st-mes'];
  const res = { read: false, write: false, mgmt: '', roles: [] };
  if (!st) return res;
  const uid = who.indexOf('u:') === 0 ? who.slice(2) : null;
  st.roles.forEach(ra => {
    const hit = ra.who === who || (uid && ra.who.indexOf('g:') === 0 && memberOf(uid, ra.who.slice(2)));
    if (!hit || ra.orphan || !principalExists(tn, ra.who)) return;
    const R = AZ_ROLES[ra.role] || {};
    res.roles.push(ra.role);
    if (R.data) { if (R.read) res.read = true; if (R.write) res.write = true; } else if (!res.mgmt) res.mgmt = ra.role;
  });
  return res;
}
const mgmtPhrase = role => role === 'Reader' ? 'which only lets it see the account, not the data in it' : 'which manages the account but doesn’t open its data';
/* The nightly export: get a token, then write to the storage account. Two separate decisions. */
function runExport(tn, t) {
  const A = tn.apps, job = A.job, vm = A.az['vm-mesx'];
  const run = { t, auth: job.auth, ok: false, step: '', detail: '', code: 0, sp: null };
  const sp = (kind, o) => ({ id: 'sp-' + hash32(kind + t + (o.code || 0)).toString(36), t, kind, name: kind === 'mi' ? 'mes-export-vm' : 'MES-Export', resource: 'Azure Storage', ip: VM_IP, where: 'Azure West Europe', cred: kind === 'mi' ? 'Managed identity' : 'Client secret', credHint: o.cred ? o.cred.hint : '', status: o.ok ? 'Success' : 'Failure', code: o.ok ? 0 : o.code, reason: o.ok ? '' : o.reason });
  let who = null;
  if (job.auth === 'mi') {
    if (!vm.sysMI) { run.step = 'token'; run.detail = 'ManagedIdentityCredential: mes-export-vm has no managed identity turned on, so the script couldn’t get a token.'; }
    else { run.sp = sp('mi', { ok: true }); who = 'mi:vm-mesx'; }
  } else {
    const r = A.reg['ar-mes'];
    const s = r && r.secrets.find(x => x.id === job.secretId);
    if (!r) run.sp = sp('sp', { code: 700016, reason: 'Application with identifier ‘5d2e8c41-7a3b-4f0e-9b6a-2c81f4d0a937’ was not found in the directory ‘Tallis Industrial’.' });
    else if (!s) run.sp = sp('sp', { code: 7000215, reason: 'Invalid client secret provided. Ensure the secret being sent in the request is the client secret value, not the client secret ID, for a secret added to app ‘MES-Export’.' });
    else if (s.exp <= t) run.sp = sp('sp', { code: 7000222, reason: 'The provided client secret keys for app ‘MES-Export’ are expired.', cred: s });
    else run.sp = sp('sp', { ok: true, cred: s });
    if (run.sp.status === 'Success') who = 'sp:ar-mes';
    else { run.step = 'token'; run.code = run.sp.code; run.detail = 'AADSTS' + run.sp.code + ': ' + run.sp.reason; }
  }
  if (who) {
    const a = dataAccess(tn, who);
    if (a.write) { run.ok = true; run.step = 'done'; run.detail = 'Wrote mes-daily/' + fullDate(dayOf(t) - 1).replace(/ /g, '-') + '.parquet to tallismesdata.'; }
    else { run.step = 'storage'; run.code = 403; run.detail = '403 AuthorizationPermissionMismatch: This request is not authorized to perform this operation using this permission. ' + (a.read ? 'Its role can read blobs, not write them.' : a.mgmt ? 'It has ' + a.mgmt + ', ' + mgmtPhrase(a.mgmt) + '.' : 'It has no role on tallismesdata.'); }
  }
  return run;
}

/* Fieldline: SAML single sign-on, judged in the order Entra does it. */
const flApp = tn => (tn.apps && tn.apps.ent[FL.ent]) || null;
function flRolesOf(tn, uid) {
  const a = flApp(tn);
  if (!a) return [];
  return uniq(a.assigned.filter(x => x.who === 'u:' + uid || (x.who.indexOf('g:') === 0 && memberOf(uid, x.who.slice(2)))).map(x => x.role));
}
function flEval(tn, att) {
  const a = flApp(tn), t = att.t === undefined ? tn.now : att.t;
  const out = { ok: false, e: null, role: null, stage: 'entra' };
  if (!a || !tn.apps.fl.vendorReady) { out.stage = 'vendor'; return out; }
  const e = evalSignIn(tn, Object.assign({}, att, { app: 'fieldline', t }));
  out.e = e;
  const appFail = (code, reason, signedIn) => {
    e.status = 'Failure'; e.code = code; e.reason = reason; e.ca = []; e.ro = []; e.caStatus = 'Not applied'; e.need = null; e.usedMethod = null; e.viaDevice = false;
    e.authReq = 'Single-factor authentication'; e.steps = signedIn ? [['Password', 'Success']] : [];
    e.caNote = signedIn ? 'Conditional Access wasn’t evaluated: the app refused this user first.' : 'Conditional Access wasn’t evaluated: the request failed before anyone signed in.';
  };
  if (a.saml.identifier !== FL.entity) appFail(700016, 'Application with identifier ‘' + FL.entity + '’ was not found in the directory ‘Tallis Industrial’.', false);
  else if (a.saml.reply !== FL.acs) appFail(50011, 'The redirect URI ‘' + FL.acs + '’ specified in the request does not match the redirect URIs configured for the application ‘Fieldline CRM’.', false);
  else if (!a.enabled) appFail(7000112, 'Application ‘Fieldline CRM’ is disabled.', false);
  else if (e.code === 50057 || e.code === 50126) { /* the account itself failed */ }
  else if (a.assignReq && !flRolesOf(tn, att.user).length) appFail(50105, 'Your administrator has configured the application Fieldline CRM to block users unless they are specifically granted (‘assigned’) access to the application.', true);
  out.ok = passed(e);
  if (out.ok) { const roles = flRolesOf(tn, att.user); out.role = roles.indexOf('Manager') >= 0 ? 'Manager' : 'User'; e.flRole = out.role; }
  return out;
}
const flOutcome = (uid, r) => !r.ok ? 'fail' : FL_NEED[uid] === 'Manager' && r.role !== 'Manager' ? 'role' : 'in';
const salesWhere = (uid, i) => uid === 'u-diego' ? { ip: '203.0.113.140', where: 'Monterrey' } : { ip: '192.0.2.' + (20 + i), where: 'HQ' };
function flAtt(uid, t, i, tag) { const u = U[uid], w = salesWhere(uid, i); return { t, user: uid, ip: w.ip, device: u.devices[0] || null, client: 'browser', browser: 'Edge 141', tag }; }
/* A real Fieldline attempt: a prompt to register is taken if possible, then they try again. */
function flLive(tn, att) {
  let r = flEval(tn, att);
  if (r.e && r.e.status === 'Interrupted') {
    const got = tryRegister(tn, att, r.e.need, false);
    if (got) { r = flEval(tn, Object.assign({}, att, { t: (att.t === undefined ? tn.now : att.t) + 75, tag: (att.tag || '') + '-registered' })); r.registered = got; }
  }
  return r;
}
function flSaw(uid, r) {
  const f = firstName(uid);
  if (r.stage === 'vendor') return 'Fieldline’s page said single sign-on isn’t set up for Tallis yet.';
  const e = r.e;
  if (r.ok) return FL_NEED[uid] === 'Manager' && r.role !== 'Manager' ? f + ' got in, but as User, so Fieldline only shows their own deals.' : f + ' got in as ' + r.role + '.';
  if (e.code === 53003) return f + ' got “You can’t access this right now” (53003).';
  if (e.status === 'Interrupted') return f + ' was asked to set up MFA and couldn’t.';
  return f + ' got AADSTS' + e.code + ': ' + ({ 700016: 'the application wasn’t found in the directory.', 50011: 'the reply URL doesn’t match.', 7000112: 'the application is disabled.', 50105: 'not assigned to the application.', 50057: 'the account is disabled.', 50126: 'wrong password.' }[e.code] || e.reason);
}
/* Who can get into Fieldline right now, and as what. */
function flAccess(tn) {
  const a = flApp(tn);
  const ppl = USERS.filter(u => u.enabled && !u.service && !u.emergency && u.type !== 'Guest');
  return ppl.map(u => {
    if (!a || !a.enabled) return { uid: u.id, can: false, role: null };
    const roles = flRolesOf(tn, u.id);
    if (a.assignReq && !roles.length) return { uid: u.id, can: false, role: null };
    return { uid: u.id, can: true, role: roles.indexOf('Manager') >= 0 ? 'Manager' : 'User' };
  });
}
function flState(tn) {
  const a = flApp(tn);
  if (!a) return { added: false, ssoOk: false, idOk: false, replyOk: false, meta: false, vendor: false, missing: Object.keys(FL_NEED), wrongRole: [], extra: [] };
  const missing = Object.keys(FL_NEED).filter(uid => !flRolesOf(tn, uid).length);
  const wrongRole = Object.keys(FL_NEED).filter(uid => FL_NEED[uid] === 'Manager' && flRolesOf(tn, uid).length && flRolesOf(tn, uid).indexOf('Manager') < 0);
  const canIn = flAccess(tn).filter(x => x.can).map(x => x.uid);
  const extra = canIn.filter(uid => !FL_NEED[uid]);
  return { added: true, idOk: a.saml.identifier === FL.entity, replyOk: a.saml.reply === FL.acs, ssoOk: a.saml.identifier === FL.entity && a.saml.reply === FL.acs, meta: !!tn.apps.fl.metaSent, vendor: !!tn.apps.fl.vendorReady, assignReq: a.assignReq, enabled: a.enabled, missing, wrongRole, extra, canIn };
}

/* The export's credential, as it stands. */
function xState(tn) {
  const A = tn.apps, job = A.job, vm = A.az['vm-mesx'], r = A.reg['ar-mes'];
  const sec = r && job.auth === 'secret' ? r.secrets.find(s => s.id === job.secretId) : null;
  const who = job.auth === 'mi' ? 'mi:vm-mesx' : 'sp:ar-mes';
  const acc = dataAccess(tn, who);
  const expiry = A.danaExp;
  const cred = job.auth === 'mi' ? (vm.sysMI ? 'mi' : 'none') : !sec ? 'none' : sec.exp <= tn.now ? 'expired' : sec.exp > expiry + 30 * 86400 ? 'secret-long' : 'secret-short';
  return { auth: job.auth, cred, sec, acc, durable: (cred === 'mi' || cred === 'secret-long') && acc.write, mi: vm.sysMI, miAcc: dataAccess(tn, 'mi:vm-mesx'), danaSecret: !!(r && r.secrets.some(s => s.id === 'sec-dana')), regExists: !!r };
}

/* ----- the audit trail of a change ----- */
function auditPush(tn, activity, target, props, service) {
  tn.audit = tn.audit || [];
  tn.audit.push({ id: 'a-' + (tn.seq || 0) + '-' + tn.audit.length, t: tn.now, service: service || 'Conditional Access', category: /Application|service principal|role assignment|identity/i.test(activity) ? 'ApplicationManagement' : service === 'Authentication Methods' ? 'UserManagement' : 'Policy', activity, actor: 'you@' + DOMAIN, target, props: props || [] });
}
