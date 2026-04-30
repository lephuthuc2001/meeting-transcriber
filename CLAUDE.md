# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Vietnamese meeting-transcription web app. Users upload meeting audio; AWS Transcribe produces a `vi-VN` transcript with speaker diarization; the Anthropic API rewrites it as a formatted **Nghị quyết Chi bộ** (Party Branch Resolution) document. Frontend UI strings are Vietnamese.

## Stack

- **Frontend**: Next.js 16 App Router, React 19, Tailwind v4, Radix UI primitives, `sonner` toasts
- **Backend**: AWS Amplify Gen 2 (`@aws-amplify/backend`)
- **AWS services**: Cognito, S3, DynamoDB (via AppSync/Data), Lambda, API Gateway REST, Amazon Transcribe
- **AI**: Anthropic Messages API directly via `fetch` (model `claude-sonnet-4-20250514`). The `@anthropic-ai/sdk` is a devDependency but not used at runtime in Lambdas.
- **Package manager**: pnpm 8.15.4 (pinned — `amplify.yml` installs this exact version)

## Commands

```bash
make run-dev          # checks AWS SSO, then runs `npx ampx sandbox` + `pnpm dev` concurrently
make login-aws-dev    # aws sso login --profile amplify-policy-075701661574
pnpm dev              # Next.js dev server only (sandbox must already be running, otherwise amplify_outputs.json is missing)
pnpm build            # next build
pnpm lint             # next lint
npx ampx sandbox --profile amplify-policy-075701661574  # provision/sync the per-developer cloud sandbox
```

There is no test runner configured.

The AWS profile `amplify-policy-075701661574` is hardcoded in [Makefile](Makefile). `make run-dev` is the standard local entry point.

## Architecture

### Data flow

1. Browser uploads audio → S3 `audio/{timestamp}-{name}` via Amplify Storage (guest auth).
2. Browser calls `POST /transcribe` → `start-transcription` Lambda starts an Amazon Transcribe job (`vi-VN`, `ShowSpeakerLabels: true`, `MaxSpeakerLabels: 10`). Output → `transcripts/{jobId}.json`.
3. Browser also writes a `MeetingJob` row to DynamoDB via the Amplify Data client (used for the history list).
4. Browser polls `GET /status?jobId=…` every 5s ([app/components/ProcessingStatus.tsx](app/components/ProcessingStatus.tsx)).
5. When Transcribe reports `COMPLETED`, the browser calls `POST /process` → `process-transcript` (dispatcher) verifies the transcript, deletes any stale report, then **invokes `process-transcript-worker` asynchronously** (`InvocationType: "Event"`) and returns `202` immediately.
6. Worker reads the transcript JSON, rebuilds it as speaker-labelled text via `buildSpeakerTranscript`, calls Anthropic with the `Nghị quyết Chi bộ` system prompt, and writes `reports/{jobId}.txt`.
7. Browser polling sees `reportReady: true` (status returns the report body) and shows it in `ReportViewer`.

### Why the dispatcher/worker split

Anthropic generation can exceed API Gateway's 29s timeout. `process-transcript` (`timeoutSeconds: 120`) only kicks off the work; `process-transcript-worker` (`timeoutSeconds: 600`) does the actual generation. **Don't fold them back together** — that's what commit `6c7edaa` fixed.

### Backend wiring lives in one file

[amplify/backend.ts](amplify/backend.ts) is where everything is glued together:
- All five Lambdas get S3 read/write + a `BUCKET_NAME` env var.
- Transcribe IAM policies are attached per-Lambda (start/check/cancel).
- The REST API Gateway and its four routes (`/transcribe`, `/status`, `/process`, `/cancel`) are defined here, not in any per-function file.
- The dispatcher gets `WORKER_FUNCTION_NAME` injected and `lambda.grantInvoke` on the worker.
- The API URL is exported via `backend.addOutput({ custom: { apiUrl } })` and read from `amplify_outputs.json` on the client as `(outputs as any).custom?.apiUrl`.

When adding a new Lambda or route, update `backend.ts` — there's no auto-discovery.

### Lambdas

