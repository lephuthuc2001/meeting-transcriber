import { defineFunction, secret } from "@aws-amplify/backend";

export const processTranscript = defineFunction({
  name: "process-transcript",
  timeoutSeconds: 120,
  memoryMB: 512,
  environment: {
    ANTHROPIC_API_KEY: secret("ANTHROPIC_API_KEY"),
  },
});
