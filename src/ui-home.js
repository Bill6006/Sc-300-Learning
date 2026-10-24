/* ================= the casebook: one next step, and the cases in order ================= */

function nextCase() {
  const inProgress = CASES.filter(C => started(C.id) && !cs(C.id).result).sort((a, b) => (cs(b.id).updatedAt || 0) - (cs(a.id).updatedAt || 0))[0];
  if (inProgress) return { C: inProgress, cont: true };
  const fresh = CASES.find(C => !solvedEver(C.id) && !(S.cases[C.id] && S.cases[C.id].result));
  return fresh ? { C: fresh, cont: false } : null;
}
function caseStatus(C) {
  const c = S.cases[C.id];
  if (c && c.result) return { cls: c.result.solved ? 'solved' : 'closed', text: c.result.solved ? 'Solved' : 'Closed, not solved' };
  if (solvedEver(C.id)) return { cls: 'solved', text: 'Solved' };
  if (started(C.id)) return { cls: 'progress', text: 'Step ' + (c.stage + 1) + ' of 5 · ' + STAGES[c.stage][1] };
  return { cls: '', text: 'About ' + C.mins + ' minutes' };
}
function homeView() {
  const n = nextCase();
  const doneN = CASES.filter(C => solvedEver(C.id)).length;
  const due = dueQuestions().length;
  let next;
  if (n) {
    const c = S.cases[n.C.id];
    const stageName = n.cont ? STAGES[c.stage][1] : 'Read';
    const line = n.cont ? { read: n.C.read.next, investigate: n.C.investigate.goal, fix: n.C.fix.goal, verify: n.C.verify.goal, close: 'Close the ticket and see what happens next.' }[STAGE_KEYS[c.stage]] : n.C.brief;
    next = `<section class="nextcard">
      <p class="caseno"><span class="mono">${esc(n.C.no)}</span> · ${n.cont ? 'Continue · step ' + (c.stage + 1) + ' of 5, ' + esc(stageName.toLowerCase()) : 'Up next'}</p>
      <h2 class="h2">${esc(n.C.title)}</h2>
      <p>${esc(line)}</p>
      <div class="cta">${btn('go-case', n.C.id, n.cont ? 'Continue' : 'Open the ticket', 'btn primary')}<span class="small muted">About ${minutesLeft(n.C, n.cont ? c : null)} minutes${n.cont ? ' left' : ''}</span></div>
    </section>`;
  } else next = `<section class="nextcard done"><h2 class="h2">You’ve solved every case.</h2><p>Keep the ideas fresh in Review, or replay a case to collect the stamps you missed.</p><div class="cta">${btn('review', null, 'Go to Review', 'btn primary')}</div></section>`;
  const chapters = CHAPTERS.map((ch, i) => {
    const list = CASES.filter(C => C.chapter === i);
    return `<section class="chapter"><div class="ch-h"><h2 class="h3">Chapter ${i + 1} · ${esc(ch.title)}</h2><p class="small muted">${esc(ch.sub)}</p></div>
      <ol class="caselist">${list.map(C => { const st = caseStatus(C), best = S.cases[C.id] && S.cases[C.id].best; return `<li><button type="button" class="caserow ${st.cls}" data-act="go-case" data-v="${C.id}"><span class="cr-no mono">${esc(C.no)}</span><span class="cr-main"><b>${esc(C.title)}</b><span>${esc(C.brief)}</span></span><span class="cr-st">${best ? stampsHtml(best) : ''}<span class="small">${esc(st.text)}</span></span></button></li>`; }).join('')}</ol></section>`;
  }).join('');
  return `<section class="hero">
      <p class="kicker">SC-300 · Identity and Access Administrator</p>
      <h1 class="h1">${greeting()}.</h1>
      <p class="lede">One ticket at a time, worked the same way every time. Stop whenever you like; your place is saved.</p>
    </section>
    ${next}
    <p class="progressline small">${doneN} of ${CASES.length} cases solved${due ? ' · ' + btn('review', null, plural(due, 'question') + ' ready in Review', 'linkbtn') : ''}</p>
    ${chapters}`;
}

