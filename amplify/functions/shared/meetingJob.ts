import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DeleteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";

// The MeetingJob table behind the Amplify Data model. Lambdas write it
// directly (bypassing AppSync), so rows must carry the same fields AppSync
// would add: __typename, createdAt, updatedAt.

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
  autoTitle?: boolean;
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

export async function createMeetingJob(job: {
  id: string;
  title: string;
  autoTitle: boolean;
  audioKey: string;
  fileName: string;
  audioDurationSeconds?: number;
}): Promise<void> {
  const now = new Date().toISOString();
  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        __typename: "MeetingJob",
        ...job,
        status: "TRANSCRIBING",
        createdAt: now,
        updatedAt: now,
      },
      ConditionExpression: "attribute_not_exists(id)",
    })
  );
}

export async function deleteMeetingJob(jobId: string): Promise<void> {
  await docClient.send(
    new DeleteCommand({ TableName: TABLE_NAME, Key: { id: jobId } })
  );
}

// Conditional on the row existing, so a row deleted by the user (or a job
// started before rows were created server-side) isn't resurrected without
// its title and audio key.
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

// Replaces the placeholder title with the AI-generated one; a no-op once the
// user has named the meeting themselves (autoTitle false).
export async function applyAutoTitle(
  jobId: string,
  title: string
): Promise<void> {
  try {
    await docClient.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { id: jobId },
        UpdateExpression: "SET #title = :title, #updatedAt = :updatedAt",
        ConditionExpression: "#autoTitle = :true",
        ExpressionAttributeNames: {
          "#title": "title",
          "#autoTitle": "autoTitle",
          "#updatedAt": "updatedAt",
        },
        ExpressionAttributeValues: {
          ":title": title,
          ":true": true,
          ":updatedAt": new Date().toISOString(),
        },
      })
    );
  } catch (err: any) {
    if (err?.name === "ConditionalCheckFailedException") return;
    throw err;
  }
}
