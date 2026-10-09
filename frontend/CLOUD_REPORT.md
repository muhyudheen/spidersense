# Cloud session report (frontend)

The dashboard in `frontend/` is built by a Claude Code cloud session, managed by abeltjoseph2005-art, following `FRONTEND_BRIEF.md`. One section per commit.

---

## Commit 1 · 12:07 IST, 9 Oct
**Commit message:** `Add frontend skeleton (React + Vite)`

**What I built**
- A Vite + React app in `frontend/` with only the four allowed packages, pinned to exact versions: `react` 19.3.0, `react-dom` 19.3.0, `vite` 8.3.1, `@vitejs/plugin-react` 6.1.1. I picked releases at least two weeks old rather than yesterday's `vite` 8.3.4.
- A dev proxy: `/api` → `http://127.0.0.1:8000` (`vite.config.js`).
- The layout: header (🕷️ SpiderSense) across the top, sidebar on the left, page content on the right. Dark theme, 18 px base text and high contrast for the projector. On narrow screens the sidebar becomes a row under the header.
- The sidebar reads from one list (`src/pages/index.js`), so adding Fix Agent, LeakBench or Report later is one line each. Only Audit and Findings exist; both are placeholders until commits 2 and 3.

**Files changed** (all new)
- `frontend/package.json`, `frontend/package-lock.json`, `frontend/.gitignore` (`node_modules/`, `dist/`)
- `frontend/vite.config.js`, `frontend/index.html`
- `frontend/src/main.jsx`, `frontend/src/App.jsx`, `frontend/src/styles.css`
- `frontend/src/pages/index.js`, `frontend/src/pages/AuditPage.jsx`, `frontend/src/pages/FindingsPage.jsx`
- `frontend/CLOUD_REPORT.md` (this file)

**How I checked it**
- `npm install`: 0 vulnerabilities. `npm run build`: succeeds (JS 220.6 kB, 69.0 kB gzipped).
- `npm run dev`, then a headless Chromium check: header shows "🕷️ SpiderSense", the sidebar shows Audit and Findings, clicking Findings switches the page, and there are no console errors.

**Open problems**
- None. The status pill in the header comes in commit 2, as the brief orders.

**What the backend needs**
- Nothing yet. From 14:15 the dashboard expects FastAPI on `127.0.0.1:8000` with the endpoints in the brief's API contract (`/api/health`, `/api/demo-datasets`, `/api/audit`, `/api/audit/demo/{name}`).

---

## Commit 2 · 12:09 IST, 9 Oct
**Commit message:** `Add upload page and status header`

**What I built**
- **Status pill** in the header, always visible: grey "No audit yet" before any audit, red "TINGLING · N findings" (pulsing dot) when `status` is `tingling`, green "CALM · no findings" when `calm`. N is the length of the response's `findings` list.
- **Audit page:**
  - **Demo buttons** at the top, one large card per entry of `GET /api/demo-datasets`, showing title, description and target. A click calls `POST /api/audit/demo/{name}`.
  - **Upload:** drag and drop, or click to pick one `.csv`. Only the first 64 KB is read in the browser to get the header line. Quoted names (`"Delay, Hours"`), doubled quotes, CRLF and a BOM are handled, and empty names (e.g. a pandas index column) are dropped. A non-`.csv` file gets a clear error.
  - **Dropdowns:** Target (required), and Split, Group and Time (optional, "None" by default). The optional lists exclude the target column, and picking a column as target clears it from the optional ones.
  - **Run audit** stays disabled until a target is chosen. It sends `POST /api/audit` as multipart with `file`, `target` and only the optional columns that were chosen.
  - While a request runs: "Spider-sense tingling…" with a spinner, and all buttons disabled. On success the app goes to Findings.
