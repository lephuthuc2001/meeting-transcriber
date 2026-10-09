# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Vietnamese meeting-transcription web app. Users upload meeting audio; AWS Transcribe produces a `vi-VN` transcript with speaker diarization; the Anthropic API rewrites it as a formatted **Nghị quyết Chi bộ** (Party Branch Resolution) document. Frontend UI strings are Vietnamese.

## Stack

- **Frontend**: Next.js 16 App Router, React 19, Tailwind v4, Radix UI primitives, `sonner` toasts
- **Backend**: AWS Amplify Gen 2 (`@aws-amplify/backend`)
- **AWS services**: Cognito, S3, DynamoDB (via AppSync/Data), Lambda, API Gateway REST, Amazon Transcribe
- **AI**: Anthropic Messages API directly via `fetch` (model `claude-sonnet-5`). The `@anthropic-ai/sdk` is a devDependency but not used at runtime in Lambdas.
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
   `start-transcription` also creates the `MeetingJob` history row in DynamoDB itself, before starting the Transcribe job (and deletes it again if the start fails). Creating it server-side means the row exists even if the tab closes right after the request. From then on **Lambdas own its status**.
3. When Transcribe writes `transcripts/{jobId}.json`, an **S3 `ObjectCreated` notification invokes `process-transcript-worker` directly**. No browser is involved, so closing the tab doesn't stall the job.
4. Worker marks the row `PROCESSING`, reads the transcript JSON, rebuilds it as speaker-labelled text via `buildSpeakerTranscript`, calls Anthropic with the `Nghị quyết Chi bộ` system prompt, writes `reports/{jobId}.txt` and marks the row `COMPLETED` (or `FAILED`; it doesn't rethrow, so there's no async retry re-billing a generation).
5. Browser polls `GET /status?jobId=…` every 5s ([app/components/ProcessingStatus.tsx](app/components/ProcessingStatus.tsx)) only to reflect state, and shows the report in `ReportViewer` once `reportReady: true`. It falls back to calling `POST /process` itself only if the transcript has been ready for 60s and no worker has picked it up.
6. `POST /process` → `process-transcript` (dispatcher) is for manual runs (regenerate with feedback, retry from history): it verifies the transcript, deletes any stale report, marks the row `PROCESSING`, **invokes the worker asynchronously** (`InvocationType: "Event"`) and returns `202`.

### Why the dispatcher/worker split

Anthropic generation can exceed API Gateway's 29s timeout. `process-transcript` (`timeoutSeconds: 120`) only kicks off the work; `process-transcript-worker` (`timeoutSeconds: 600`) does the actual generation. **Don't fold them back together** — that's what commit `6c7edaa` fixed.

### Backend wiring lives in one file

[amplify/backend.ts](amplify/backend.ts) is where everything is glued together:
- All five Lambdas get S3 read/write + a `BUCKET_NAME` env var.
- Transcribe IAM policies are attached per-Lambda (start/check/cancel).
- The REST API Gateway and its four routes (`/transcribe`, `/status`, `/process`, `/cancel`) are defined here, not in any per-function file.
- The dispatcher gets `WORKER_FUNCTION_NAME` injected and `lambda.grantInvoke` on the worker.
- The bucket's `transcripts/*.json` ObjectCreated notification targets the worker. That's why the worker has `resourceGroupName: "storage"`: in the function stack it would be a circular stack reference.
- `start-transcription`, `check-status`, `process-transcript` and the worker get read/write on the `MeetingJob` table plus `MEETING_JOB_TABLE_NAME`.
- The API URL is exported via `backend.addOutput({ custom: { apiUrl } })` and read from `amplify_outputs.json` on the client as `(outputs as any).custom?.apiUrl`.

When adding a new Lambda or route, update `backend.ts` — there's no auto-discovery.

### Lambdas

Each Lambda has its own `resource.ts` (config) and `handler.ts` (code) under [amplify/functions/](amplify/functions/).

| Function | Trigger | Notes |
|---|---|---|
| `start-transcription` | API GW `POST /transcribe` | Generates `jobId` via `randomUUID()`, calls `StartTranscriptionJobCommand` |
| `check-status` | API GW `GET /status` | Checks Transcribe job, then S3 for the report. Falls back to S3-only when the Transcribe job has expired (`UNKNOWN` status). Also reconciles the `MeetingJob` row: Transcribe `FAILED` → `FAILED`, report present → `COMPLETED`, `PROCESSING` for >15 min (worker timed out) → `FAILED`. |
| `process-transcript` | API GW `POST /process` | Dispatcher only — verifies transcript exists, deletes prior report, marks row `PROCESSING`, invokes worker async, returns 202. |
| `process-transcript-worker` | S3 `transcripts/*.json` ObjectCreated, or `InvokeCommand` from dispatcher | Long-running. Skips S3 events whose report already exists (duplicate delivery). Reads `ANTHROPIC_API_KEY` from Amplify secret. Has the Vietnamese resolution prompt. Output is **plain text**, not Markdown. |
| `cancel-job` | API GW `POST /cancel` | Best-effort cleanup of Transcribe job + audio S3 object. |

