/* ================= progress: what you've done, kept in this browser and, when signed in, in your private space =================
   S.cases[id] holds one case's progress and its tenant. S.concepts and S.quiz hold what you've learned. */

const LS_KEY = 'tallis-casebook-v1';
const STAGE_KEYS = STAGES.map(s => s[0]);
let S = null;
function freshState() { return { v: 1, updatedAt: 0, cases: {}, concepts: {}, quiz: {}, seen: {} }; }
function freshCase(id) {
  return { id, stage: 0, max: 0, asked: {}, notes: {}, misses: {}, opened: {}, hints: {}, tn: CASE[id].base(), changes: [], ver: 0, testedAt: -1, tests: {}, logs: [], note: '', result: null, best: null, plays: 0, updatedAt: 0 };
}
const cs = id => S.cases[id] || (S.cases[id] = freshCase(id));
const started = id => !!S.cases[id] && (S.cases[id].stage > 0 || Object.keys(S.cases[id].asked).length > 0 || S.cases[id].plays > 0);
const solvedEver = id => !!(S.cases[id] && S.cases[id].best && S.cases[id].best.solved);

/* ----- saving ----- */
const dirtyCases = new Set();
let dirtyMeta = false;
function touch(id) {
  const now = Date.now();
  if (id) { cs(id).updatedAt = now; dirtyCases.add(id); }
  S.updatedAt = now; dirtyMeta = true;
  saveLocal();
  pushSoon();
}
function saveLocal() { try { localStorage.setItem(LS_KEY, JSON.stringify(S)); } catch (err) { /* storage full or blocked: progress lives in the page for now */ } }
function loadLocal() {
  try { const o = JSON.parse(localStorage.getItem(LS_KEY) || 'null'); if (o && o.v === 1 && o.cases) return sanitize(o); } catch (err) { /* nothing saved */ }
  return freshState();
}
/* Drop anything a newer or older version can't use. */
function sanitize(o) {
  const s = Object.assign(freshState(), o);
  Object.keys(s.cases).forEach(id => { if (!CASE[id] || !s.cases[id] || !s.cases[id].tn) delete s.cases[id]; else s.cases[id] = Object.assign(freshCase(id), s.cases[id]); });
  return s;
}
/* Two copies of your progress, from two devices: keep the newer of each case, and everything you've learned. */
function mergeState(a, b) {
  if (!b || !b.cases) return a;
  const m = clone(a);
  Object.keys(b.cases).forEach(id => { if (CASE[id] && b.cases[id] && b.cases[id].tn && (!m.cases[id] || (b.cases[id].updatedAt || 0) > (m.cases[id].updatedAt || 0))) m.cases[id] = Object.assign(freshCase(id), b.cases[id]); });
  Object.keys(b.concepts || {}).forEach(k => { const x = b.concepts[k], y = m.concepts[k]; if (!y || (x.met || 0) < (y.met || 0)) m.concepts[k] = x; });
  Object.keys(b.quiz || {}).forEach(k => { const x = b.quiz[k], y = m.quiz[k]; if (!y || (x.at || 0) > (y.at || 0)) m.quiz[k] = x; });
  Object.assign(m.seen, b.seen || {});
  m.updatedAt = Math.max(a.updatedAt || 0, b.updatedAt || 0);
  return m;
}

/* ----- your private copy in the page's database, when the page runs on claude.ai ----- */
const cloud = { db: null, uid: null, status: 'local' };
const progressRef = () => cloud.db.doc('data/users/' + cloud.uid + '/progress');
const caseRef = id => progressRef().collection('cases').doc(id);
async function connectCloud() {
  try {
    if (!window.claude || typeof window.claude.use !== 'function') return false;
    const pair = await Promise.all([window.claude.use('db'), window.claude.use('user')]);
    const db = pair[0], user = pair[1];
    if (!db || !user) return false;
    const uid = await user.id();
    if (!uid) return false;
    cloud.db = db; cloud.uid = uid; cloud.status = 'syncing';
    const meta = await progressRef().get();
    const remote = freshState();
    if (meta.exists) Object.assign(remote, meta.data());
    const snap = await progressRef().collection('cases').get();
    snap.docs.forEach(d => { if (d.exists) remote.cases[d.id] = d.data(); });
    S = sanitize(mergeState(S, remote));
    saveLocal();
    CASES.forEach(c => { const r = remote.cases[c.id], l = S.cases[c.id]; if (l && (!r || (l.updatedAt || 0) > (r.updatedAt || 0))) dirtyCases.add(c.id); });
    dirtyMeta = true;
    cloud.status = 'synced';
    pushSoon(800);
    return true;
  } catch (err) { cloud.status = cloud.db ? 'offline' : 'local'; return false; }
}
let pushTimer = 0, pushing = false, pushAgain = false;
function pushSoon(ms) { if (!cloud.db) return; clearTimeout(pushTimer); pushTimer = setTimeout(push, ms || 2500); }
async function push() {
  if (!cloud.db) return;
  if (pushing) { pushAgain = true; return; }
  pushing = true;
  try {
    const ids = Array.from(dirtyCases); dirtyCases.clear();
    for (const id of ids) { if (S.cases[id]) await caseRef(id).set(JSON.parse(JSON.stringify(S.cases[id]))); }
    if (dirtyMeta) { dirtyMeta = false; await progressRef().set({ v: 1, updatedAt: S.updatedAt, concepts: S.concepts, quiz: S.quiz, seen: S.seen }); }
    cloud.status = 'synced';
  } catch (err) { cloud.status = 'offline'; }
  pushing = false;
  if (pushAgain) { pushAgain = false; push(); }
}
async function clearCloud() {
  if (!cloud.db) return;
  try { for (const c of CASES) await caseRef(c.id).delete(); await progressRef().delete(); } catch (err) { /* it'll be overwritten on the next save */ }
}