Each Lambda has its own `resource.ts` (config) and `handler.ts` (code) under [amplify/functions/](amplify/functions/).

| Function | Trigger | Notes |
|---|---|---|
| `start-transcription` | API GW `POST /transcribe` | Generates `jobId` via `randomUUID()`, calls `StartTranscriptionJobCommand` |
| `check-status` | API GW `GET /status` | Checks Transcribe job, then S3 for the report. Falls back to S3-only when the Transcribe job has expired (`UNKNOWN` status). |
| `process-transcript` | API GW `POST /process` | Dispatcher only — verifies transcript exists, deletes prior report, invokes worker async, returns 202. |
| `process-transcript-worker` | `InvokeCommand` from dispatcher | Long-running. Reads `ANTHROPIC_API_KEY` from Amplify secret. Has the Vietnamese resolution prompt. Output is **plain text**, not Markdown. |
| `cancel-job` | API GW `POST /cancel` | Best-effort cleanup of Transcribe job + audio S3 object. |

The root [tsconfig.json](tsconfig.json) **excludes `amplify/`** — Lambdas are compiled by Amplify/esbuild against [amplify/tsconfig.json](amplify/tsconfig.json).

### S3 layout

- `audio/*` — uploads (guest read/write/delete)
- `transcripts/{jobId}.json` — raw Transcribe output (guest read)
- `reports/{jobId}.txt` — generated resolution (guest read). `check-status` also probes for `.html` for backwards compat.

### Data model

[amplify/data/resource.ts](amplify/data/resource.ts) defines a single `MeetingJob` model with `allow.publicApiKey()` auth, mode `apiKey` (30-day expiry). The frontend uses `generateClient<Schema>({ authMode: "apiKey" })`. There's no per-user authorization.

### Frontend structure

- [app/page.tsx](app/page.tsx) — single-page state machine (`idle | uploading | transcribing | processing | done`)
- [app/components/](app/components/) — feature components (`AudioUploader`, `ProcessingStatus`, `ReportViewer`, `JobHistory`)
- [components/ui/](components/ui/) — shadcn-style Radix wrappers
- [app/components/ConfigureAmplify.tsx](app/components/ConfigureAmplify.tsx) — `Amplify.configure(outputs)` runs on every page (it's in `layout.tsx`)
- [ReportViewer.tsx](app/components/ReportViewer.tsx) `handleDownloadDoc` builds a `.doc` (Word HTML) from the plain-text report by detecting Roman-numeral and numeric headers — keep the resolution prompt's structure stable when changing it.

## Gotchas

- **`amplify_outputs.json` is gitignored** and regenerated by `npx ampx sandbox`. The frontend imports it directly; without a running sandbox, storage/api URLs are missing and uploads fail with the Vietnamese "Chưa kết nối với máy chủ lưu trữ…" message.
- **`ANTHROPIC_API_KEY` is an Amplify secret**, set with `npx ampx sandbox secret set ANTHROPIC_API_KEY` (per-sandbox) or via the Amplify console for deployed branches. Both `process-transcript` and `process-transcript-worker` declare it but only the worker uses it.
- **The resolution prompt requires plain text output** — no Markdown, no HTML. The `.doc` exporter relies on this. If you change the prompt, preserve the section numbering convention (`I.`, `II.`, `III.` and `1.`, `2.` …) or `handleDownloadDoc` will mis-style headers.
- **Sections III. (Ý kiến thảo luận) and 4. (Kết luận và lưu ý khác) are intentionally *not* verbatim** — the prompt explicitly polishes them (commit `1aef59f`). Don't "fix" this back to verbatim.
- **DynamoDB writes happen client-side** (e.g. `AudioUploader` creates the `MeetingJob` row, `ProcessingStatus` updates status). Lambdas don't touch DynamoDB. Status truth comes from S3 + Transcribe; DynamoDB is for the history list.
- **`@/` alias** maps to repo root, so `@/amplify/data/resource` and `@/amplify_outputs.json` are normal client-side imports. The `amplify/` exclusion in tsconfig applies only to type-checking the Lambda code, not to importing the type-only `Schema` from data resource.
