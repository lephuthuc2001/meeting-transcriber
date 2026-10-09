import { type ClientSchema, a, defineData } from "@aws-amplify/backend";

const schema = a.schema({
  MeetingJob: a
    .model({
      title: a.string().required(),
      // true while the title is a placeholder; the AI-generated title replaces it
      autoTitle: a.boolean(),
      status: a.enum([
        "UPLOADING",
        "TRANSCRIBING",
        "PROCESSING",
        "COMPLETED",
        "FAILED",
      ]),
      audioKey: a.string().required(),
      reportKey: a.string(),
      fileName: a.string().required(),
      errorMessage: a.string(),
      audioDurationSeconds: a.integer(),
    })
    .authorization((allow) => [allow.guest()]),
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: "iam",
  },
});
