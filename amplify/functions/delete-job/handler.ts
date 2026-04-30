import type { APIGatewayProxyHandler } from "aws-lambda";
import {
  TranscribeClient,
  DeleteTranscriptionJobCommand,
} from "@aws-sdk/client-transcribe";
import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";

const transcribeClient = new TranscribeClient();
const s3Client = new S3Client();
const BUCKET_NAME = process.env.BUCKET_NAME!;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
};

export const handler: APIGatewayProxyHandler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: CORS_HEADERS, body: "" };
  }

  try {
    const body = JSON.parse(event.body || "{}");
    const { jobId, audioKey, reportKey } = body;

    if (!jobId || !audioKey) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          error: "Missing required fields: jobId, audioKey",
        }),
      };
    }

    // Delete Transcribe job — ignore "not found" errors
    try {
      await transcribeClient.send(
        new DeleteTranscriptionJobCommand({ TranscriptionJobName: jobId })
      );
    } catch (err: any) {
      if (
        err.name !== "BadRequestException" &&
        err.name !== "NotFoundException"
      ) {
        throw err;
      }
    }

    // Delete audio, transcript, and report from S3 (DeleteObject is idempotent)
    const deleteKeys = [
      audioKey,
      `transcripts/${jobId}.json`,
      ...(reportKey ? [reportKey] : []),
    ];

    await Promise.all(
      deleteKeys.map((key) =>
        s3Client.send(new DeleteObjectCommand({ Bucket: BUCKET_NAME, Key: key }))
      )
    );

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({ success: true }),
    };
  } catch (error) {
    console.error("Error deleting job:", error);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        error: "Failed to delete job",
        details: error instanceof Error ? error.message : String(error),
      }),
    };
  }
};
