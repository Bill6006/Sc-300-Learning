/* ================= a case: one ticket, five steps ================= */

function caseView(id) {
  const C = CASE[id], c = cs(id);
  const body = c.result ? resultView(C, c) : STAGE_VIEWS[STAGE_KEYS[c.stage]](C, c);
  return caseHead(C, c) + `<section class="stage" id="stage">${body}</section>`;
}
function caseHead(C, c) {
  const t = clk(C.now);
  return `<header class="casehead">
    ${btn('home', null, '<span aria-hidden="true">‹</span> Casebook', 'back')}
    <p class="caseno"><span class="mono">${esc(C.no)}</span> · ${esc(C.kind)} · ${esc(t.day)}, ${t.hm}</p>
    <h1 class="h1">${esc(C.title)}</h1>
    <ol class="rail" aria-label="Steps">${STAGES.map((s, i) => {
      const state = c.result || i < c.stage ? 'done' : i === c.stage ? 'cur' : '';
      const can = !c.result && i <= c.max && i !== c.stage;
      const inner = `<span class="n">${state === 'done' ? '✓' : i + 1}</span><span class="l">${s[1]}</span>`;
      return `<li class="${state}"${i === c.stage && !c.result ? ' aria-current="step"' : ''}>${can ? `<button type="button" data-act="stage" data-v="${i}">${inner}</button>` : `<span>${inner}</span>`}</li>`;
    }).join('')}</ol>
  </header>`;
}
const stepLabel = (i, name) => `<p class="steplabel">Step ${i + 1} of 5 · ${esc(name)}</p>`;

function hintBlock(C, c, stage) {
  const H = (C.hints && C.hints[stage]) || [], n = Math.min(c.hints[stage] || 0, H.length);
  const shown = H.slice(0, n).map((h, i) => `<div class="hint${ui.hintFlash === stage + i ? ' fresh' : ''}"><p class="who">Aisha · security analyst</p><p>${esc(h)}</p></div>`).join('');
  return `<div class="hints">${shown}${n < H.length ? btn('hint', stage, n ? 'Another hint' : 'Stuck? Ask Aisha for a hint', 'linkbtn') : '<p class="muted small">That’s every hint for this step.</p>'}</div>`;
}

