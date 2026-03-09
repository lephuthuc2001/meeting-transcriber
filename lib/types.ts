export type JobStatus =
  | "UPLOADING"
  | "TRANSCRIBING"
  | "PROCESSING"
  | "COMPLETED"
  | "FAILED";

export interface MeetingJob {
  id: string;
  title: string;
  status: JobStatus;
  audioKey: string;
  reportKey?: string;
  fileName: string;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}
