import { defineBackend } from "@aws-amplify/backend";
import { Policy, PolicyStatement, Effect } from "aws-cdk-lib/aws-iam";
import { Function as LambdaFunction } from "aws-cdk-lib/aws-lambda";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import { auth } from "./auth/resource.js";
import { data } from "./data/resource.js";
import { storage } from "./storage/resource.js";
import { startTranscription } from "./functions/start-transcription/resource.js";
import { checkStatus } from "./functions/check-status/resource.js";
import { processTranscript } from "./functions/process-transcript/resource.js";

const backend = defineBackend({
  auth,
  data,
  storage,
  startTranscription,
  checkStatus,
  processTranscript,
});

// Get the S3 bucket reference from storage
const s3Bucket = backend.storage.resources.bucket;
const bucketName = s3Bucket.bucketName;

// Grant S3 read/write permissions and inject BUCKET_NAME to all Lambda functions
const lambdaResources = [
  backend.startTranscription.resources.lambda,
  backend.checkStatus.resources.lambda,
  backend.processTranscript.resources.lambda,
];

for (const lambdaFn of lambdaResources) {
  s3Bucket.grantReadWrite(lambdaFn);
  (lambdaFn as LambdaFunction).addEnvironment("BUCKET_NAME", bucketName);
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

// Output the API URL
backend.addOutput({
  custom: {
    apiUrl: api.url,
  },
});
