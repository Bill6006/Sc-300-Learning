// Checks every case's logic in Node, without a browser:
// the starting tenant is unsolved, the intended fix solves it, and common wrong fixes fail the way the story says.
// Run: node tests/engine.test.mjs
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const files = ['engine.js', 'ops.js', 'knowledge.js', 'cases.js'].map(f => fs.readFileSync(path.join(root, 'src', f), 'utf8'));
const ctx = { console };
vm.createContext(ctx);
vm.runInContext(files.join('\n') + '\n;globalThis.API = { CASES, CASE, TERMS, QUESTIONS, QMAP, clone, at, FL, opSaveLocation, opDeleteLocation, opSavePolicy, opDeletePolicy, newPolicyFrom, policyDraft, methodDraft, opSaveMethod, opCreateTaps, opAddFieldline, opSaveSaml, opSendMeta, opSaveProps, opAssign, opSetVmIdentity, opAddRole, opSwitchToMi, opDelSecret, opAddSecret, opHandSecret, c2Pick, c3Session, nextSessionT, c5SelfPasskey, c5AskMarcus, brnoFacets, legacyStatus, evaluateRequirements, lockRisk, flState, runExport, MONDAY_RUN, policyImpact };', ctx);
const A = ctx.API;

let fails = 0, passes = 0;
const ok = (cond, msg) => { if (cond) { passes++; } else { fails++; console.log('  FAIL ' + msg); } };
const fresh = id => A.CASE[id].base();
const C = id => A.CASE[id];
const runTests = (id, tn) => C(id).verify.tests.map(t => ({ id: t.id, r: t.run(tn) }));
const replay = (id, tn) => C(id).close.replay(tn);
const show = rep => rep.map(x => '    ' + (x.ok === true ? '✓' : x.ok === false ? '✗' : '•') + ' ' + x.title + ': ' + x.text).join('\n');
const mustOk = (r, msg) => { if (r && r.err) console.log('    op error: ' + r.err); ok(r && r.ok, msg); return r; };

// ---------- content sanity ----------
console.log('content');
A.CASES.forEach(c => {
  ok(c.read && c.investigate && c.fix && c.verify && c.close, c.id + ' has all five stages');
  c.investigate.notes.forEach(n => ok(n.opts.some(o => o[0] === n.a), c.id + ' note ' + n.id + ' has its answer among the options'));
  c.close.learned.forEach(t => ok(!!A.TERMS[t], c.id + ' learned term exists: ' + t));
  c.close.exam.forEach(q => ok(!!A.QMAP[q], c.id + ' exam question exists: ' + q));
  ['investigate', 'fix', 'verify'].forEach(s => ok(c.hints[s] && c.hints[s].length, c.id + ' has hints for ' + s));
});
A.QUESTIONS.forEach(q => { ok(q.opts.some(o => o[0] === q.a), 'question ' + q.id + ' has its answer'); q.terms.forEach(t => ok(!!A.TERMS[t], 'question ' + q.id + ' term exists: ' + t)); });

