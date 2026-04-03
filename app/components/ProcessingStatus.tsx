"use client";

import { useEffect, useRef, useState } from "react";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "@/amplify/data/resource";
import { CheckCircle, XCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import outputs from "@/amplify_outputs.json";

const apiUrl = (outputs as any).custom?.apiUrl;
const client = generateClient<Schema>({ authMode: "apiKey" });

interface ProcessingStatusProps {
  jobId: string;
  audioKey: string;
  audioDurationSeconds: number;
  onComplete: (report: string) => void;
  onError: (error: string) => void;
  onCancel: () => void;
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

const formatTime = (seconds: number) => {
  if (seconds < 60) return `${seconds} giây`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s > 0 ? `${m} phút ${s} giây` : `${m} phút`;
};

export default function ProcessingStatus({
  jobId,
  audioKey,
  audioDurationSeconds,
  onComplete,
  onError,
  onCancel,
}: ProcessingStatusProps) {
  const [phase, setPhase] = useState<Phase>("transcribing");
  const [errorMessage, setErrorMessage] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [cancelling, setCancelling] = useState(false);
  const hasTriggeredProcess = useRef(false);
  const hasCompleted = useRef(false);
  const phaseStartRef = useRef<number>(Date.now());

  const handleCancel = async () => {
    if (!confirm("Bạn có chắc muốn hủy quá trình xử lý không?")) return;
    setCancelling(true);
    try {
      await fetch(`${apiUrl}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId, audioKey }),
      });
      await client.models.MeetingJob.delete({ id: jobId });
    } catch {
      // Best-effort cleanup — proceed regardless
    }
    onCancel();
  };

  useEffect(() => {
    phaseStartRef.current = Date.now();
    setElapsed(0);
    const timer = setInterval(() => {
      setElapsed(Math.floor((Date.now() - phaseStartRef.current) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, [phase]);

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
            reportKey: `reports/${jobId}.txt`,
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
                reportKey: `reports/${jobId}.txt`,
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

  const transcribeProgress =
    audioDurationSeconds > 0
      ? Math.min(Math.round((elapsed / audioDurationSeconds) * 100), 95)
      : null;

  const remaining =
    audioDurationSeconds > 0 ? Math.max(audioDurationSeconds - elapsed, 0) : null;

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
          <div className="w-full space-y-2">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{PHASE_MESSAGES[phase]}</span>
              {phase === "transcribing" && transcribeProgress !== null && (
                <span>{transcribeProgress}%</span>
              )}
            </div>
            <div className="w-full bg-muted rounded-full h-2.5">
              {phase === "transcribing" && transcribeProgress !== null ? (
                <div
                  className="bg-primary h-2.5 rounded-full transition-all duration-1000"
                  style={{ width: `${transcribeProgress}%` }}
                />
              ) : (
                <div className="bg-primary h-2.5 rounded-full animate-pulse w-3/4" />
              )}
            </div>
            {phase === "transcribing" && remaining !== null && (
              <p className="text-xs text-muted-foreground text-right">
                Còn khoảng {formatTime(remaining)}
              </p>
            )}
            {phase === "processing" && (
              <p className="text-xs text-muted-foreground text-right">
                Đã xử lý: {formatTime(elapsed)}
              </p>
            )}
            <div className="flex justify-center pt-1">
              <Button
                variant="outline"
                size="sm"
                onClick={handleCancel}
                disabled={cancelling}
              >
                {cancelling ? "Đang hủy..." : "Hủy"}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
