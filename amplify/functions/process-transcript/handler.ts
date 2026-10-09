import type { APIGatewayProxyHandler } from "aws-lambda";
import {
  S3Client,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";
import { setMeetingJobStatus } from "../shared/meetingJob";

const s3Client = new S3Client();
const lambdaClient = new LambdaClient();
const BUCKET_NAME = process.env.BUCKET_NAME!;
const WORKER_FUNCTION_NAME = process.env.WORKER_FUNCTION_NAME!;

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
    const { jobId, feedback } = body;

    if (!jobId) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: "Missing required field: jobId" }),
      };
    }

    // Verify transcript exists before kicking off worker
    const transcriptCheck = await s3Client.send(
      new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: `transcripts/${jobId}.json`,
      })
    );
    if (!transcriptCheck.Body) {
      return {
        statusCode: 404,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: "Transcript not found" }),
      };
    }

    // Delete any existing report so polling sees it as not-ready until worker finishes
    for (const ext of ["txt", "html"]) {
      await s3Client.send(
        new DeleteObjectCommand({
          Bucket: BUCKET_NAME,
          Key: `reports/${jobId}.${ext}`,
        })
      );
    }

    // After the delete, so check-status can't see the old report and flip
    // the row back to COMPLETED
    await setMeetingJobStatus(jobId, "PROCESSING");

    // Invoke worker asynchronously (fire-and-forget — no API Gateway timeout risk)
    await lambdaClient.send(
      new InvokeCommand({
        FunctionName: WORKER_FUNCTION_NAME,
        InvocationType: "Event",
        Payload: JSON.stringify({ jobId, feedback }),
      })
    );

    return {
      statusCode: 202,
      headers: CORS_HEADERS,
      body: JSON.stringify({ jobId, status: "PROCESSING" }),
    };
  } catch (error) {
    console.error("Error dispatching process job:", error);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        error: "Failed to start processing",
        details: error instanceof Error ? error.message : String(error),
      }),
    };
  }
};
