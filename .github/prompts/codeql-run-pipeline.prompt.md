---
mode: agent
description: Run the agentic CodeQL pipeline (DETECT → PROPOSE → VERIFY → Finalize) end-to-end in a single orchestrator session.
---

Run the agentic CodeQL pipeline end-to-end in this single session: execute DETECT → PROPOSE → VERIFY → Finalize by loading and following each phase skill inline (`.github/skills/codeql-detect/SKILL.md`, then `.github/skills/codeql-propose/SKILL.md`, then `.github/skills/codeql-verify/SKILL.md`, then `node .github/scripts/finalize-verified-model-pack.js`).

Rules:

- Do not ask me to switch agents.
- Do not pause for per-command confirmation.
- If running locally with no phase PR on GitHub, skip the finalize step and report it.
- Re-read the last `status:` / `next:` lines in `docs/codeql-gap-analysis.md` between phases and proceed per the orchestrator state table in `.github/skills/codeql-orchestrate/SKILL.md`.
- Stop and surface the blocker if any phase yields `VERIFICATION_BLOCKED` or `VERIFICATION_FAILED`.

Final output: one summary listing per-phase outcomes (files written, counts), the final `status:` / `next:` from `docs/codeql-gap-analysis.md`, and the finalize result (or the local-only skip note).
