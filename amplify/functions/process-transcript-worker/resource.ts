import { defineFunction, secret } from "@aws-amplify/backend";

export const processTranscriptWorker = defineFunction({
  name: "process-transcript-worker",
  timeoutSeconds: 600,
  memoryMB: 512,
  environment: {
    ANTHROPIC_API_KEY: secret("ANTHROPIC_API_KEY"),
  },
});
