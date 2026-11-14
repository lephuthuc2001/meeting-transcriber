# AGENTS.md

Vietnamese meeting-transcription app: audio → Amazon Transcribe (`vi-VN`, speaker labels) → Claude rewrites it as a **Nghị quyết Chi bộ** (Party Branch Resolution), exported as Word `.doc`. UI strings are Vietnamese.

`pnpm dev` needs a running Amplify sandbox (`make run-dev` starts both): the sandbox generates the gitignored `amplify_outputs.json`, and without it uploads fail with "Chưa kết nối với máy chủ lưu trữ…".

- **Pipeline**: read `docs/pipeline.md` before touching a Lambda, `amplify/backend.ts`, or `MeetingJob` status.
- **Report**: read `docs/report.md` before touching the generation prompt or `lib/resolutionDoc.ts`.

## Agent skills

### Issue tracker

GitHub Issues on `lephuthuc2001/meeting-transcriber`, via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

The five default triage labels (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `GLOSSARY.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.