// ---------- 1 ----------
console.log('c1 · INC-2217');
{
  const tn = fresh('c1');
  ok(!C('c1').close.solved(tn), 'starts unsolved');
  const seed = C('c1').seed();
  const jan = seed.find(e => e.id === 'c1-mon-1');
  ok(jan && jan.code === 53003 && jan.ca.some(r => r.pid === 'CA07' && r.result === 'Failure'), 'Jan on Monday is blocked by CA07');
  ok(seed.find(e => e.id === 'c1-petra-mon').authReq.indexOf('Multi') === 0, 'Petra is asked for MFA at the plant on Monday');
  ok(seed.find(e => e.id === 'c1-fri-1').status === 'Success', 'Jan got in on Friday');
  const base = runTests('c1', tn);
  ok(!base.find(x => x.id === 'plant').r.ok, 'baseline: plant check fails');
  ok(!base.find(x => x.id === 'kovo').r.ok && !base.find(x => x.id === 'valtek').r.ok, 'baseline: Kovo and Valtek skip MFA');

  mustOk(A.opSaveLocation(tn, 'loc-brno', { name: 'Brno plant', ranges: ['203.0.113.80/28'], trusted: true }), 'fix the Brno plant range');
  ok(!C('c1').close.solved(tn), 'not solved while the typo range is trusted');
  mustOk(A.opSaveLocation(tn, 'loc-brno-new', { name: 'Brno plant – new ISP', ranges: ['203.0.113.64/28'], trusted: false }), 'untrust the typo location');
  ok(C('c1').close.solved(tn), 'solved after both');
  ok(C('c1').close.tidy(tn).length === 1, 'tidy notes the leftover typo location');
  mustOk(A.opDeleteLocation(tn, 'loc-brno-new'), 'delete the typo location');
  ok(C('c1').close.tidy(tn).length === 0, 'tidy after deleting it');
  const tests = runTests('c1', tn);
  tests.forEach(t => ok(t.r.ok, 'after the fix, check passes: ' + t.id + ' (' + t.r.text + ')'));
  const rep = replay('c1', tn);
  ok(rep.every(x => x.ok !== false), 'Tuesday goes well');
  console.log(show(rep));

  // wrong: switch CA07 off
  const w1 = fresh('c1');
  const d1 = A.policyDraft(w1.cfg.policies.find(p => p.id === 'CA07')); d1.state = 'off';
  mustOk(A.opSavePolicy(w1, d1), 'wrong fix: CA07 off');
  ok(!C('c1').close.solved(w1), 'CA07 off is not solved');
  const r1 = replay('c1', w1);
  ok(r1.find(x => /Lukáš/.test(x.title)).ok === false, 'with CA07 off, Lukáš gets in from home');
  // wrong: only the two addresses from the logs
  const w2 = fresh('c1');
  mustOk(A.opSaveLocation(w2, 'new', { name: 'Brno kiosks', ranges: ['203.0.113.84/32', '203.0.113.85/32'], trusted: true }), 'wrong fix: /32 location');
  const d2 = A.policyDraft(w2.cfg.policies.find(p => p.id === 'CA07')); d2.netExSel = ['loc-brno', w2.cfg.locations[w2.cfg.locations.length - 1].id];
  mustOk(A.opSavePolicy(w2, d2), 'CA07 excludes the /32 location');
  const r2 = replay('c1', w2);
  ok(r2.find(x => /fails over/.test(x.title)).ok === false, 'with /32s, the failover blocks the floor');
  ok(r2.find(x => /day shift/.test(x.title)).ok === true, 'with /32s, the shift gets in');
}

// ---------- 2 ----------
console.log('c2 · INC-2209');
{
  const tn = fresh('c2');
  ok(!C('c2').close.solved(tn), 'starts unsolved (no plan)');
  const seed = C('c2').seed();
  ok(seed.find(e => e.id === 'c2-spray-3').code === 53003, 'the third spray attempt hit CA01 (53003)');
  ok(seed.find(e => e.id === 'c2-spray-1').code === 50126, 'the first spray attempt had a wrong password');
  ok(seed.find(e => e.id === 'c2-copier-tue').client === 'other', 'the copier signs in as Other clients');
  const wrong = A.clone(tn);
  mustOk(A.c2Pick(wrong, 'exclude-user'), 'pick exclude-user');
  ok(!A.legacyStatus(wrong.cfg).ok, 'excluding the copier breaks the legacy requirement');
  const rw = replay('c2', wrong);
  ok(rw[0].ok === true && rw[1].ok === false, 'exclusion: scans arrive, the guest Wi-Fi visitor gets in');
  console.log(show(rw));
  mustOk(A.c2Pick(tn, 'relay'), 'pick relay');
  ok(C('c2').close.solved(tn), 'relay is solved');
  ok(C('c2').close.tidy(tn).length === 1, 'tidy wants the password reset');
  tn.pwReset['u-copier'] = true;
  ok(C('c2').close.tidy(tn).length === 0, 'tidy after reset');
  runTests('c2', tn).forEach(t => ok(t.r.ok, 'check passes: ' + t.id + ' (' + t.r.text + ')'));
  const rep = replay('c2', tn);
  ok(rep.every(x => x.ok !== false), 'the week goes well');
  console.log(show(rep));
}

