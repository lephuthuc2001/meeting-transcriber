import type { APIGatewayProxyHandler } from "aws-lambda";
import { randomUUID } from "crypto";
import {
  TranscribeClient,
  StartTranscriptionJobCommand,
  MediaFormat,
} from "@aws-sdk/client-transcribe";

const transcribeClient = new TranscribeClient();
const BUCKET_NAME = process.env.BUCKET_NAME!;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
};

function getMediaFormat(fileName: string): MediaFormat {
  const ext = fileName.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "m4a":
      return MediaFormat.M4A;
    case "mp3":
      return MediaFormat.MP3;
    case "wav":
      return MediaFormat.WAV;
    case "flac":
      return MediaFormat.FLAC;
    case "ogg":
      return MediaFormat.OGG;
    case "webm":
      return MediaFormat.WEBM;
    default:
      return MediaFormat.MP4;
  }
}

export const handler: APIGatewayProxyHandler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: CORS_HEADERS, body: "" };
  }

  try {
    const body = JSON.parse(event.body || "{}");
    const { s3Key, title, fileName, language = "vi-VN" } = body;

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

    await transcribeClient.send(
      new StartTranscriptionJobCommand({
        TranscriptionJobName: jobId,
        LanguageCode: language === "en-US" ? "en-US" : "vi-VN",
        MediaFormat: getMediaFormat(fileName),
        Media: {
          MediaFileUri: `s3://${BUCKET_NAME}/${s3Key}`,
        },
        OutputBucketName: BUCKET_NAME,
        OutputKey: `transcripts/${jobId}.json`,
      })
    );

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({ jobId, status: "TRANSCRIBING" }),
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
