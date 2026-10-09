import type { APIGatewayProxyHandler } from "aws-lambda";
import {
  TranscribeClient,
  GetTranscriptionJobCommand,
} from "@aws-sdk/client-transcribe";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";

const transcribeClient = new TranscribeClient();
const s3Client = new S3Client();
const BUCKET_NAME = process.env.BUCKET_NAME!;

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
    try {
      const response = await transcribeClient.send(
        new GetTranscriptionJobCommand({ TranscriptionJobName: jobId })
      );
      status = response.TranscriptionJob?.TranscriptionJobStatus || "UNKNOWN";
    } catch {
      // Job may have expired in AWS Transcribe — still check S3 for the report
    }

    let reportReady = false;
    let report: string | undefined;
    let title: string | undefined;

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
          if (report) { reportReady = true; status = "COMPLETED"; break; }
        } catch {
          // try next extension
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
        ...(title && { title }),
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
