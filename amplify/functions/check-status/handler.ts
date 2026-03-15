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

    const command = new GetTranscriptionJobCommand({
      TranscriptionJobName: jobId,
    });

    const response = await transcribeClient.send(command);
    const status =
      response.TranscriptionJob?.TranscriptionJobStatus || "UNKNOWN";

    let reportReady = false;
    let report: string | undefined;

    if (status === "COMPLETED") {
      try {
        const reportObj = await s3Client.send(
          new GetObjectCommand({
            Bucket: BUCKET_NAME,
            Key: `reports/${jobId}.txt`,
          })
        );
        report = await reportObj.Body?.transformToString();
        reportReady = !!report;
      } catch {
        reportReady = false;
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