The root [tsconfig.json](tsconfig.json) **excludes `amplify/`** — Lambdas are compiled by Amplify/esbuild against [amplify/tsconfig.json](amplify/tsconfig.json).

### S3 layout

- `audio/*` — uploads (guest read/write/delete)
- `transcripts/{jobId}.json` — raw Transcribe output (guest read)
- `reports/{jobId}.txt` — generated resolution (guest read). `check-status` also probes for `.html` for backwards compat.

### Data model

[amplify/data/resource.ts](amplify/data/resource.ts) defines a single `MeetingJob` model with `allow.guest()` auth (default mode `iam`). The frontend uses `generateClient<Schema>({ authMode: "iam" })`; Lambdas bypass AppSync and write the table directly. There's no per-user authorization.

### Frontend structure

- [app/page.tsx](app/page.tsx) — single-page state machine (`idle | uploading | transcribing | processing | done`)
- [app/components/](app/components/) — feature components (`AudioUploader`, `ProcessingStatus`, `ReportViewer`, `JobHistory`)
- [components/ui/](components/ui/) — shadcn-style Radix wrappers
- [app/components/ConfigureAmplify.tsx](app/components/ConfigureAmplify.tsx) — `Amplify.configure(outputs)` runs on every page (it's in `layout.tsx`)
- [lib/resolutionDoc.ts](lib/resolutionDoc.ts) turns the plain-text report into a `.doc` (Word HTML): `parseReport` splits it into header block / title / body / `Nơi nhận` / signature / appendix, and `buildResolutionDoc` renders it. `ReportViewer.handleDownloadDoc` only wraps the result in a Blob. The renderer keys off the prompt's conventions (`I.`/`II.` Roman headers, `1.` sub-sections, `a)`/`đ)` items, `• ` bullets, `|`-delimited table rows) — keep prompt and renderer in sync.

## Gotchas

- **`amplify_outputs.json` is gitignored** and regenerated by `npx ampx sandbox`. The frontend imports it directly; without a running sandbox, storage/api URLs are missing and uploads fail with the Vietnamese "Chưa kết nối với máy chủ lưu trữ…" message.
- **`ANTHROPIC_API_KEY` is an Amplify secret**, set with `npx ampx sandbox secret set ANTHROPIC_API_KEY` (per-sandbox) or via the Amplify console for deployed branches. Both `process-transcript` and `process-transcript-worker` declare it but only the worker uses it.
- **The report follows Hướng dẫn số 42-HD/BTCTW (28/10/2025)** — the four-part structure (`I.` đánh giá kết quả, `II.` phương hướng nhiệm vụ, `III.` phân công và tổ chức thực hiện, `IV.` tự đánh giá chất lượng kỳ sinh hoạt), the formality header, the `Nơi nhận` block and the `T/M CHI ỦY / BÍ THƯ` signature. The reference document is a real resolution from Chi bộ 28, phường Cẩm Lệ.
- **The resolution prompt requires plain text output** — no Markdown, no HTML, with **one exception**: the Mục I.3 progress table is emitted as `| a | b | c |` rows (plain text has no way to express a 4-column grid). `renderBody` groups consecutive pipe rows into a Word table and drops any Markdown `|---|` separator row.
- **The first four lines are load-bearing** (`ĐẢNG ỦY …`, `CHI BỘ …`, `Số …-NQ/CB`, `[Địa danh], ngày … tháng … năm …`, then `NGHỊ QUYẾT`). `parseReport` reads them into the two-column formality header; unknown values stay as `……` placeholders rather than being dropped. A report without a `NGHỊ QUYẾT` line in its first 12 lines is treated as header-less and rendered entirely as body, so older reports still export.
- **The verbatim discussion record lives in the appendix** (`PHỤ LỤC: TỔNG HỢP Ý KIẾN THẢO LUẬN…`), which the exporter puts on its own page. Hướng dẫn 42 folds discussion into Mục I and II, but the polished-not-verbatim rule from commit `1aef59f` still applies there: the appendix keeps every opinion so nothing from the transcript is lost. Don't drop it, and don't make Mục I/II verbatim.
- **Lambdas create the `MeetingJob` row and own its status** (via [amplify/functions/shared/meetingJob.ts](amplify/functions/shared/meetingJob.ts), status updates are conditional on the row existing). Rows written directly to the table must carry `__typename`, `createdAt` and `updatedAt` the way AppSync would. The browser still renames and deletes rows. `JobHistory` calls `/status` for rows still `TRANSCRIBING`/`PROCESSING` so they reconcile, and offers "Tạo lại biên bản" for `FAILED` rows and for rows stuck for over an hour.
- **`@/` alias** maps to repo root, so `@/amplify/data/resource` and `@/amplify_outputs.json` are normal client-side imports. The `amplify/` exclusion in tsconfig applies only to type-checking the Lambda code, not to importing the type-only `Schema` from data resource.