// ---------- 3 ----------
console.log('c3 · CHG-0420 floor');
{
  const tn = fresh('c3');
  ok(!C('c3').close.solved(tn), 'starts unsolved');
  // wrong order: session before enabling anything
  const w = A.clone(tn);
  mustOk(A.c3Session(w, 'g-line2'), 'session with nothing enabled');
  ok(/aren’t enabled/.test(w.sessions[0].lines.join(' ')), 'session says keys aren’t enabled');
  // the intended path
  const pk = A.methodDraft(tn.cfg, 'passkey'); pk.inc = ['g-emergency', 'g-floor'];
  mustOk(A.opSaveMethod(tn, pk), 'enable passkeys for the floor');
  const tap = A.methodDraft(tn.cfg, 'tap'); tap.state = 'on'; tap.incAll = false; tap.inc = ['g-floor']; tap.oneTime = true;
  mustOk(A.opSaveMethod(tn, tap), 'enable TAP for the floor');
  // a pass that starts now expires before the 06:00 session
  const early = A.clone(tn);
  mustOk(A.opCreateTaps(early, { target: 'g:g-floor', start: early.now, life: 480, oneTime: true }), 'passes from now, 8 hours');
  A.c3Session(early, 'g-floor');
  ok(/expired/.test(early.sessions[0].lines.join(' ')), 'passes made Thursday morning have expired by Friday 06:00');
  mustOk(A.opCreateTaps(tn, { target: 'g:g-floor', start: A.nextSessionT(tn) - 900, life: 240, oneTime: true }), 'passes from the next shift');
  mustOk(A.c3Session(tn, 'g-floor'), 'run the session');
  ok(tn.sessions[0].reg === 23, 'all 23 registered (' + tn.sessions[0].lines.join(' ') + ')');
  ok(C('c3').close.solved(tn), 'solved');
  ok(C('c3').close.tidy(tn).length === 0, 'tidy');
  runTests('c3', tn).forEach(t => ok(t.r.ok, 'check passes: ' + t.id));
  console.log(show(replay('c3', tn)));
  // breaking the emergency keys
  const bad = A.clone(tn);
  const pk2 = A.methodDraft(bad.cfg, 'passkey'); pk2.inc = ['g-floor'];
  mustOk(A.opSaveMethod(bad, pk2), 'replace the emergency group');
  ok(!C('c3').close.solved(bad), 'removing SG-Emergency-Access is not solved');
}

// ---------- 4 ----------
console.log('c4 · CHG-0420 rollout');
{
  const tn = fresh('c4');
  ok(!C('c4').close.solved(tn), 'starts unsolved');
  const seed = C('c4').seed();
  ok(seed.find(e => e.id === 'c4-jan').ro.some(r => r.pid === 'CA09' && /User action/.test(r.result)), 'CA09 shows user action required for Jan');
  const d = A.newPolicyFrom('mfa-all', tn.cfg);
  ok(d.exUsers[0] === 'u-you' && d.state === 'reportOnly', 'template excludes you and starts in report-only');
  mustOk(A.opSavePolicy(tn, d), 'create the template policy');
  const imp = A.policyImpact(tn, d.id);
  ok(imp.fail.length === 0 && imp.register.indexOf('u-lena') >= 0, 'impact: nobody fails, Lena registers (' + JSON.stringify({ mfa: imp.mfa.length, reg: imp.register, fail: imp.fail }) + ')');
  ok(!C('c4').close.solved(tn), 'report-only is not solved');
  const d2 = A.policyDraft(tn.cfg.policies.find(p => p.id === d.id)); d2.exUsers = []; d2.exGroups = ['g-emergency']; d2.state = 'on';
  mustOk(A.opSavePolicy(tn, d2), 'exclude emergency, include you, switch on');
  ok(C('c4').close.solved(tn), 'solved');
  ok(C('c4').close.tidy(tn).length === 1, 'tidy wants CA09 gone');
  mustOk(A.opDeletePolicy(tn, 'CA09'), 'delete CA09');
  ok(C('c4').close.tidy(tn).length === 0, 'tidy');
  runTests('c4', tn).forEach(t => ok(t.r.ok, 'check passes: ' + t.id + ' (' + t.r.text + ')'));
  const rep = replay('c4', tn);
  ok(rep.every(x => x.ok !== false), 'Tuesday goes well');
  console.log(show(rep));
  // wrong: device-or-MFA template lets office laptops skip MFA
  const w = fresh('c4');
  const dv = A.newPolicyFrom('dev-or-mfa', w.cfg); dv.exUsers = []; dv.exGroups = ['g-emergency']; dv.state = 'on';
  mustOk(A.opSavePolicy(w, dv), 'device-or-MFA policy');
  ok(!A.evaluateRequirements(w, w.now).r1.ok, 'device-or-MFA fails requirement 1 for office laptops');
}