const STAGE_VIEWS = {
  read(C, c) {
    const R = C.read;
    const asked = R.asks.filter(a => c.asked[a.id]).sort((a, b) => c.asked[a.id] - c.asked[b.id]);
    const unasked = R.asks.filter(a => !c.asked[a.id]);
    const thread = R.msgs.map(msgHtml).join('') + asked.map(a => msgHtml({ from: 'you', text: a.q }) + msgHtml({ from: a.from, text: a.a, shot: a.shot })).join('');
    return stepLabel(0, 'Read') + `<div class="ticket">
      <p class="tstatus">${pill('warn', R.status)}</p>
      <div class="thread">${thread}</div>
      ${R.box ? `<div class="reqbox"><p class="flabel">${esc(R.box.title)}</p><ol>${R.box.items.map(x => `<li>${esc(x)}</li>`).join('')}</ol></div>` : ''}
    </div>
    ${unasked.length ? `<div class="asks"><p class="flabel">Ask a question</p><div class="chips">${unasked.map(a => `<button type="button" class="chip ask" data-act="ask" data-v="${a.id}"><span class="to">${esc(firstName(a.from))}:</span> ${esc(a.q)}</button>`).join('')}</div></div>` : ''}
    <div class="nextbar"><p><b>Next:</b> ${esc(R.next)}</p>${btn('stage', 1, 'Start investigating', 'btn primary')}</div>`;
  },
  investigate(C, c) {
    const I = C.investigate;
    const right = I.notes.filter(n => c.notes[n.id] === n.a).length;
    const ev = I.evidence.map(x => { const k = JSON.stringify(x.open); return `<button type="button" class="evi${c.opened[k] ? ' seen' : ''}" ${openAttr(x.open)}><span class="evi-t">${esc(x.label)}</span><span class="evi-s">${esc(x.sub)}</span><span class="evi-m" aria-label="${c.opened[k] ? 'Opened' : 'Not opened yet'}">${c.opened[k] ? '✓' : ''}</span></button>`; }).join('');
    const notes = I.notes.map((n, i) => {
      const pick = c.notes[n.id], done = pick === n.a;
      const fb = pick ? (n.opts.find(o => o[0] === pick) || [])[2] : '';
      return `<div class="note-q${done ? ' done' : ''}"><p class="q"><span class="qn">${i + 1}</span>${esc(n.q)}</p>
        <div class="optlist">${n.opts.map(o => `<button type="button" class="opt" data-act="note" data-v="${attr(n.id + '|' + o[0])}" aria-pressed="${pick === o[0]}"${done ? ' disabled' : ''}><span class="box round">${pick === o[0] ? (done ? '✓' : '×') : ''}</span><span>${esc(o[1])}</span></button>`).join('')}</div>
        ${pick ? `<p class="fb ${done ? 'ok' : 'no'}">${esc(fb)}</p>` : ''}</div>`;
    }).join('');
    const all = right === I.notes.length;
    return stepLabel(1, 'Investigate') + `<h2 class="h2">${esc(I.goal)}</h2>
      <div class="block"><p class="flabel">Evidence</p><p class="small muted">Open anything. Looking never changes the tenant.</p><div class="evidence">${ev}</div></div>
      <div class="block"><p class="flabel">Your notes · ${right} of ${I.notes.length}</p>${notes}</div>
      ${hintBlock(C, c, 'investigate')}
      <div class="nextbar"><p>${all ? 'You know what’s wrong.' : 'Answer the notes to move on. Wrong answers just explain why.'}</p>${btn('stage', 2, 'Next: fix it', 'btn primary', all ? '' : ' disabled')}</div>`;
  },
  fix(C, c) {
    const F = C.fix, tn = c.tn;
    const status = F.status(tn).map(s => `<li class="${s.ok === true ? 'ok' : s.ok === false ? 'bad' : ''}">${s.ok === true ? '<span class="mk ok">✓</span>' : s.ok === false ? '<span class="mk pend">○</span>' : '<span class="mk info">•</span>'}<span>${esc(s.text)}</span></li>`).join('');
    const plans = F.plans ? `<div class="block"><p class="flabel">Your plan</p><div class="optlist plans">${F.plans.map(p => `<button type="button" class="opt" data-act="plan" data-v="${p.id}" aria-pressed="${tn.plan === p.id}"><span class="box round">${tn.plan === p.id ? '●' : ''}</span><span>${esc(p.label)}</span></button>`).join('')}</div></div>` : '';
    const tools = F.tools.filter(t => !t.needs || t.needs(tn)).map(t => t.act ? `<button type="button" class="evi tool" data-act="${t.act}"><span class="evi-t">${esc(t.label)}</span><span class="evi-s">${esc(t.sub)}</span><span class="evi-m">→</span></button>` : `<button type="button" class="evi tool" ${openAttr(t.open)}><span class="evi-t">${esc(t.label)}</span><span class="evi-s">${esc(t.sub)}</span><span class="evi-m">›</span></button>`).join('');
    const changes = c.changes.length ? `<ol class="changes">${c.changes.map(x => `<li>${esc(x.text)}</li>`).join('')}</ol>` + (ui.confirm === 'undo' ? `<div class="confirm"><p>Put the tenant back the way this case started?</p><div class="cta">${btn('undo', null, 'Undo all changes', 'btn danger sm')}${btn('confirm-no', null, 'Keep them', 'btn ghost sm')}</div></div>` : btn('confirm', 'undo', 'Undo all changes', 'linkbtn')) : '<p class="muted">Nothing changed yet.</p>';
    return stepLabel(2, 'Fix') + `<h2 class="h2">${esc(F.goal)}</h2>
      <ul class="status">${status}</ul>
      ${plans}
      <div class="block"><p class="flabel">Tools</p><div class="evidence">${tools}</div></div>
      <div class="block"><p class="flabel">Your changes</p>${changes}</div>
      ${hintBlock(C, c, 'fix')}
      <div class="nextbar"><p>When you think it’s fixed, test it.</p>${btn('stage', 3, 'Next: verify', 'btn primary')}</div>`;
  },
  verify(C, c) {
    const V = C.verify;
    const tests = V.tests.map(T => {
      const r = c.tests[T.id], stale = r && r.at !== c.ver;
      return `<li class="test${r ? (r.ok ? ' ok' : ' bad') : ''}${stale ? ' stale' : ''}"><div class="test-h"><div><b>${esc(T.label)}</b><span class="small muted">${esc(T.sub)}</span></div>${btn('test', T.id, r ? 'Run again' : 'Run', 'btn ghost sm')}</div>
        ${r ? `<p class="test-r">${mark(r.ok)}<span>${esc(r.text)}${stale ? ' <em>(before your last change)</em>' : ''}</span></p>${r.sid ? `<button type="button" class="linkbtn" ${openAttr({ type: 'signin', id: r.sid, tab: 'ca' })}>Open the sign-in</button>` : ''}${r.spid ? `<button type="button" class="linkbtn" ${openAttr({ type: 'spsignin', id: r.spid })}>Open the sign-in</button>` : ''}` : ''}</li>`;
    }).join('');
    const tested = c.testedAt === c.ver && c.changes.length;
    const caCase = ['c1', 'c2', 'c4', 'c5'].indexOf(C.id) >= 0;
    return stepLabel(3, 'Verify') + `<h2 class="h2">${esc(V.goal)}</h2>
      <ol class="tests">${tests}</ol>
      <p class="tested ${tested ? 'ok' : ''}">${tested ? '✓ Tested since your last change.' : c.changes.length ? 'Run a check after your last change.' : 'You haven’t changed anything yet.'}</p>
      ${caCase ? `<p class="small">Want to try your own sign-in? <button type="button" class="linkbtn" ${openAttr({ type: 'whatif' })}>Open What If</button></p>` : ''}
      ${hintBlock(C, c, 'verify')}
      <div class="nextbar"><p>Something not right? Go back and change it.</p><div class="cta">${btn('stage', 2, 'Back to fix', 'btn ghost')}${btn('stage', 4, 'Next: close', 'btn primary')}</div></div>`;
  },
  close(C, c) {
    const untested = !(c.testedAt === c.ver && c.changes.length);
    return stepLabel(4, 'Close') + `<h2 class="h2">Close the ticket</h2>
      <p class="lede">When you close it, the next days play out with the tenant exactly as you left it. You’ll see what happened, and you can always reopen it.</p>
      ${untested ? `<p class="warnline">You haven’t run a check since your last change.</p>` : ''}
      <label class="field"><span>Resolution note (optional): what was wrong, in your own words?</span><textarea id="resNote" data-bind="case.note" rows="3">${esc(c.note)}</textarea></label>
      <div class="cta">${btn('close-case', null, esc(C.close.button), 'btn primary')}${btn('stage', 3, 'Back to verify', 'btn ghost')}</div>`;
  }
};

