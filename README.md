# Tallis Casebook (work in progress)

**Next:** the plan for the rebuild, including the guide system and the full curriculum, is in [`docs/rebuild-brief.md`](docs/rebuild-brief.md).

A calmer redesign of the Tallis Living Tenant SC-300 study game. The original is kept unchanged in `archive/tallis-living-tenant-original.html`.

## Why the redesign

The original opened every session on an emergency (red marks for every blocked person), offered about 37 controls at once, and had two overlapping ways to navigate (the map and the tabs), four or five levels deep. It also kept a clock running, so the world got worse between visits. The redesign keeps the real Conditional Access engine and the story, and changes how they're served:

- One ticket at a time, worked in the same five steps every time: Read, Investigate, Fix, Verify, Close.
- The home screen shows one next step, not the whole tenant.
- Evidence and tools open in one side panel. Editing is only possible in the Fix step.
- No running clock. Consequences play out when you close a case, and you can reopen it.
- Each case starts as if earlier ones were solved, so cases can be replayed in any order.
- A Review section with spaced exam-style questions and an honest map of what SC-300 covers that the cases don't.

## Status

Done and tested:

- `src/engine.js`, `src/ops.js`: the access engine and tenant changes.
- `src/knowledge.js`: 26 concept cards and 43 questions.
- `src/cases.js`: 8 cases with evidence, notes, hints, checks, replays and stamps.
- `tests/engine.test.mjs`: run `node tests/engine.test.mjs` (366 checks pass).

Written, not yet run in a browser:

- `src/app-state.js`, `src/ui-parts.js`, `src/ui-panels.js`, `src/ui-case.js`, `src/ui-home.js`, `src/ui-main.js`.

Still to do:

1. `src/styles.css` and `src/shell.html` (title, fonts, header, `#main`, `#panel` with `#panelTitle`, `#panelBack`, `#panelClose`, `#panelBody`, `#scrim`, `#toast`, nav buttons with `data-nav`).
2. A build script that joins the files in this order inside one `<script>`: engine, ops, knowledge, cases, app-state, ui-parts, ui-panels, ui-case, ui-home, ui-main.
3. A browser playthrough at phone and desktop widths, then publish it as an artifact.