// ---------- 5 ----------
console.log('c5 · CHG-0420 admins');
{
  const tn = fresh('c5');
  ok(!C('c5').close.solved(tn), 'starts unsolved');
  ok(A.c5SelfPasskey(A.clone(tn)).err, 'you can’t add a passkey before IT is allowed');
  const pk = A.methodDraft(tn.cfg, 'passkey'); pk.inc = pk.inc.concat(['g-it']);
  mustOk(A.opSaveMethod(tn, pk), 'enable passkeys for IT');
  mustOk(A.c5SelfPasskey(tn), 'add your passkey');
  mustOk(A.c5AskMarcus(tn), 'Marcus adds his');
  const d = A.newPolicyFrom('admin-phish', tn.cfg); d.exUsers = []; d.exGroups = ['g-emergency']; d.state = 'on';
  mustOk(A.opSavePolicy(tn, d), 'admins policy on');
  ok(C('c5').close.solved(tn), 'solved');
  ok(C('c5').close.tidy(tn).length === 0, 'tidy');
  runTests('c5', tn).forEach(t => ok(t.r.ok, 'check passes: ' + t.id + ' (' + t.r.text + ')'));
  const rep = replay('c5', tn);
  ok(rep.every(x => x.ok !== false), 'Friday goes well');
  console.log(show(rep));
  // template as created excludes you: not solved
  const w = fresh('c5');
  const pkw = A.methodDraft(w.cfg, 'passkey'); pkw.inc = pkw.inc.concat(['g-it']); A.opSaveMethod(w, pkw); A.c5SelfPasskey(w); A.c5AskMarcus(w);
  const dw = A.newPolicyFrom('admin-phish', w.cfg); dw.exGroups = ['g-emergency']; dw.state = 'on';
  A.opSavePolicy(w, dw);
  ok(!C('c5').close.solved(w), 'a policy that excludes you is not solved');
}

// ---------- 6 ----------
console.log('c6 · CHG-0431 SSO');
{
  const tn = fresh('c6');
  ok(!C('c6').close.solved(tn), 'starts unsolved');
  mustOk(A.opAddFieldline(tn), 'add from gallery');
  mustOk(A.opSaveSaml(tn, { identifier: A.FL.entity, reply: A.FL.entity, login: '' }), 'wrong reply URL');
  mustOk(A.opSendMeta(tn), 'send metadata');
  const t1 = runTests('c6', tn)[0].r;
  ok(!t1.ok && /50011/.test(t1.text), 'wrong reply URL gives 50011');
  mustOk(A.opSaveSaml(tn, { identifier: A.FL.entity, reply: A.FL.acs, login: A.FL.login }), 'right SAML');
  const t2 = runTests('c6', tn)[0].r;
  ok(t2.ok && /50105/.test(t2.text), 'test gives 50105 (SAML works, not assigned)');
  ok(C('c6').close.solved(tn), 'solved');
  console.log(show(replay('c6', tn)));
}

