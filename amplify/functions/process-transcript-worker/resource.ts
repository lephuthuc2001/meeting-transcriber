import { defineFunction, secret } from "@aws-amplify/backend";

export const processTranscriptWorker = defineFunction({
  name: "process-transcript-worker",
  timeoutSeconds: 600,
  memoryMB: 512,
  // Lives in the storage stack because the bucket's ObjectCreated
  // notification targets it; in the function stack that would be a
  // circular reference (functions -> bucket -> functions).
  resourceGroupName: "storage",
  environment: {
    ANTHROPIC_API_KEY: secret("ANTHROPIC_API_KEY"),
  },
});
