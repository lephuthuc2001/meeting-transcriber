import { defineStorage } from "@aws-amplify/backend";

export const storage = defineStorage({
  name: "meetingFiles",
  access: (allow) => ({
    "audio/*": [allow.guest.to(["read", "write", "delete"])],
    "transcripts/*": [allow.guest.to(["read"])],
    "reports/*": [allow.guest.to(["read"])],
  }),
});
