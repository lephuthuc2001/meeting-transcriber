import type { APIGatewayProxyHandler } from "aws-lambda";
import {
  TranscribeClient,
  GetTranscriptionJobCommand,
} from "@aws-sdk/client-transcribe";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import {
  applyAutoTitle,
  getMeetingJob,
  setMeetingJobStatus,
  type MeetingJobRow,
} from "../shared/meetingJob";

const transcribeClient = new TranscribeClient();
const s3Client = new S3Client();
const BUCKET_NAME = process.env.BUCKET_NAME!;
// Worker timeout is 600s; past this a PROCESSING row is dead, not slow
const STALE_PROCESSING_MS = 15 * 60 * 1000;

const isStale = (row: MeetingJobRow) =>
  !row.updatedAt || Date.now() - Date.parse(row.updatedAt) > STALE_PROCESSING_MS;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "GET,OPTIONS",
};

export const handler: APIGatewayProxyHandler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: "",
    };
  }

  try {
    const jobId = event.queryStringParameters?.jobId;

    if (!jobId) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: "Missing required parameter: jobId" }),
      };
    }

    let status = "UNKNOWN";
    let errorMessage: string | undefined;
    try {
      const response = await transcribeClient.send(
        new GetTranscriptionJobCommand({ TranscriptionJobName: jobId })
      );
      status = response.TranscriptionJob?.TranscriptionJobStatus || "UNKNOWN";
      errorMessage = response.TranscriptionJob?.FailureReason;
    } catch {
      // Job may have expired in AWS Transcribe — still check S3 for the report
    }

    // Lambdas own the MeetingJob status; a missing row (browser closed before
    // creating it) just means there's nothing to reconcile.
    let row: MeetingJobRow | undefined;
    try {
      row = await getMeetingJob(jobId);
    } catch (err) {
      console.error("Error reading MeetingJob row:", err);
    }

    let reportReady = false;
    let report: string | undefined;
    let reportKey: string | undefined;
    let title: string | undefined;

    // A failed transcription writes no transcript, so the S3 trigger never
    // fires — this is the only place the row learns about it.
    if (status === "FAILED" && row && row.status !== "FAILED") {
      await setMeetingJobStatus(jobId, "FAILED", {
        errorMessage: errorMessage || "Chuyển đổi giọng nói thất bại.",
      });
    }

    // Check S3 if Transcribe says COMPLETED, or if Transcribe job is gone
    // (expired jobs no longer exist in Transcribe but the S3 report may still be there)
    if (status === "COMPLETED" || status === "UNKNOWN") {
      for (const ext of ["txt", "html"]) {
        try {
          const reportObj = await s3Client.send(
            new GetObjectCommand({
              Bucket: BUCKET_NAME,
              Key: `reports/${jobId}.${ext}`,
            })
          );
          report = await reportObj.Body?.transformToString();
          const rawTitle = reportObj.Metadata?.title;
          if (rawTitle) {
            try { title = decodeURIComponent(rawTitle); } catch { /* ignore malformed */ }
          }
          if (report) {
            reportReady = true;
            reportKey = `reports/${jobId}.${ext}`;
            status = "COMPLETED";
            break;
          }
        } catch {
          // try next extension
        }
      }

      // e.g. the worker finished after the tab that started it was closed.
      // A fresh PROCESSING row with a report is a regenerate in flight (or
      // the worker about to mark it itself), so leave that one alone.
      if (
        reportReady &&
        row &&
        row.status !== "COMPLETED" &&
        !(row.status === "PROCESSING" && !isStale(row))
      ) {
        await setMeetingJobStatus(jobId, "COMPLETED", { reportKey });
        if (title) await applyAutoTitle(jobId, title);
      }

      if (!reportReady && row?.status === "FAILED") {
        status = "FAILED";
        errorMessage = row.errorMessage;
      } else if (!reportReady && row?.status === "PROCESSING") {
        // A worker killed by its timeout can't record the failure itself
        if (isStale(row)) {
          status = "FAILED";
          errorMessage = "Quá thời gian tạo biên bản. Vui lòng thử lại.";
          await setMeetingJobStatus(jobId, "FAILED", { errorMessage });
        } else {
          status = "PROCESSING";
        }
      }
    }

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        jobId,
        status,
        reportReady,
        ...(report && { report }),
        ...(status === "FAILED" && errorMessage && { errorMessage }),
        // Only when it replaced a placeholder, never a name the user typed
        ...(title && row?.autoTitle && { title }),
      }),
    };
  } catch (error) {
    console.error("Error checking status:", error);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        error: "Failed to check transcription status",
        details: error instanceof Error ? error.message : String(error),
      }),
    };
  }
};
