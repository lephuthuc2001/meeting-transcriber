import { defineBackend } from "@aws-amplify/backend";
import { Policy, PolicyStatement, Effect } from "aws-cdk-lib/aws-iam";
import { Function as LambdaFunction } from "aws-cdk-lib/aws-lambda";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import { EventType } from "aws-cdk-lib/aws-s3";
import { LambdaDestination } from "aws-cdk-lib/aws-s3-notifications";
import { auth } from "./auth/resource.js";
import { data } from "./data/resource.js";
import { storage } from "./storage/resource.js";
import { startTranscription } from "./functions/start-transcription/resource.js";
import { checkStatus } from "./functions/check-status/resource.js";
import { processTranscript } from "./functions/process-transcript/resource.js";
import { processTranscriptWorker } from "./functions/process-transcript-worker/resource.js";
import { cancelJob } from "./functions/cancel-job/resource.js";
import { deleteJob } from "./functions/delete-job/resource.js";

const backend = defineBackend({
  auth,
  data,
  storage,
  startTranscription,
  checkStatus,
  processTranscript,
  processTranscriptWorker,
  cancelJob,
  deleteJob,
});

// Get the S3 bucket reference from storage
const s3Bucket = backend.storage.resources.bucket;
const bucketName = s3Bucket.bucketName;

// Grant S3 read/write permissions and inject BUCKET_NAME to all Lambda functions
const lambdaResources = [
  backend.startTranscription.resources.lambda,
  backend.checkStatus.resources.lambda,
  backend.processTranscript.resources.lambda,
  backend.processTranscriptWorker.resources.lambda,
  backend.cancelJob.resources.lambda,
  backend.deleteJob.resources.lambda,
];

for (const lambdaFn of lambdaResources) {
  s3Bucket.grantReadWrite(lambdaFn);
  (lambdaFn as LambdaFunction).addEnvironment("BUCKET_NAME", bucketName);
}

// Transcribe writes transcripts/{jobId}.json when a job completes; that
// object kicks off report generation server-side, so it no longer depends
// on a browser tab being open to call /process.
s3Bucket.addEventNotification(
  EventType.OBJECT_CREATED,
  new LambdaDestination(backend.processTranscriptWorker.resources.lambda),
  { prefix: "transcripts/", suffix: ".json" }
);

// Lambdas create the MeetingJob row and own its status, so the history list
// stays correct when nobody is watching.
const meetingJobTable = backend.data.resources.tables["MeetingJob"];
for (const lambdaFn of [
  backend.startTranscription.resources.lambda,
  backend.checkStatus.resources.lambda,
  backend.processTranscript.resources.lambda,
  backend.processTranscriptWorker.resources.lambda,
]) {
  meetingJobTable.grantReadWriteData(lambdaFn);
  (lambdaFn as LambdaFunction).addEnvironment(
    "MEETING_JOB_TABLE_NAME",
    meetingJobTable.tableName
  );
}

// Add Amazon Transcribe IAM policy to start-transcription and check-status lambdas
const transcribePolicy = new PolicyStatement({
  effect: Effect.ALLOW,
  actions: [
    "transcribe:StartTranscriptionJob",
    "transcribe:GetTranscriptionJob",
  ],
  resources: ["*"],
});

backend.startTranscription.resources.lambda.role?.attachInlinePolicy(
  new Policy(
    backend.startTranscription.resources.lambda,
    "TranscribeStartPolicy",
    {
      statements: [transcribePolicy],
    }
  )
);

backend.checkStatus.resources.lambda.role?.attachInlinePolicy(
  new Policy(backend.checkStatus.resources.lambda, "TranscribeCheckPolicy", {
    statements: [
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ["transcribe:GetTranscriptionJob"],
        resources: ["*"],
      }),
    ],
  })
);

backend.cancelJob.resources.lambda.role?.attachInlinePolicy(
  new Policy(backend.cancelJob.resources.lambda, "TranscribeCancelPolicy", {
    statements: [
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ["transcribe:DeleteTranscriptionJob"],
        resources: ["*"],
      }),
    ],
  })
);

backend.deleteJob.resources.lambda.role?.attachInlinePolicy(
  new Policy(backend.deleteJob.resources.lambda, "TranscribeDeletePolicy", {
    statements: [
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ["transcribe:DeleteTranscriptionJob"],
        resources: ["*"],
      }),
    ],
  })
);

// Create API Gateway REST API
const apiStack = backend.createStack("MeetingTranscriberApi");

const api = new apigateway.RestApi(apiStack, "MeetingTranscriberRestApi", {
  restApiName: "MeetingTranscriberApi",
  deployOptions: {
    stageName: "prod",
  },
  defaultCorsPreflightOptions: {
    allowOrigins: apigateway.Cors.ALL_ORIGINS,
    allowMethods: apigateway.Cors.ALL_METHODS,
    allowHeaders: ["Content-Type", "Authorization"],
  },
});

// POST /transcribe -> startTranscription lambda
const transcribeResource = api.root.addResource("transcribe");
transcribeResource.addMethod(
  "POST",
  new apigateway.LambdaIntegration(
    backend.startTranscription.resources.lambda
  )
);

// GET /status -> checkStatus lambda
const statusResource = api.root.addResource("status");
statusResource.addMethod(
  "GET",
  new apigateway.LambdaIntegration(backend.checkStatus.resources.lambda)
);

// POST /process -> processTranscript lambda
const processResource = api.root.addResource("process");
processResource.addMethod(
  "POST",
  new apigateway.LambdaIntegration(
    backend.processTranscript.resources.lambda
  )
);

// POST /cancel -> cancelJob lambda
const cancelResource = api.root.addResource("cancel");
cancelResource.addMethod(
  "POST",
  new apigateway.LambdaIntegration(backend.cancelJob.resources.lambda)
);

// POST /delete -> deleteJob lambda
const deleteResource = api.root.addResource("delete");
deleteResource.addMethod(
  "POST",
  new apigateway.LambdaIntegration(backend.deleteJob.resources.lambda)
);

// Allow process-transcript to invoke the worker asynchronously
backend.processTranscriptWorker.resources.lambda.grantInvoke(
  backend.processTranscript.resources.lambda
);

// Inject worker function name into the dispatcher Lambda
(backend.processTranscript.resources.lambda as LambdaFunction).addEnvironment(
  "WORKER_FUNCTION_NAME",
  (backend.processTranscriptWorker.resources.lambda as LambdaFunction).functionName
);

// Output the API URL
backend.addOutput({
  custom: {
    apiUrl: api.url,
  },
});
