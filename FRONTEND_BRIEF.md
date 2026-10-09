# Frontend brief: SpiderSense dashboard (for the cloud session)

**Who does what:** the dashboard is built by an AI coding agent (you, a Claude Code cloud session) and **managed by abeltjoseph2005-art**, who runs this session and answers your questions. The backend is written by hand by **muhyudheen** (the repo owner).

You build the **dashboard** (React + Vite) in `frontend/`. The backend (FastAPI, in `backend/`) is being built **at the same time** in another session, so **build against the mock data below first**, then connect to the real API at the agreed time. Read `PLAN.md` (the product) and `README.md` first.

Event: TatHack '26 finale, 30-hour build, **judges visit every 4 hours**. **First checkpoint: CP1 at 15:00 IST, 9 Oct.** Everything listed for CP1 must work by **14:45**.

## Rules (the owner set these)
1. **Only touch `frontend/`.** Never edit `backend/`, `PLAN.md`, `README.md`, `AI_USAGE.md` or `CLAUDE_MINUTES.md`. If you need a backend change, say so in your report.
2. **Commit messages are pre-approved.** Use exactly the ones listed under "Commits" below, one commit per step. If you need a different commit, stop and ask the owner. **No `Co-Authored-By` line.**
3. **Git:** work on `master`. Before every push, run `git pull --rebase origin master` (the backend session pushes `backend/` to the same branch; the folders don't overlap). If the push is refused (403), stop and report; don't create workarounds.
4. **Dependencies:** only the standard Vite React template (`react`, `react-dom`, `vite`, `@vitejs/plugin-react`). **No chart, UI or CSS libraries.** Charts are plain SVG. Ask before adding anything else.
5. **Every number on screen comes from the API response**, never hardcoded. No fake banners like "THREAT DETECTED". The mock file exists only for development.
6. **Never print, log or commit secrets.** There is no key in the frontend at all.
7. **Report every step in `frontend/CLOUD_REPORT.md`**, inside the same commit as the step, so it can be reviewed from the repo. Append a section per commit: the time (IST), the commit message, **what you built**, **files changed**, **how you checked it** (build, tests, what you saw), **open problems**, and **anything the backend needs**. Also give the same summary in chat to abeltjoseph2005-art. The owner reviews these reports and logs AI usage from them.

## Commits (pre-approved, in order)
1. `Add frontend skeleton (React + Vite)`
2. `Add upload page and status header`
3. `Add findings list and D1 chart`
4. `Connect dashboard to the audit API`

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
