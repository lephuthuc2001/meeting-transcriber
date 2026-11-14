# The resolution report

- **One format contract, two files.** The system prompt in `amplify/functions/process-transcript-worker/handler.ts` produces the plain-text layout that `lib/resolutionDoc.ts` parses into the Word `.doc` (the layout is drawn at the top of `resolutionDoc.ts`). A change to either is a change to both.
- **Speakers are quoted verbatim** in Mục I and II, one paragraph per turn, as the users asked: a direct quote with only fillers and stutters removed. This is why the report is about as long as the transcript, and why generation streams under a large `max_tokens`.
- **Old reports must still export.** The renderer keeps paths for earlier formats (header-less reports, the `PHỤ LỤC` appendix); keep them when changing the parser.
- The format follows Hướng dẫn số 42-HD/BTCTW (28/10/2025); the reference document is `playground/MẪU Nghị quyết CB.docx`.