function resultView(C, c) {
  const R = c.result;
  const next = CASES[CASES.indexOf(C) + 1];
  const items = R.replay.map(x => `<li class="${x.ok === true ? 'ok' : x.ok === false ? 'bad' : ''}"><span class="rt mono">${clk(x.t).wd} ${clk(x.t).hm}</span>${mark(x.ok)}<div><b>${esc(x.title)}</b><p>${esc(x.text)}</p>${x.sid ? `<button type="button" class="linkbtn" ${openAttr({ type: 'signin', id: x.sid, tab: 'ca' })}>Open the sign-in</button>` : ''}${x.spid ? `<button type="button" class="linkbtn" ${openAttr({ type: 'spsignin', id: x.spid })}>Open the sign-in</button>` : ''}</div></li>`).join('');
  const why = [];
  if (R.solved && !R.stamps.tested) why.push('Tested: run a check after your last change, before you close.');
  R.tidyIssues.forEach(t => why.push(t));
  return `<p class="steplabel">Closed · ${R.solved ? 'solved' : 'not solved yet'}</p>
    <h2 class="h2">${esc(C.close.replayTitle)}</h2>
    <ol class="replay">${items}</ol>
    <div class="verdict ${R.solved ? 'good' : 'notyet'}">
      <p class="big">${R.solved ? esc(C.close.good) : 'Not solved yet. Nothing is lost: reopen it, your changes are still there.'}</p>
      ${stampsHtml(R.stamps)}
      ${why.length ? `<p class="flabel">${R.solved ? 'For the other stamps' : 'Worth knowing'}</p><ul class="plain">${why.map(t => `<li>${esc(t)}</li>`).join('')}</ul>` : ''}
    </div>
    <div class="card expert"><p class="flabel">What an expert would say</p><p>${esc(C.close.expert)}</p></div>
    ${C.close.extra ? `<details class="card more"><summary>One more thing hides in this tenant</summary><p>${esc(C.close.extra)}</p></details>` : ''}
    <div class="block"><p class="flabel">Added to your review</p><div class="chips">${C.close.learned.map(t => `<button type="button" class="chip" ${openAttr({ type: 'concept', id: t })}>${esc(TERMS[t].name)}</button>`).join('')}</div></div>
    ${examCheck(C, c)}
    <div class="cta end">${next ? btn('go-case', next.id, 'Next case: ' + esc(next.title), 'btn primary') : btn('review', null, 'Go to Review', 'btn primary')}${btn('home', null, 'Back to the casebook', 'btn ghost')}</div>
    <p class="small muted">${btn('reopen', null, 'Reopen and change something', 'linkbtn')} · ${btn('confirm', 'restart', 'Play this case again from the start', 'linkbtn')}</p>
    ${ui.confirm === 'restart' ? `<div class="confirm"><p>Start this case over? Your stamps stay.</p><div class="cta">${btn('restart', null, 'Start over', 'btn danger sm')}${btn('confirm-no', null, 'Cancel', 'btn ghost sm')}</div></div>` : ''}`;
}
function questionHtml(q, pick, act, extra) {
  const done = !!pick;
  return `<div class="qcard"><p class="qkind">${q.kind === 'pair' ? 'Tell apart' : 'Exam style'}</p><p class="q">${esc(q.q)}</p>
    <div class="optlist">${q.opts.map(o => `<button type="button" class="opt${done && o[0] === q.a ? ' right' : ''}${done && o[0] === pick && pick !== q.a ? ' wrong' : ''}" data-act="${act}" data-v="${attr(q.id + '|' + o[0] + (extra || ''))}" aria-pressed="${pick === o[0]}"${done ? ' disabled' : ''}><span class="box round">${done && o[0] === q.a ? '✓' : done && o[0] === pick ? '×' : ''}</span><span>${esc(o[1])}</span></button>`).join('')}</div>
    ${done ? `<p class="fb ${pick === q.a ? 'ok' : 'no'}"><b>${pick === q.a ? 'Right.' : 'Not quite.'}</b> ${esc(q.why)}</p>` : ''}</div>`;
}
function examCheck(C, c) {
  const picks = c.result.exam || {};
  const qs = C.close.exam.map(id => QMAP[id]).filter(Boolean);
  const n = qs.filter(q => picks[q.id]).length;
  return `<div class="block"><p class="flabel">Exam check · ${n} of ${qs.length}</p><p class="small muted">Questions in the style of SC-300, about what this case used. They come back in Review.</p>${qs.map(q => questionHtml(q, picks[q.id], 'exam-pick')).join('')}</div>`;
}
