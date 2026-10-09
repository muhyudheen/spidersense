# Frontend brief: SpiderSense dashboard (for the cloud session)

**Who does what:** the dashboard is built by an AI coding agent (you, a Claude Code cloud session) and **managed by abeltjoseph2005-art**, who runs this session and answers your questions. The backend is written by hand by **muhyudheen** (the repo owner).

You build the **dashboard** (React + Vite) in `frontend/`. The backend (FastAPI, in `backend/`) is being built **at the same time** in another session, so **build against the mock data below first**, then connect to the real API at the agreed time. Read `PLAN.md` (the product) and `README.md` first.

Event: TatHack '26 finale, 30-hour build, **judges visit every 4 hours**. **First checkpoint: CP1 at 15:00 IST, 9 Oct.** Everything listed for CP1 must work by **14:45**.

## Rules (the owner set these)
1. **Only touch `frontend/`.** Never edit `backend/`, `PLAN.md` or `README.md`. If you need a backend change, say so in your report.
2. **Commit messages follow Conventional Commits** (judges check this): `type(scope): description`, lowercase, imperative, e.g. `feat(dashboard): add guard page with audit log`. Types: `feat`, `fix`, `test`, `docs`, `chore`, `refactor`. Use the pre-approved messages under "Commits" below; for anything else, ask first. Never reuse a message for two commits. **No `Co-Authored-By` line.**
3. **Git: branches and pull requests.** The default branch is **`main`** (`master` no longer exists). Never commit to `main` directly. For each piece of work, branch from the latest `main` (`feat/dashboard-<topic>`), commit there, push the branch, and open a **pull request into `main`** with a short description. **abeltjoseph2005-art reviews and merges it** (a merge commit, so the branch stays visible in the history). After a merge, start the next branch from the updated `main`. If a push is refused (403), stop and report; don't create workarounds.
4. **Dependencies:** only the standard Vite React template (`react`, `react-dom`, `vite`, `@vitejs/plugin-react`). **No chart, UI or CSS libraries.** Charts are plain SVG. Ask before adding anything else.
5. **Every number on screen comes from the API response**, never hardcoded. No fake banners like "THREAT DETECTED". The mock file exists only for development.
6. **Never print, log or commit secrets.** There is no key in the frontend at all.
7. **Report every step in `frontend/CLOUD_REPORT.md`**, inside the same commit as the step, so it can be reviewed from the repo. Append a section per commit: the time (IST), the commit message, **what you built**, **files changed**, **how you checked it** (build, tests, what you saw), **open problems**, and **anything the backend needs**. Also give the same summary in chat to abeltjoseph2005-art. The owner reviews these reports and logs AI usage from them.

## Commits (pre-approved, in order)
**Done before CP1** (old message style): skeleton, upload page and status header, findings list and D1 chart, API connection.

**Next, after CP1** (Conventional Commits; the API contracts for these pages are added to this brief before you start them):
1. `feat(dashboard): add agent page with live tool-call trace` (branch `feat/dashboard-agent`, CP2)
2. `feat(dashboard): add guard page with policy table and audit log` (branch `feat/dashboard-guard`, CP3)
3. `fix(dashboard): …` for fixes, one per problem, each with a specific description

## Timeline
| When (IST) | Step | Commit |
|---|---|---|
| now → 12:30 | Vite React app in `frontend/`, dev proxy, layout (header + sidebar + main), dark theme | 1 |
| 12:30 → 13:30 | Upload page + status header (tingling/calm pill) working on mock data | 2 |
| 13:30 → 14:15 | Findings list + finding detail + **D1 bar chart** on mock data | 3 |
| **14:15 → 14:45** | **Connect to the real API** (the backend will be up locally by then); handle errors and loading | 4 |
| 14:45 → 15:00 | Freeze; the owner rehearses CP1 |  |