/* ----- a case's sign-ins: the ones that were already there, and the ones your tests and replays made ----- */
const SEEDS = {};
const seedsOf = id => SEEDS[id] || (SEEDS[id] = CASE[id].seed ? CASE[id].seed() : []);
function keepLog(c, e) {
  if (!e || !e.id) return null;
  c.logs = c.logs.filter(x => x.id !== e.id);
  c.logs.push(e);
  if (c.logs.length > 25) c.logs = c.logs.slice(-25);
  return e.id;
}
function findSignin(id, sid) {
  const c = cs(id);
  return c.logs.find(e => e.id === sid) || seedsOf(id).find(e => e.id === sid && !e.kind) || null;
}
function findSp(id, sid) {
  const c = cs(id);
  return c.logs.find(e => e.id === sid) || seedsOf(id).find(e => e.id === sid) || null;
}

/* ----- changes, tests and the close ----- */
/* Every change runs through here: the tenant moves on, the change is listed, and earlier tests no longer count. */
function applyChange(id, res) {
  if (!res) return false;
  if (res.err) { ui.msg = res.err; return false; }
  ui.msg = '';
  if (res.none) { toast('Nothing changed.'); return true; }
  const c = cs(id);
  c.tn.seq = (c.tn.seq || 0) + 1;
  c.ver++;
  c.changes.push({ n: c.ver, text: res.summary });
  touch(id);
  return true;
}
function runTest(id, testId) {
  const c = cs(id), T = CASE[id].verify.tests.find(t => t.id === testId);
  if (!T) return;
  c.tn.seq = (c.tn.seq || 0) + 1;
  const r = T.run(c.tn);
  const rec = { ok: r.ok, text: r.text, at: c.ver, sid: r.e ? keepLog(c, r.e) : null, spid: r.sp ? keepLog(c, r.sp) : null };
  c.tests[testId] = rec;
  c.testedAt = c.ver;
  touch(id);
}
function undoAll(id) {
  const c = cs(id);
  c.tn = CASE[id].base(); c.changes = []; c.ver++; c.tests = {}; c.testedAt = -1;
  touch(id);
}
function closeCase(id) {
  const c = cs(id), C = CASE[id];
  const tn = clone(c.tn);
  const replay = C.close.replay(tn).map(x => ({ t: x.t, ok: x.ok, title: x.title, text: x.text, sid: x.e ? keepLog(c, x.e) : null, spid: x.sp ? keepLog(c, x.sp) : null }));
  const solved = !!C.close.solved(c.tn);
  const tidyIssues = C.close.tidy(c.tn);
  const stamps = { solved, tested: solved && c.testedAt === c.ver && c.changes.length > 0, tidy: solved && !tidyIssues.length };
  c.result = { solved, stamps, tidyIssues, replay, at: Date.now(), exam: {} };
  c.plays++;
  c.best = c.best ? { solved: c.best.solved || stamps.solved, tested: c.best.tested || stamps.tested, tidy: c.best.tidy || stamps.tidy } : stamps;
  C.close.learned.forEach(t => meet(t, id));
  touch(id);
}
function reopenCase(id) { const c = cs(id); c.result = null; c.stage = 2; touch(id); }
function restartCase(id) {
  const old = cs(id);
  const c = freshCase(id);
  c.best = old.best; c.plays = old.plays;
  S.cases[id] = c;
  touch(id);
}

/* ----- what you've learned ----- */
function meet(term, from) { if (!TERMS[term] || S.concepts[term]) return; S.concepts[term] = { met: Date.now(), from: from || '' }; dirtyMeta = true; }
const metTerms = () => Object.keys(S.concepts).filter(t => TERMS[t]);
/* Spaced review: right answers come back later and later; misses come back tomorrow. */
const BOX_DAYS = [0, 1, 3, 7, 21];
function answerQ(qid, right) {
  const q = S.quiz[qid] || { box: 0, right: 0, wrong: 0 };
  q.box = right ? Math.min(q.box + 1, BOX_DAYS.length - 1) : 1;
  q.due = Date.now() + BOX_DAYS[q.box] * 86400000 - 3600000;
  q[right ? 'right' : 'wrong']++;
  q.at = Date.now();
  S.quiz[qid] = q;
  dirtyMeta = true;
}
const qOpen = q => q.terms.some(t => S.concepts[t]);
function dueQuestions() {
  const now = Date.now();
  return QUESTIONS.filter(qOpen).filter(q => { const s = S.quiz[q.id]; return !s || (s.due || 0) <= now; }).sort((a, b) => (S.quiz[a.id] ? 0 : 1) - (S.quiz[b.id] ? 0 : 1));
}
