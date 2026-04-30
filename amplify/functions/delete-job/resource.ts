import { defineFunction } from "@aws-amplify/backend";

export const deleteJob = defineFunction({
  name: "delete-job",
  timeoutSeconds: 30,
});
