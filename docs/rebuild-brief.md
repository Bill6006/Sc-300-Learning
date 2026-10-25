# Tallis Casebook: build brief

**How to use this file:** Start a new Claude Code session on the `bill6006/sc-300-learning` repository, attach this file (or paste everything below the line), and say: *"Read this brief and build Phase 1. Stop and show me before Phase 2."* It also works if you give it to the session that built the original game.

---

## 1. Who this is for

I just started working as an identity and access administrator, and I'm studying for SC-300 (Microsoft Identity and Access Administrator). Regular studying doesn't stick for me, so I learn through a game set in a fictional company, Tallis Industrial, where I work realistic Microsoft Entra tickets.

The first version (Tallis Living Tenant, kept in `archive/tallis-living-tenant-original.html`) taught real things, but it exhausted me the moment I opened it, before I did anything. Real tickets at work felt calmer than the game. An earlier session found why:

- It opened on an emergency: dozens of red marks and alerts before I'd done anything.
- There was no single next step: about 37 buttons and links on the first screen, and two ways to navigate (a map and tabs), four or five screens deep.
- A clock kept running, so things got worse between visits, with three problems open at once and a deadline.
- Too many helper systems at once: a field guide with levels, a hint ladder with timers, mistake tracking, predictions, bets and a four-step debrief.

I need it to feel like a game while I'm actually learning, to build me up until I can handle these tickets on my own at work, and to cover what the exam covers.

## 2. Decision: rebuild the app, keep the engine and the story

Don't patch the original 7,000-line file. Build a new app, starting from the work on branch `ccr-96fcdd42-h4mhr7`:

| Keep (tested) | Treat as a draft |
|---|---|
| `src/engine.js`: the Conditional Access, authentication methods and apps engine | `src/app-state.js` and `src/ui-*.js`: written but never run in a browser. Reuse what fits, rewrite freely. |
| `src/ops.js`: tenant changes, each with a plain-language summary | |
| `src/knowledge.js`: 26 concept cards and 43 exam-style questions | |
| `src/cases.js`: eight tickets in the five-step format | |
| `tests/engine.test.mjs`: 366 checks pass (`node tests/engine.test.mjs`) | |

Keep the engine's behavior and keep the tests passing. Publish as a new private artifact called "Tallis Casebook" so the original stays as a backup, and commit a standalone copy that opens from disk.

## 3. The calm rules (non-negotiable)

1. The first screen shows one thing: a greeting and the single next step, like "Continue: The floor can't sign in · about 8 minutes". Nothing red, no failure counts, no alerts.
2. One ticket at a time, worked in the same five steps every time: **Read, Investigate, Fix, Verify, Close**. Same layout and order on every ticket.
3. One guide (Aisha), in one place on screen. No other helper systems.
4. No timers, no lives, no running clock. Story time only moves when I close a ticket.
5. Save automatically. I can stop after any step and come back to the same spot.
6. Sessions of 10 to 15 minutes. Every ticket shows its estimated time.
7. At most two levels of navigation: Home, then Ticket. Details open in one side panel (full screen on a phone) with Back and Close.
8. Mistakes are safe: "Undo all changes", reopen a closed ticket, replay any ticket. Results read as "what happened next", never as failure.
9. Works well on a phone and on a desktop.

## 4. The guide system: Aisha teaches, then steps back

Aisha, the security analyst from the original game, is my mentor. She follows how a new hire really learns at work: shadow first, then pair, then work solo.

| Mode | Who drives | What Aisha does |
|---|---|---|
| **Shadow** | Aisha | Walks me through every step: "Open Jan's sign-in. See error code 53003? His password worked, and a policy refused him." She opens things for me, explains each one, and asks one small question per step to keep me thinking. |
| **Pair** | Me | Comments when I open something ("This is the Conditional Access tab. Look for the row marked Failure.") and stops me before a risky change ("Before you save: who else is in this group?"). Gives hints when I ask. |
| **Solo** | Me | Stays quiet unless I ask. Reviews my work at the end like a senior engineer. |

- The first ticket on any new topic starts in Shadow. After it, suggest Pair for the next ticket. Solo replays earn the full set of stamps.
- I can switch modes any time, with one tap and no penalty.
- Aisha talks in one coach strip (along the bottom on a phone, beside the ticket on desktop), one message at a time, with "Next" and "Explain more". Never a stack of popups.
- Each ticket needs a Shadow script: an ordered list of steps, each with what Aisha says, what to open or do, and one small check question. The existing hints and notes in `src/cases.js` are a starting point.

