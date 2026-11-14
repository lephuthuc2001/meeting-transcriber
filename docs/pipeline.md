# Job pipeline

How a meeting moves from upload to report across the Lambdas. Each handler documents its own details; this is the cross-file picture.

1. Browser uploads audio to S3 `audio/…`, calls `POST /transcribe`.
2. `start-transcription` creates the `MeetingJob` row, then starts the Transcribe job.
3. Transcribe writes `transcripts/{jobId}.json`; that S3 event invokes `process-transcript-worker`, which writes `reports/{jobId}.txt`.
4. Browser polls `GET /status`; `check-status` reconciles the row for the cases no worker can record (Transcribe failed, worker killed by timeout, report finished after the tab closed).
5. `POST /process` (`process-transcript`) is the manual path: regenerate with feedback, retry from history.

## Invariants

- **Lambdas own the row's status.** The pipeline runs to completion with no browser open; the browser only displays status, renames and deletes. Status writes go through `amplify/functions/shared/meetingJob.ts`.
- **Dispatcher and worker stay separate functions.** Generation runs for minutes, far past API Gateway's 29s limit, so `process-transcript` only dispatches the worker asynchronously and returns `202`. Merging them reintroduces the timeout that commit `6c7edaa` fixed.
- **`amplify/backend.ts` is the single wiring point**: IAM, env vars, the S3 notification, table grants and every REST route. A new Lambda or route is registered there.
