import { defineFunction } from "@aws-amplify/backend";

export const checkStatus = defineFunction({
  name: "check-status",
  timeoutSeconds: 15,
});
