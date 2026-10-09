# 🕷️ SpiderSense

**Early warning for silently broken ML pipelines.**
*Spider-Man feels danger before he sees it. Your ML pipeline doesn't, until now.*

TatHack '26 finale · Track 2: **Safe & Trustworthy AI** · built during the 30-hour finale (9–10 Oct 2026)

> **Status: in development.** The 30-hour build started on 9 Oct, 11:00 IST. The roadmap below shows what's done and what's planned. Nothing here claims more than what's checked off.

---

## The problem
The most dangerous ML bugs don't crash. The model trains, the score looks great, the dashboard is green, and the model is wrong:

- **Target leakage:** a feature secretly computed from the answer, so the model "predicts" what it was already given.
- **Train/test contamination:** the same rows or customers in both sets, so the test score is inflated.
- **Broken evaluation:** a test set that's created but never scored; a random split on grouped or time-ordered data.
- **Unsafe model files:** a pickled model that runs arbitrary code the moment you load it.
- **Leaked secrets:** API keys, emails or phone numbers sitting in the training data, ready to be memorised or stolen.

**We've seen this first-hand.** In the TatHack '26 prelim we were handed a working delay-prediction model. Its "news severity" feature was computed from the very delay it predicted, its test split was never used, and it was split randomly on grouped data. It ran without a single error. We found it, and 130 other silent bugs, by hand. **SpiderSense automates that audit.**

## What SpiderSense does
Give it a dataset (and optionally the training script and model file). It:

1. **Detects** silent ML bugs with deterministic, reproducible checks.
2. **Shows the evidence:** numbers, rows and code line numbers, not vague warnings.
3. **Writes a failing test** for each bug, so the fix can be proven.
4. **Explains** each finding in plain English with an LLM that is **not allowed to make things up**.
5. **Helps fix it** with a tool-using agent that is **itself constrained**: a tool allowlist, budgets, and human approval.

## Design principles (why you can trust it)
| Principle | What it means |
|---|---|
| **The LLM never decides** | Every verdict comes from deterministic code: same input, same result. The LLM only explains. |
| **No hallucinated explanations** | The explainer must cite finding IDs, and every number it states must appear in the evidence. Anything else is dropped, and the drop count is shown. |
| **Uploads are untrusted** | Uploaded code is **never executed** (static analysis only). Model files are scanned **without being loaded**. Injection-like text in uploads is reported as a finding. |
| **Agents need guardrails** | The Fix Agent follows a policy table: **allow** (audit, run tests), **needs approval** (apply a patch), **deny** (shell, internet, deleting files). It has iteration and token budgets and shows a full tool-call trace. A human approves every patch, and LeakBench includes an attack that tries to make it break these rules. |
| **Works offline** | If the LLM API is unreachable, template explanations take over. The audit itself never needs the network. |
| **Numbers, not claims** | Detection quality is measured on a benchmark of planted bugs (LeakBench): recall per check, and false positives on clean pipelines. |

## Checks (planned)
| ID | Check | How |
|---|---|---|
| D1 | Target leakage | Each feature alone, in a cross-validated shallow model; flagged when it's "too good to be true" or far stronger than every other feature |
| D2 | Train/test contamination | Duplicate and near-duplicate rows across splits; the same entity in both splits |
| D3 | Temporal leakage | Training data from after the test period; features dated after the label |
| D4 | Preprocessing fitted before the split | Static analysis (Python AST) of the training script |
| D5 | Unseen categories silently mapped to a default | Data and code checks |
| D6 | Evaluation hygiene | Test set never scored; random split despite groups or time |
| D7 | Prediction-interval calibration | Quantile coverage vs. nominal |
| D8 | Unsafe model file | Pickle opcode scan for dangerous imports, without loading |
| D9 | Secrets and personal data in training data | Pattern scan per column (API keys, emails, phone and card numbers); samples are always masked |
| G1 | Hallucination guard for explanations | Citation and number validation |
| G2 | Prompt-injection guard | Uploads treated as data; injection attempts flagged |
| A1 | Fix Agent | Propose a patch → re-audit with our tools → at most 3 tries → human approval |

## Architecture
```
 Upload: dataset (+ target, split/group/time columns) · training script · model file
                                   │
        ┌──────────────────────────┼───────────────────────────┐
        ▼                          ▼                           ▼
  Data checks                Code checks                Model-file check
  (pandas, sklearn)          (Python AST, never run)    (pickle opcodes, never loaded)
        └──────────────────────────┼───────────────────────────┘
                                   ▼
          Findings {id, check, severity, evidence, location, fix}
                                   │
      ┌────────────────────┬───────┴────────────┬──────────────────────┐
      ▼                    ▼                    ▼                      ▼
 Generated tests    LLM explainer (Gemini)  Fix Agent (A1)        Dashboard + report
 (pytest)           behind G1/G2 guards     allowlist · budgets   "tingling" 🔴 / "calm" 🟢
                    template fallback       human approval
```

## Roadmap (judge checkpoints every 4 hours)
- [ ] **CP1:** upload a CSV → target leakage (D1) and contamination (D2) → findings on the dashboard; catches the prelim model's leaked feature
- [ ] **CP2:** temporal and evaluation checks, plus code analysis with line numbers (D3–D6)
- [ ] **CP3:** guarded LLM explanations (G1, G2) and report export
- [ ] **CP4:** LeakBench scoreboard, unsafe-pickle scanner (D8), secrets and personal-data scan (D9), evidence charts
- [ ] **CP5:** generated failing tests; Fix Agent with a visible trace; fix → re-audit → green
- [ ] **CP6:** calibration check (D7), a second real-world case, robustness
- [ ] **CP7:** feature freeze, documentation, demo

## Stack
Python 3.13 · FastAPI · pandas · scikit-learn · `ast` · `pickletools` · pytest · uv · React + Vite · Gemini API (OpenRouter and offline templates as fallbacks)

## Run it
*Setup instructions are added as the code lands.*

## Team
- **muhyudheen:** detectors, ML, LLM guards
- **abeltjoseph2005-art**

## AI disclosure
We use AI coding assistants during the build and Gemini inside the product (finding explanations). Every AI contribution is logged in [`AI_USAGE.md`](AI_USAGE.md). The team reviews, tests and can explain all code. The full plan is in [`PLAN.md`](PLAN.md).