## Layout
```
┌──────────────────────────────────────────────────────────────────────┐
│ 🕷️ SpiderSense            [🔴 TINGLING · 2 findings]   (or 🟢 CALM)   │
├────────────┬─────────────────────────────────────────────────────────┤
│ ▸ Audit    │  page content                                           │
│ ▸ Findings │                                                         │
└────────────┴─────────────────────────────────────────────────────────┘
```
Later checkpoints add Fix Agent, LeakBench and Report pages. Make the sidebar easy to extend, but **don't build those yet**.

### Audit page (CP1)
- **Demo buttons at the top:** one per entry of `GET /api/demo-datasets`, e.g. "Load prelim model data". Clicking calls `POST /api/audit/demo/{name}`. These are what judges will see, so make them prominent.
- **Upload:** drag-and-drop or a file picker for one `.csv`. Read the **header line in the browser** (FileReader: the first line, split on commas, handling quoted names) to fill the dropdowns:
  - **Target column** (required)
  - **Split column** (optional, values like train/test)
  - **Group column** (optional)
  - **Time column** (optional, not used until CP2; show it anyway)
- A **Run audit** button → `POST /api/audit` → go to Findings.
- A loading state ("Spider-sense tingling…") and clear error messages from the API's `detail` field.

### Status header (always visible)
`status: "tingling"` → a red pill "TINGLING · N findings". `status: "calm"` → a green pill "CALM · no findings". Before any audit: a grey "No audit yet".

### Findings page (CP1)
- **Summary line:** dataset name, row count, target, task type, counts by severity.
- **Finding cards**, sorted by severity (high, medium, low): severity badge, check ID (`D1`), title, one-line summary, location (column name).
- **Clicking a card** opens its detail: summary, evidence (key/value table), suggested fix.
- **D1 bar chart (the CP1 highlight).** It shows when `d1_scores` is present, **even with no findings** (on clean data it shows that no feature stands out):
  - one horizontal bar per feature, sorted descending, labelled with the feature name and score
  - a dashed **threshold** line
  - flagged features in red, others grey
  - axis from 0 to 1, with the metric name (AUC or R²) in the title
  - pure SVG, readable on a projector: large text, high contrast

## API contract (agreed with the backend)
The Vite dev server proxies `/api` → `http://127.0.0.1:8000`. Base path: `/api`.

**`GET /api/health`** → `{"status": "ok", "version": "0.1.0"}`

**`GET /api/demo-datasets`** →
```json
[{"name": "prelim", "title": "TatHack prelim delay model data", "target": "Delay_Hours",
  "description": "The organizers' prelim training data, 5,000-row sample"},
 {"name": "titanic", "title": "Titanic (full passenger list)", "target": "survived",
  "description": "The famous dataset; its boat and body columns give the answer away"},
 {"name": "breast_cancer", "title": "Clean control (breast cancer)", "target": "target",
  "description": "A well-known clean dataset; nothing should be flagged"}]
```

**`POST /api/audit`**: `multipart/form-data` with fields `file` (the CSV), `target` (string), and optional `split_col`, `group_col`, `time_col` (omit if not chosen).
**`POST /api/audit/demo/{name}`**: no body. Same response.

**Response** (both endpoints):
```json
{
  "audit_id": "a1b2c3",
  "dataset": {"name": "prelim", "rows": 5000, "columns": 7, "target": "Delay_Hours",
              "task": "regression"},
  "status": "tingling",
  "counts": {"high": 1, "medium": 0, "low": 0},
  "findings": [
    {
      "id": "D1-1",
      "check": "D1",
      "title": "Target leakage: NLP_Severity_Score predicts the target almost by itself",
      "severity": "high",
      "summary": "Using only NLP_Severity_Score, a tiny model reaches R² 0.83; the next-best column reaches 0.21.",
      "evidence": {"metric": "R2", "score": 0.83, "next_best_column": "Transport_Mode",
                   "next_best_score": 0.21, "threshold": 0.6},
      "location": {"column": "NLP_Severity_Score"},
      "fix": "Check how NLP_Severity_Score is computed. If it uses the target or information from after the prediction time, remove it."
    }
  ],
  "d1_scores": {
    "metric": "R2",
    "threshold": 0.6,
    "features": [
      {"name": "NLP_Severity_Score", "score": 0.83, "flagged": true},
      {"name": "Transport_Mode", "score": 0.21, "flagged": false},
      {"name": "Origin_Node", "score": 0.19, "flagged": false},
      {"name": "Destination_Node", "score": 0.05, "flagged": false},
      {"name": "Condition_Flag", "score": 0.0, "flagged": false},
      {"name": "Leg_Type", "score": 0.17, "flagged": false}
    ]
  }
}
```
- **The numbers above are mock values for development only.** Real values come from the backend.
- `severity` is one of `high`, `medium`, `low`. `status` is `tingling` or `calm`. `task` is `classification` or `regression`. `metric` is `AUC` or `R2`.
- `evidence` keys vary by check: render them generically as a key/value table.
- `d1_scores` can be `null`. Then hide the chart.
- Errors: HTTP 400/422 with `{"detail": "message"}`. Show the message.