// ---------- 7 ----------
console.log('c7 · CHG-0431 assignment');
{
  const tn = fresh('c7');
  ok(!C('c7').close.solved(tn), 'starts unsolved');
  const seed = C('c7').seed();
  ok(seed[0] && seed[0].flRole === 'User', 'Sofia got in as User on Monday');
  const rb = replay('c7', tn);
  ok(rb[0].ok === false && rb[2].ok === false, 'baseline: all-staff clickers get in and seats overflow');
  console.log(show(rb));
  mustOk(A.opSaveProps(tn, A.FL.ent, { enabled: true, assignReq: true, visible: true }), 'assignment required');
  mustOk(A.opAssign(tn, A.FL.ent, 'g:g-sales', 'User'), 'assign Sales');
  mustOk(A.opAssign(tn, A.FL.ent, 'u:u-sofia', 'Manager'), 'Sofia manager');
  mustOk(A.opAssign(tn, A.FL.ent, 'u:u-ben', 'Manager'), 'Ben manager');
  ok(C('c7').close.solved(tn), 'solved');
  ok(C('c7').close.tidy(tn).length === 0, 'tidy');
  runTests('c7', tn).forEach(t => ok(t.r.ok, 'check passes: ' + t.id + ' (' + t.r.text + ')'));
  const rep = replay('c7', tn);
  ok(rep.every(x => x.ok !== false), 'Thursday goes well');
  console.log(show(rep));
}

// ---------- 8 ----------
console.log('c8 · INC-2238');
{
  const tn = fresh('c8');
  ok(!C('c8').close.solved(tn), 'starts unsolved');
  ok(C('c8').seed().length === 7 && C('c8').seed().every(e => e.status === 'Success'), 'seven good nights in the log');
  const base = runTests('c8', tn);
  ok(base[0].r.ok && !base[1].r.ok && /7000222/.test(base[1].r.text), 'now works, Monday fails with 7000222');
  // wrong: managed identity with Contributor
  const w = A.clone(tn);
  A.opSetVmIdentity(w, true); A.opAddRole(w, 'Contributor', 'mi:vm-mesx'); A.opSwitchToMi(w);
  const ww = runTests('c8', w)[1].r;
  ok(!ww.ok && /403/.test(ww.text), 'MI with Contributor gets 403');
  // right: MI with Storage Blob Data Contributor
  mustOk(A.opSetVmIdentity(tn, true), 'MI on');
  mustOk(A.opAddRole(tn, 'Storage Blob Data Contributor', 'mi:vm-mesx'), 'data role');
  mustOk(A.opSwitchToMi(tn), 'switch the script');
  ok(C('c8').close.solved(tn), 'solved');
  mustOk(A.opDelSecret(tn, 'ar-mes', 'sec-dana'), 'delete Dana’s secret');
  ok(C('c8').close.tidy(tn).length === 0, 'tidy');
  const rep = replay('c8', tn);
  ok(rep.every(x => x.ok !== false), 'the week goes well');
  console.log(show(rep));
  // short-term: new 6-month secret handed to Noah
  const s = fresh('c8');
  const r = A.opAddSecret(s, 'ar-mes', 'mes-export-vm job 2026', 180);
  mustOk(r, 'add a 6-month secret');
  mustOk(A.opHandSecret(s, r.secret.id), 'hand it to Noah');
  ok(C('c8').close.solved(s), 'a new secret also solves it');
  ok(C('c8').close.tidy(s).length === 0, 'a 6-month secret is tidy');
  const s2 = fresh('c8');
  const r2 = A.opAddSecret(s2, 'ar-mes', 'long', 730); A.opHandSecret(s2, r2.secret.id);
  ok(C('c8').close.tidy(s2).length === 1, 'a 24-month secret is not tidy');
}

console.log('\n' + passes + ' passed, ' + fails + ' failed');
process.exit(fails ? 1 : 0);
