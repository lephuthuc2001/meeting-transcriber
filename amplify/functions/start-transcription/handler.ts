import type { APIGatewayProxyHandler } from "aws-lambda";
import { randomUUID } from "crypto";
import {
  TranscribeClient,
  StartTranscriptionJobCommand,
} from "@aws-sdk/client-transcribe";

const transcribeClient = new TranscribeClient();
const BUCKET_NAME = process.env.BUCKET_NAME!;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
};

function getMediaFormat(fileName: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "m4a":
      return "mp4";
    case "mp3":
      return "mp3";
    case "wav":
      return "wav";
    case "flac":
      return "flac";
    case "ogg":
      return "ogg";
    case "webm":
      return "webm";
    default:
      return "mp4";
  }
}

export const handler: APIGatewayProxyHandler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: "",
    };
  }

  try {
    const body = JSON.parse(event.body || "{}");
    const { s3Key, title, fileName } = body;

    if (!s3Key || !title || !fileName) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          error: "Missing required fields: s3Key, title, fileName",
        }),
      };
    }

    const jobId = randomUUID();
    const mediaFormat = getMediaFormat(fileName);

    const command = new StartTranscriptionJobCommand({
      TranscriptionJobName: jobId,
      LanguageCode: "vi-VN",
      MediaFormat: mediaFormat,
      Media: {
        MediaFileUri: `s3://${BUCKET_NAME}/${s3Key}`,
      },
      OutputBucketName: BUCKET_NAME,
      OutputKey: `transcripts/${jobId}.json`,
    });

    await transcribeClient.send(command);

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        jobId,
        status: "TRANSCRIBING",
      }),
    };
  } catch (error) {
    console.error("Error starting transcription:", error);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        error: "Failed to start transcription",
        details: error instanceof Error ? error.message : String(error),
      }),
    };
  }
};
