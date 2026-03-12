import { defineFunction } from "@aws-amplify/backend";

export const cancelJob = defineFunction({
  name: "cancel-job",
  timeoutSeconds: 30,
});