- **API layer** (`src/api.js`): one place for all calls. Errors show the API's `detail` (a string, or a 422 list shown as `field: message`); with no `detail` they show "Request failed (HTTP n)", and with no response "Could not reach the backend". It runs on the mock responses (`USE_MOCK = true`, with a 0.6 s delay so the loading state is visible) until commit 4.
- **Mock data** (`src/mock/`): `audit_prelim.json` (the brief's response, verbatim), `audit_calm.json` (empty findings, `status: "calm"`, all bars unflagged), `demo_datasets.json` (the brief's list). Development only; nothing reads them after commit 4.
- The Findings page shows which dataset is loaded; the list and chart are commit 3.

**Files changed**
- New: `frontend/src/api.js`, `frontend/src/lib.js` (pure helpers), `frontend/src/StatusPill.jsx`, `frontend/src/mock/audit_prelim.json`, `frontend/src/mock/audit_calm.json`, `frontend/src/mock/demo_datasets.json`, `frontend/tests/lib.test.js`
- Changed: `frontend/src/App.jsx` (holds the audit result, shows the pill), `frontend/src/pages/AuditPage.jsx`, `frontend/src/pages/FindingsPage.jsx`, `frontend/src/styles.css`, `frontend/package.json` (a `test` script using Node's built-in runner, no new package), `frontend/CLOUD_REPORT.md`

**How I checked it**
- `npm test`: 5/5 pass (CSV header parsing, error messages, pill text including "1 finding" vs "2 findings").
- `npm run build`: succeeds.
- Headless Chromium on `npm run dev`, with no console errors:
  - Pill shows "No audit yet".
  - Both demo cards appear; clicking prelim shows "Spider-sense tingling…", then Findings with a red "TINGLING · 1 finding"; clicking clean gives a green "CALM · no findings".
  - A `.txt` file gets the error; a CSV with a quoted `"Delay, Hours"` header gives 5 columns in the Target list.
  - Run audit is disabled until a target is chosen, and a target is removed from the optional lists.

**Open problems**
- Nothing touches the real backend yet (mock until 14:15, as planned).
- The status pill counts `findings.length`. If the backend ever caps the list, the pill should use `counts` instead; I'll match whatever the real response does.

**What the backend needs**
- `GET /api/demo-datasets` and both audit endpoints as in the brief. For uploads, the multipart field names are exactly `file`, `target`, `split_col`, `group_col`, `time_col`, and unchosen optional fields are **left out**, not sent empty.
- Errors as `{"detail": "..."}` with HTTP 400/422, e.g. "Target column 'x' not found".
- **Heads-up on the clean demo:** on the breast-cancer data, single features alone reach high AUC (around 0.9 or more for a few "worst …" columns, which is real signal, not leakage). If D1 uses only a fixed AUC threshold like 0.6, the clean control will turn **tingling**. A relative rule (far stronger than the next-best feature) or a higher threshold for AUC would keep it calm. The calm mock assumes that, so its numbers are placeholders.

---

## Commit 3 · 12:11 IST, 9 Oct
**Commit message:** `Add findings list and D1 chart`

**What I built**
- **Summary line** at the top of Findings, all from the response:
  - dataset name, row count, target, task;
  - counts by severity from `counts` (high red, medium amber, low blue).
- **Finding cards**, sorted high → medium → low (the API's order is kept within a severity). Each card shows:
  - severity badge, check ID (`D1`), title, one-line summary;
  - location: every key of `location` is shown, so a later `{file, line}` works without a change.
- **Finding detail:** clicking a card's header opens it in place (and clicking again closes it). It shows:
  - **Evidence** as a generic key/value table (any keys; non-text values shown as JSON);
  - **Suggested fix**.
  - A new audit starts with every card closed.
- With no findings: a green "No findings for this dataset." line.
- **D1 bar chart** (`src/D1Chart.jsx`), pure SVG, no library. It shows whenever `d1_scores` is present, including on calm data, and is hidden when it's `null`.
  - One horizontal bar per feature, highest score first, each labelled with its name and score.
  - Flagged features in red (name, bar and score), the others grey. The legend counts each.
  - A dashed threshold line with its value, and an axis from 0 to 1 with ticks every 0.25.
  - The title carries the metric (`R2` is shown as R², `AUC` as is).
  - Sized for a projector: 20 px labels, high contrast, scales to the page width. Names over 30 characters are shortened, and the full name is in the hover tooltip.

**Files changed**
- New: `frontend/src/D1Chart.jsx`
- Changed: `frontend/src/pages/FindingsPage.jsx`, `frontend/src/lib.js` (`sortFindings`, `metricLabel`, `evidenceValue`, `d1Bars`), `frontend/tests/lib.test.js`, `frontend/src/styles.css`, `frontend/CLOUD_REPORT.md`

**How I checked it**
- `npm test`: 8/8 pass, including the new tests:
  - severity sort order;
  - R² label;
  - evidence formatting;
  - bars sorted descending, with negative scores (possible for R²) drawn at 0 width but labelled with their real value.
- `npm run build`: succeeds.
- Headless Chromium on the mock data, with no console errors:
  - **Prelim:** the summary reads "prelim · 5,000 rows · target Delay_Hours · regression · 1 high 0 medium 0 low". One HIGH D1 card; detail is closed until clicked, then shows 5 evidence rows and the fix. The chart shows 6 bars, NLP_Severity_Score first and red at 0.83, past the dashed line at 0.6.
  - **Clean:** "No findings", a green pill, and 9 grey bars under an AUC title.
- I checked the screenshots for readability. Two problems found and fixed before committing: the longest bold label was clipped, and score labels collided with the threshold line. Scores now have a dark outline and sit on top of the line.

**Open problems**
- The page order is summary → findings → chart. On a 1280×800 screen with a card open, the chart needs a scroll; with cards closed it's visible. Tell me if the chart should go first for the demo.
- Still on mock data. The real API connection is commit 4 at 14:15.

**What the backend needs**
- `d1_scores.features` with `name`, `score` and `flagged` per feature, and `threshold` as a number. The chart draws no threshold line if it isn't a number, and sorts the bars itself, so the order doesn't matter.
- Scores rounded to 2 decimals in the response (the chart prints them as given, e.g. `0.8312345` would print in full).
- `counts` with all three keys (missing ones show 0).

---

## Commit 4 · 14:18 IST, 9 Oct
**Commit message:** `Connect dashboard to the audit API`

**Read this first:** at 14:16 `master` had the backend's environment (`backend/pyproject.toml`, `uv.lock`) and the demo CSVs, but **no API code yet** (no app, no endpoints). So I could **not** test against the real backend. I tested every call against a **contract stub**: a throwaway script in my scratch folder, **not committed**, that answers exactly as the brief's API contract says. When the real backend is on `master`, I'll run it here and check again.

**What I built**
- **Real API by default.** `src/api.js` now calls `/api/demo-datasets`, `POST /api/audit/demo/{name}` and `POST /api/audit` through the Vite proxy to `127.0.0.1:8000`.
  - The mock is used only when the dev server is started with `VITE_USE_MOCK=1 npm run dev`.
  - Then the page shows a dashed amber banner "Mock data …: these numbers are not from the backend", so mock numbers can't be mistaken for real ones.
  - The production build contains no mock data (checked: `Delay_Hours` doesn't appear in `dist/`).
- **Response check** (`checkAudit` in `src/lib.js`). If an audit response lacks a field the dashboard reads (`dataset.name/rows/target/task`, `status`, `counts`, `findings`, `d1_scores.features`), the page shows "Unexpected response from the backend: missing …" instead of going blank. This makes any contract mismatch quick to spot during integration.
- **Errors:**
  - The API's `detail` is shown as before.
  - A 5xx without `detail` adds "Is the backend running on port 8000?", because a stopped backend reaches the browser through the Vite proxy as HTTP 502.
  - The demo list gets a **Retry** button, so starting the backend after the page loads doesn't need a refresh.
- **Brief update followed:** `FRONTEND_BRIEF.md` now lists three demos (`prelim`, `titanic`, `breast_cancer`). The buttons come from the API, so no code change was needed; I updated the dev mocks to match (`breast_cancer` → calm).

**Files changed**
- `frontend/src/api.js`, `frontend/src/lib.js` (`checkAudit`, 5xx hint), `frontend/tests/lib.test.js`
- `frontend/src/App.jsx` (mock banner), `frontend/src/pages/AuditPage.jsx` (Retry), `frontend/src/styles.css`
- `frontend/src/mock/demo_datasets.json`, `frontend/src/mock/audit_calm.json` (renamed to the brief's new demo names)
- `frontend/CLOUD_REPORT.md`

**How I checked it**
- `npm test`: 9/9 pass (new: `checkAudit` accepts a contract response and names what's missing; the 5xx hint).
- `npm run build`: succeeds.
- Headless Chromium against the contract stub on port 8000, through the real Vite proxy, with no page errors:
  - **Demos:** 3 buttons from `GET /api/demo-datasets`. prelim → TINGLING with 6 bars (1 red); titanic → TINGLING; breast_cancer → CALM with 9 grey bars.
  - **Upload:** `POST /api/audit` was `multipart/form-data` with exactly `file`, `target`, `split_col`, `group_col`. The time column wasn't chosen, so it wasn't sent. The Findings page showed the uploaded file's name and target.
  - **A 400:** `{"detail": "Target column 'bad' has only one value"}` was shown word for word, and the page stayed on Audit.
  - **Backend stopped:** "Could not load the demo list: Request failed (HTTP 502). Is the backend running on port 8000?" Starting the stub and clicking Retry → 3 demo buttons.
  - **Mock mode** (`VITE_USE_MOCK=1`): the banner shows.

**Open problems**
- **Not yet checked against the real backend** (it has no endpoints on `master` yet). This is the CP1 risk: until `backend/` serves the API on port 8000, the Audit page shows the "backend running?" error.
- If the real backend differs from the contract, a fix would need a commit message that isn't on the pre-approved list, so I'll ask the owner first.

**What the backend needs (for CP1 at 15:00)**
- The four endpoints exactly as in the brief, on `127.0.0.1:8000`, with demo names `prelim`, `titanic`, `breast_cancer`.
- How to start it, so I can run it here and check end to end (e.g. `cd backend && uv run uvicorn main:app --port 8000`).
- Earlier points still stand:
  - multipart field names `file`, `target`, `split_col`, `group_col`, `time_col`;
  - errors as `{"detail": ...}`;
  - scores rounded to 2 decimals and all three `counts` keys;
  - D1 must not flag breast_cancer, whose single features reach high AUC legitimately.

---

## Commit 4, part 2 · 14:24 IST, 9 Oct
**Commit message:** `Connect dashboard to the audit API` (the same pre-approved message; see the note)

**Why there are two commits with this message:** part 1 (`7ab8176`, 14:18) was already pushed when Abel's instructions with the real backend's response shape arrived. Rewriting shared `master` (amend + force-push) could break the backend session's checkout, so this follow-up uses the same pre-approved message instead.

**What I built** (from Abel's instructions, which describe the real backend)
- **Real API only.** `src/api.js` no longer imports any mock and has no mock switch. Abel asked for `USE_MOCK = false`; removing the switch has the same effect and keeps `api.js` importable by the Node tests. All calls go to `/api` → Vite proxy → `127.0.0.1:8000`. The part-1 mock banner is gone.
- **Mocks match the real backend** (used **only in tests**):
  - `audit_prelim.json`: tingling, 1 HIGH on `NLP_Severity_Score`.
  - `audit_titanic.json` (new): tingling, 1 HIGH on `boat`; boat scores 0.71 and the other 12 columns ≤ 0.01.
  - `audit_calm.json`: breast_cancer, calm.
  - All three use the real D1 evidence keys (`metric`, `skill_with_all_columns`, `skill_lost_without_column`, `skill_lost_when_scrambled`, `threshold`), `d1_scores.metric` as a full label ("skill lost when scrambled (AUC)" / "(R2)") and threshold 0.2.
  - The numbers other than those Abel gave are placeholders shaped like the real ones.
- **Readable evidence labels:** keys show as "Skill lost when scrambled" (underscores to spaces, first letter capitalised). The table is still generic, so new keys need no code change.
- **Chart title** from `d1_scores.metric`: "D1 · Skill lost when scrambled (R²)". R2 is shown as R², the first letter capitalised. I removed my earlier subtitle, which described the old single-feature method.
- **Chart above the findings list**, fully visible without scrolling:
  - The legend now sits on the title row, and the spacing above the chart is tighter.
  - **At most 10 bars** are drawn. Every flagged bar is always drawn, and the rest are in a note such as "+3 more columns not drawn, none above 0", with their names and scores in the hover text. This keeps Titanic's 13 columns on a 1280×720 projector screen without shrinking the 20 px text.
  - With more than 8 bars the rows are tighter.
- **Backend not running:** "Backend not reachable: start it with uv run uvicorn main:app --port 8000 in backend/". This shows on a network error, or on a 502/503/504 without a JSON body, which is how the Vite proxy reports a stopped backend. A real 500 still shows "Request failed (HTTP 500)", so a backend crash isn't mistaken for "not running".
- **Loading:** "Spider-sense tingling…" with the spinner, unchanged. It covers the 1–5 s an audit takes.

**Files changed**
- `frontend/src/api.js`, `frontend/src/lib.js` (`BACKEND_DOWN`, `chartTitle`, `readableKey`, `visibleBars`, R² anywhere in a label)
- `frontend/src/D1Chart.jsx`, `frontend/src/pages/FindingsPage.jsx`, `frontend/src/App.jsx` (banner removed), `frontend/src/styles.css`
- `frontend/src/mock/audit_prelim.json`, `frontend/src/mock/audit_calm.json`, `frontend/src/mock/audit_titanic.json` (new)
- `frontend/tests/api.test.js` (new), `frontend/tests/lib.test.js`, `frontend/CLOUD_REPORT.md`

**How I checked it**
- **`npm test`: 19/19 pass.** The new `tests/api.test.js` runs the **real `api.js` code** with `fetch` replaced by a fake backend that answers with the updated mocks:
  - the demo list comes from `GET /api/demo-datasets` (prelim, titanic, breast_cancer);
  - prelim → tingling, 1 HIGH on NLP_Severity_Score, title "Skill lost when scrambled (R²)";
  - titanic → tingling, 1 HIGH on boat; boat is the only flagged bar, at the top, at 0.71; the others ≤ 0.01; threshold 0.2;
  - breast_cancer → calm, no findings, chart present with no flagged bars;
  - evidence keys → readable labels;
  - the upload sends multipart with exactly `file`, `target` and the chosen optional columns;
  - a 400/404 `detail` is shown word for word;
  - a network error and a 502 both give the "Backend not reachable…" message;
  - a response missing fields is reported, not rendered blank.
- **`npm run build`:** succeeds, and the production bundle contains no mock data.
- **Headless Chromium**, with a throwaway local stand-in on port 8000 serving the same mocks (not committed): all three demos at 1280×720, 1366×768 and 1920×1080, and **the chart is fully visible without scrolling in all 9 cases**. The evidence labels and pills are right, and there are no page errors.
- **Not checked against the real backend.** It runs on the owner's laptop and isn't reachable from the cloud. **The live end-to-end check is done on the laptop:** start the backend (`uv run uvicorn main:app --port 8000` in `backend/`) and the dashboard (`npm run dev` in `frontend/`), then click all three demos and upload one CSV.

**Open problems**
- The live check above is still to do on the laptop before 14:45.
- The chart draws at most 10 bars. A dataset with more columns shows the top 10 (and every flagged one) plus a "+N more" note. Tell me if judges should see every bar instead.
- Any further frontend change needs a commit message beyond the four pre-approved ones, so I'd ask the owner first.

**What the backend needs**
- To run on `127.0.0.1:8000` with the endpoints and demo names above. Errors as `{"detail": "..."}` so the dashboard shows the real reason.
- No other changes: the dashboard already handles the real evidence keys, the metric label and threshold 0.2.
