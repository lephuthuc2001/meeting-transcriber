import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";

// Backend-owned status for the MeetingJob row the browser creates in
// AudioUploader. Writes are conditional on the row existing: if the browser
// died before creating it, the report still lands in S3, we just don't
// invent a history row without a title.

const docClient = DynamoDBDocumentClient.from(new DynamoDBClient());
const TABLE_NAME = process.env.MEETING_JOB_TABLE_NAME!;

export type JobStatus =
  | "UPLOADING"
  | "TRANSCRIBING"
  | "PROCESSING"
  | "COMPLETED"
  | "FAILED";

export interface MeetingJobRow {
  id: string;
  status?: JobStatus;
  errorMessage?: string;
  updatedAt?: string;
}

export async function getMeetingJob(
  jobId: string
): Promise<MeetingJobRow | undefined> {
  const { Item } = await docClient.send(
    new GetCommand({ TableName: TABLE_NAME, Key: { id: jobId } })
  );
  return Item as MeetingJobRow | undefined;
}

export async function setMeetingJobStatus(
  jobId: string,
  status: JobStatus,
  extra: { reportKey?: string; errorMessage?: string } = {}
): Promise<void> {
  const names: Record<string, string> = {
    "#status": "status",
    "#updatedAt": "updatedAt",
    "#errorMessage": "errorMessage",
  };
  const values: Record<string, unknown> = {
    ":status": status,
    ":updatedAt": new Date().toISOString(),
  };
  const sets = ["#status = :status", "#updatedAt = :updatedAt"];

  if (extra.reportKey) {
    names["#reportKey"] = "reportKey";
    values[":reportKey"] = extra.reportKey;
    sets.push("#reportKey = :reportKey");
  }

  let expression = `SET ${sets.join(", ")}`;
  if (extra.errorMessage) {
    values[":errorMessage"] = extra.errorMessage;
    expression = `SET ${[...sets, "#errorMessage = :errorMessage"].join(", ")}`;
  } else {
    expression += " REMOVE #errorMessage";
  }

  try {
    await docClient.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { id: jobId },
        UpdateExpression: expression,
        ConditionExpression: "attribute_exists(id)",
        ExpressionAttributeNames: names,
        ExpressionAttributeValues: values,
      })
    );
  } catch (err: any) {
    if (err?.name === "ConditionalCheckFailedException") return;
    throw err;
  }
}