**"What am I looking at?"** Every portal-style screen (a sign-in entry, a policy, a named location, an app's settings) gets one button that turns on numbered callouts explaining each part in plain words. For example: "1. Status: did they get in? 2. Error code: 53003 means a policy blocked them after the password worked. 3. Conditional Access tab: which policy decided." This replaces underlined terms everywhere.

**Three layers for every idea, plainest first:** plain words, then Microsoft's words, then how the exam asks about it. The second and third are one tap away, not shown by default.

**My runbook.** Each solved ticket adds a short checklist I can use at work, with the real Entra admin center path for each step. Example: "User blocked with 53003: open the sign-in › Conditional Access tab › find the policy marked Failure › check its user and network conditions › check the audit log for recent changes." This is the game's collectible, and it's useful on the job.

**After each ticket, only this:** what happened next (the replay), the stamps (Solved, Tested, Tidy), the two or three ideas I just learned, a three-question exam check, and Aisha's one-paragraph "what an expert would say".

## 5. Ways to play (keep it to these)

The home screen only ever shows the next ticket. Everything else lives in one "Practice" area:

1. **Tickets**: the main game, as above.
2. **Quick check**: five spaced-review questions, about three minutes. Missed ones come back tomorrow, right ones later and later.
3. **Spot the problem**: a portal screen with one misconfiguration to tap, such as a policy that doesn't exclude the emergency accounts. Matches the exam's hotspot questions.
4. **Put it in order**: drag steps into the right order, such as a safe MFA rollout. Matches the exam's drag-and-drop questions.
5. **Practice exam**: mixed questions plus a case-study scenario. I unlock it myself; it's never pushed on me. Untimed by default, with an optional timer.
6. **Glossary**: the concepts I've met, each with the three layers and a Microsoft Learn link.

## 6. The curriculum

Nine chapters, about 30 tickets of 10 to 15 minutes each. Chapter 1 teaches the app itself with no stakes. Before writing content, check the topics against the official SC-300 study guide (https://learn.microsoft.com/en-us/credentials/certifications/resources/study-guides/sc-300), because it changes. The exam's four skill areas: implement and manage user identities; implement authentication and access management (the largest); plan and implement workload identities; plan and automate identity governance.

| # | Chapter | Tickets | Exam area | Status |
|---|---|---|---|---|
| 1 | First week | Find who changed a setting (audit log); a new hire can't sign in (user, license, group) | Users | New |
| 2 | Users and groups | Dynamic group for the Brno plant; group-based licensing; let a Brno helper reset passwords only for Brno (administrative units, least-privilege roles) | Users | New |
| 3 | The Brno plant | The floor can't sign in (named and trusted locations); the copier and legacy authentication | Auth | Exists (cases 1–2) |
| 4 | MFA for everyone | Security keys and Temporary Access Pass for the floor; MFA on safely (report-only, What If); admins on phishing-resistant MFA; self-service password reset and password protection | Auth | 3 exist (cases 3–5), 1 new |
| 5 | Guests and partners | A supplier can't join a meeting (B2B invitation, guest MFA); limit who can invite guests; trust a partner's MFA (cross-tenant access settings) | Users | New |
| 6 | Hybrid identity | A name change in AD doesn't reach the cloud (sync); password hash sync vs pass-through authentication; a sync error from a duplicate attribute | Users | New |
| 7 | Risk and protection | Leaked credentials (ID Protection, user risk policy); sign-in risk policy; sign-in frequency for shared kiosks (session controls); replace the VPN to the MES server (Global Secure Access) | Auth | New |
| 8 | The new apps | Fieldline single sign-on; who gets in and as what; MES-Export's expiring secret; someone consented to an unknown app (consent, admin consent workflow); an on-premises dashboard for remote staff (Application Proxy); provisioning users to Fieldline | Workload | 3 exist (cases 6–8), 3 new |
| 9 | Keeping access right | Just-in-time admin (PIM); quarterly review of guest and Fieldline access (access reviews); an access package for contractors (entitlement management); Dana's offboarding done right (lifecycle workflows); alerts on emergency account sign-ins (monitoring, Log Analytics) | Governance | New |

End each chapter with a **mixed shift**: two or three short tickets from that chapter in random order, in Solo mode, to prove it stuck.

## 7. Look and feel

- Model the screens on the real Microsoft Entra admin center, simplified: the same names (Users, Groups, Conditional Access, Named locations, Sign-in logs, Enterprise applications, App registrations), the same portal paths and the same sign-in log tabs, so what I learn transfers to my job.
- Calm: a soft neutral background, one accent color, and red only on the specific thing being investigated. Readable type (Atkinson Hyperlegible from the original is a good body font). No uppercase monospace labels everywhere, no emoji, no dotted underlines on every term.
- One primary button per screen.
- Phone first. On desktop, the panel docks beside the ticket.

## 8. Technical notes

- A single-page HTML artifact on claude.ai. Load the `artifact-design` and `artifact-capabilities` skills before writing it.
- Save progress to localStorage, and also to the artifact's `db` capability under `data/users/<id>/` (with the `user` capability) so it follows me between my phone and computer. Keep each document under 256 KB; one document per ticket works.
- Keep the source split into files in `src/` with a small build script. Publish the built file, and commit a standalone copy.
- Every ticket needs engine tests: the starting tenant is unsolved, the intended fix solves it, and the common wrong fixes show their consequences. Do a browser playthrough of each ticket at phone and desktop widths before publishing.
- Accuracy over volume: check Entra behavior and error codes against Microsoft Learn, give every concept a Learn link, and never invent product behavior.

## 9. How to work with me

- **Phase 1:** the app shell, the home screen, the guide system (all three modes, the coach strip, "What am I looking at?", the runbook), Chapter 1, and the existing eight tickets moved into the new format with Shadow scripts. Then stop, publish, and send me the link with three short questions about how it felt.
- **After that, one chapter at a time** in the order above, publishing after each.
- Keep your messages to me short and plain. I'm new to this role, so explain decisions in a sentence or two.