Put this mock response in `frontend/src/mock/audit_prelim.json`, plus a calm variant (empty findings, `status: "calm"`, all bars grey), and use them until 14:15.

## Done for CP1 when
- `npm run build` succeeds, and `npm run dev` shows the app.
- All three demo buttons work against the real backend: prelim and titanic → tingling with the D1 bar chart, breast_cancer → calm.
- Uploading a CSV and picking a target works end to end.
- It's readable on a projector, and nothing is hardcoded.

---

# CP2: Agent page (branch `feat/dashboard-agent`, commit `feat(dashboard): add agent page with live tool-call trace`)

**Goal for judges at 19:00:** "Ask SpiderSense to audit a dataset, and watch the agent plan, call the checks as tools, and report." The SpiderSense Agent (Gemini) decides **which tool to call and why**; the tools (our deterministic checks) decide **what is a finding**. Every tool call carries a **guard decision** (allowed or denied), the first piece of the SpiderSense Guard (CP3).

## Agent API contract
**`POST /api/agent/demo/{name}`**: form field `goal` (optional; default "Audit this dataset for silent ML bugs.").
**`POST /api/agent`**: multipart with `file` (CSV), `target`, and optional `goal`.

Response:
```json
{
  "run_id": "9f2c1a7b",
  "goal": "Audit this dataset for silent ML bugs.",
  "mode": "llm",
  "model": "gemini-3.5-flash-lite",
  "steps": [
    {"n": 1, "type": "thought", "text": "I am checking the dataset profile to understand its structure."},
    {"n": 2, "type": "tool_call", "tool": "profile_dataset", "args": {},
     "guard": {"decision": "allowed", "reason": "on the allowlist"}},
    {"n": 3, "type": "tool_result", "tool": "profile_dataset",
     "result": {"rows": 1309, "target": "survived", "task": "classification",
                "columns": {"pclass": {"type": "int64", "missing": 0}}}},
    {"n": 4, "type": "thought", "text": "I am running the target-leakage check."},
    {"n": 5, "type": "tool_call", "tool": "run_d1", "args": {},
     "guard": {"decision": "allowed", "reason": "on the allowlist"}},
    {"n": 6, "type": "tool_result", "tool": "run_d1",
     "result": {"findings": [{"id": "D1-1", "column": "boat", "summary": "Scrambling boat wipes out 0.71 of the model's skill…"}]}},
    {"n": 7, "type": "final", "text": "Target leakage found: the boat column gives the answer away…"}
  ],
  "audit": { "…": "exactly the same object as the POST /api/audit response (status, counts, findings, d1_scores)" }
}
```
- `mode`: `"llm"` (Gemini planned the audit) or `"offline"` (Gemini unreachable, so a fixed plan ran with template text; `model` is then `null`).
- Step `type`: `thought` (the agent's reason), `tool_call` (tool, args, guard), `tool_result` (tool, result), `final` (summary). Steps are in order; `n` starts at 1.
- `guard.decision`: `"allowed"` or `"denied"`, plus a `reason`. A denied call's `tool_result` is `{"error": "denied by the SpiderSense Guard"}`.
- The `final` text may contain simple Markdown (`**bold**`, `*` bullets): render bold and bullets, or show it as plain text. **Never render it as HTML.** It's LLM output.
- **Timing:** a run takes about 5–40 seconds (it depends on Gemini's load). The offline plan takes about 3 seconds.

## Agent page
- **Demo buttons** (same list as the Audit page) and an **upload + target** option, plus a **goal** text box prefilled with the default.
- **While running:** "SpiderSense agent is thinking…" with a spinner and the elapsed seconds. It can take up to about 40 s, so make the waiting feel alive.
- **The trace:** a vertical timeline, one row per step, appearing one after another (about 300 ms apart) when the response arrives:
  - `thought`: an italic speech line with a 💭 icon
  - `tool_call`: the tool name in monospace, the args, and a **guard badge** (green ALLOWED or red DENIED, with the reason as a tooltip)
  - `tool_result`: collapsible; a one-line summary (e.g. "1 finding: boat" or "1,309 rows, 14 columns"), with the full JSON on click
  - `final`: a highlighted summary box
- **The header:** the mode badge (`LLM · gemini-3.5-flash-lite`, or `OFFLINE PLAN` in amber) and the run id.
- **Below the trace:** the same findings summary, D1 chart and status pill as the Findings page, from `audit` (reuse the components).
- **Sidebar:** add "Agent" between Audit and Findings.

## Done for CP2 when
- `npm test` and `npm run build` pass (mock the agent response in tests: one `llm` run, one `offline` run, and one with a DENIED step).
- On the laptop with the real backend: the titanic agent run shows the trace and finds `boat`; breast_cancer comes back calm.
- PR from `feat/dashboard-agent` into `main`, reviewed and merged by Abel.

---

# CP2 polish: a safety-first look (branch `feat/dashboard-safety-ui`, commit `feat(dashboard): reframe the dashboard around ai safety`)

**Why:** the judges score Track 2, *Safe & Trustworthy AI*. Today the dashboard looks like a data-quality tool. The same features need to *look* like safety. No backend change is needed: everything comes from the existing API.

## What changes
1. **Home / Audit page header:** "SpiderSense: an AI safety guard for machine learning", with a one-line subtitle: "Catches models that cheat, data that leaks, and agents that misbehave."
2. **Three safety panels** at the top of the Findings page and under the agent trace, filled from `audit.findings` by `check`:
   - 🧪 **Model trust:** D1 findings (target leakage). Shows the count, or "No leak found" in green.
   - 🔒 **Data privacy:** D9 findings (secrets and personal data). Shows the count and the kinds found (e.g. "600 emails · 43 credentials · 20 card numbers").
   - 🛡️ **Agent firewall:** from an agent run's steps: tool calls allowed vs denied (e.g. "3 allowed · 0 denied"). On the plain Audit page: "Run the agent to see the firewall".
3. **D9 findings display:** `evidence.found` (an object of kind → count) as small chips; `evidence.masked_samples` (a list of strings) as monospace chips with a 🔒 icon; `evidence.share_of_rows` as a percentage. Never show anything except what the API returns (it's already masked).
4. **Demo buttons:** the new `customers` demo appears automatically from `/api/demo-datasets`. Give each demo a small tag: prelim and titanic → "answer leakage", customers → "privacy leak", breast_cancer → "clean". Use a lookup with a neutral fallback for unknown names.
5. **Layout:** after a run, collapse the input area (goal, demo buttons, upload) into a one-line summary with an "Edit" button, so the trace and findings fit on a 1366×768 projector without scrolling.
6. **Visual polish:** a consistent dark theme with one accent colour (spider red `#e23b3b` for TINGLING, green for CALM, amber for OFFLINE), larger headings, more spacing, and no clutter. Readable from the back of a room.

## Done when
- `npm test` and `npm run build` pass. New tests cover the panel counts (D1 only, D9 only, both, none), the D9 evidence chips, and the demo tags.
- Report in CLOUD_REPORT.md, then a PR from `feat/dashboard-safety-ui` into `main` for Abel to review and merge, **by 18:45**.
