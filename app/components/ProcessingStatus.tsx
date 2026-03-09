"use client";

import { useEffect, useRef, useState } from "react";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "@/amplify/data/resource";
import { Loader2, CheckCircle, XCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import outputs from "@/amplify_outputs.json";

const apiUrl = (outputs as any).custom?.apiUrl;
const client = generateClient<Schema>({ authMode: "apiKey" });

interface ProcessingStatusProps {
  jobId: string;
  onComplete: (report: string) => void;
  onError: (error: string) => void;
}

type Phase =
  | "transcribing"
  | "processing"
  | "completed"
  | "failed";

const PHASE_MESSAGES: Record<Phase, string> = {
  transcribing: "Đang chuyển đổi giọng nói thành văn bản...",
  processing: "Đang tạo biên bản cuộc họp...",
  completed: "Hoàn tất!",
  failed: "Đã xảy ra lỗi.",
};

export default function ProcessingStatus({
  jobId,
  onComplete,
  onError,
}: ProcessingStatusProps) {
  const [phase, setPhase] = useState<Phase>("transcribing");
  const [errorMessage, setErrorMessage] = useState("");
  const hasTriggeredProcess = useRef(false);
  const hasCompleted = useRef(false);

  useEffect(() => {
    if (!jobId) return;

    const poll = async () => {
      try {
        const res = await fetch(`${apiUrl}/status?jobId=${jobId}`);
        if (!res.ok) throw new Error("Không thể kiểm tra trạng thái.");

        const data = await res.json();

        if (data.status === "FAILED") {
          setPhase("failed");
          const msg = data.errorMessage || "Đã xảy ra lỗi không xác định.";
          setErrorMessage(msg);
          await client.models.MeetingJob.update({
            id: jobId,
            status: "FAILED",
            errorMessage: msg,
          });
          onError(msg);
          return;
        }

        if (
          data.status === "COMPLETED" &&
          data.reportReady &&
          !hasCompleted.current
        ) {
          hasCompleted.current = true;
          setPhase("completed");
          await client.models.MeetingJob.update({
            id: jobId,
            status: "COMPLETED",
            reportKey: `reports/${jobId}.html`,
          });
          onComplete(data.report);
          return;
        }

        if (
          data.status === "COMPLETED" &&
          !data.reportReady &&
          !hasTriggeredProcess.current
        ) {
          hasTriggeredProcess.current = true;
          setPhase("processing");

          const processRes = await fetch(`${apiUrl}/process`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ jobId }),
          });

          if (processRes.ok) {
            const processData = await processRes.json();
            if (processData.report) {
              hasCompleted.current = true;
              setPhase("completed");
              await client.models.MeetingJob.update({
                id: jobId,
                status: "COMPLETED",
                reportKey: `reports/${jobId}.html`,
              });
              onComplete(processData.report);
              return;
            }
          }
          return;
        }

        if (data.status === "PROCESSING") {
          setPhase("processing");
        }
      } catch (err: any) {
        // Silently continue polling on transient errors
      }
    };

    poll();
    const intervalId = setInterval(poll, 5000);

    return () => clearInterval(intervalId);
  }, [jobId, onComplete, onError]);

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardContent className="flex flex-col items-center gap-4 py-8">
        {phase === "failed" ? (
          <>
            <XCircle className="size-10 text-destructive" />
            <p className="text-sm font-medium text-destructive">
              {errorMessage}
            </p>
          </>
        ) : phase === "completed" ? (
          <>
            <CheckCircle className="size-10 text-green-600" />
            <p className="text-sm font-medium text-green-600">
              {PHASE_MESSAGES.completed}
            </p>
          </>
        ) : (
          <>
            <Loader2 className="size-10 text-primary animate-spin" />
            <p className="text-sm font-medium">{PHASE_MESSAGES[phase]}</p>
            <p className="text-xs text-muted-foreground">
              Quá trình này có thể mất vài phút...
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