/* ================= review: what you've met, a short check, and the exam map ================= */
function reviewView() {
  if (ui.quiz) return quizView();
  const met = metTerms();
  const due = dueQuestions();
  const byArea = Object.keys(AREAS).map(a => ({ a, terms: Object.keys(TERMS).filter(t => TERMS[t].area === a) })).filter(x => x.terms.length);
  const answered = Object.keys(S.quiz).length;
  return `<section class="hero"><h1 class="h1">Review</h1><p class="lede">The ideas you’ve met in the cases, and short checks in the style of the exam. Five questions take about three minutes.</p></section>
    <section class="nextcard">
      ${met.length ? (due.length ? `<h2 class="h2">${plural(Math.min(due.length, 5), 'question')} ready</h2><p>Questions you missed come back tomorrow. The ones you get right come back later and later.</p><div class="cta">${btn('quiz-start', null, 'Start', 'btn primary')}</div>` : `<h2 class="h2">Nothing due right now</h2><p>You’ve answered everything that’s due. Come back tomorrow, or practice anyway.</p><div class="cta">${btn('quiz-start', 'any', 'Practice anyway', 'btn ghost')}</div>`) : `<h2 class="h2">Nothing here yet</h2><p>Concepts arrive here as you close cases. Start with the first ticket.</p><div class="cta">${btn('go-case', CASES[0].id, 'Open the first case', 'btn primary')}</div>`}
      ${answered ? `<p class="small muted">${answered} of ${QUESTIONS.length} questions answered at least once.</p>` : ''}
    </section>
    <section class="block"><h2 class="h3">Concepts</h2><p class="small muted">${met.length} of ${Object.keys(TERMS).length} met so far. Open one for the plain meaning, Microsoft’s words, and what to say in an interview.</p>
      ${byArea.map(x => `<p class="flabel">${esc(AREAS[x.a])}</p><div class="chips">${x.terms.map(t => S.concepts[t] ? `<button type="button" class="chip" ${openAttr({ type: 'concept', id: t })}>${esc(TERMS[t].name)}</button>` : `<span class="chip locked" title="Not met yet">${esc(TERMS[t].name)}</span>`).join('')}</div>`).join('')}
    </section>
    <section class="block"><h2 class="h3">What the exam covers</h2><p class="small muted">SC-300 has four skill areas. Authentication and access management is the largest. The casebook covers some of each, and here’s what to study elsewhere.</p>
      ${COVERAGE.map(x => `<details class="cover"><summary><b>${esc(AREAS[x.area])}</b><span class="small muted">${x.covered.length} covered here · ${x.gaps.length} to study elsewhere</span></summary><ul class="plain">${x.covered.map(t => `<li class="in">${esc(t)}</li>`).join('')}${x.gaps.map(t => `<li class="out">${esc(t)}</li>`).join('')}</ul></details>`).join('')}
      <p class="small">Check the official outline before you book: <a href="${STUDY_GUIDE}" target="_blank" rel="noopener">Study guide for Exam SC-300</a>.</p>
    </section>`;
}
function startQuiz(mode) {
  let ids;
  if (mode === 'any') ids = QUESTIONS.filter(qOpen).map(q => q.id).sort((a, b) => ((S.quiz[a] || {}).at || 0) - ((S.quiz[b] || {}).at || 0)).slice(0, 5);
  else if (mode && QMAP[mode]) ids = [mode];
  else ids = dueQuestions().slice(0, 5).map(q => q.id);
  if (!ids.length) { toast('No questions yet. Close a case first.'); return; }
  ui.quiz = { ids, i: 0, picks: {} };
  ui.view = 'review';
}
function quizView() {
  const Q = ui.quiz, total = Q.ids.length;
  if (Q.i >= total) {
    const right = Q.ids.filter(id => Q.picks[id] === QMAP[id].a).length;
    return `<section class="hero"><p class="kicker">Review</p><h1 class="h1">${right} of ${total} right</h1><p class="lede">${right === total ? 'Those will come back later, so they stay fresh.' : 'The ones you missed come back tomorrow. That’s how they stick.'}</p></section><div class="cta">${btn('quiz-done', null, 'Done', 'btn primary')}</div>`;
  }
  const q = QMAP[Q.ids[Q.i]], pick = Q.picks[q.id];
  return `<section class="quiz"><p class="kicker">Question ${Q.i + 1} of ${total}</p>${questionHtml(q, pick, 'quiz-pick')}
    <div class="cta">${pick ? btn('quiz-next', null, Q.i + 1 < total ? 'Next question' : 'See how it went', 'btn primary') : ''}${btn('quiz-done', null, 'Stop here', 'btn ghost')}</div></section>`;
}
