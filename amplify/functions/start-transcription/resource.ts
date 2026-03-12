import { defineFunction } from "@aws-amplify/backend";

export const startTranscription = defineFunction({
  name: "start-transcription",
  timeoutSeconds: 30,
});
