"use client";

import { useEffect, useRef, useState } from "react";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "@/amplify/data/resource";
import { Check, CheckCircle, Loader2, XCircle } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import outputs from "@/amplify_outputs.json";

const apiUrl = (outputs as any).custom?.apiUrl;
const client = generateClient<Schema>({ authMode: "iam" });

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

const STEPS = ["Tải lên", "Gỡ băng giọng nói", "Soạn nghị quyết"];

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
  const [confirmOpen, setConfirmOpen] = useState(false);
  const hasTriggeredProcess = useRef(false);
  const hasCompleted = useRef(false);
  const phaseStartRef = useRef<number>(Date.now());

  const handleCancel = async () => {
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

          // /process now returns 202 immediately — worker runs async.
          // Polling loop will detect reportReady: true when worker finishes.
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

  const activeIndex =
    phase === "transcribing" ? 1 : phase === "processing" ? 2 : 3;

  if (phase === "failed" || phase === "completed") {
    const failed = phase === "failed";
    return (
      <Card className={failed ? "border-destructive/30" : "border-success/40"}>
        <CardContent
          role={failed ? "alert" : "status"}
          className="flex flex-col items-center gap-3 py-10 text-center"
        >
          {failed ? (
            <XCircle className="size-12 text-destructive" aria-hidden="true" />
          ) : (
            <CheckCircle className="size-12 text-success" aria-hidden="true" />
          )}
          <p className="font-serif text-lg font-semibold">
            {failed ? "Không thể hoàn tất xử lý" : PHASE_MESSAGES.completed}
          </p>
          {failed && (
            <p className="max-w-md text-sm text-muted-foreground">
              {errorMessage}
            </p>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-primary/25">
      <CardHeader>
        <CardTitle className="font-serif text-xl">
          Đang xử lý cuộc họp
        </CardTitle>
        <CardDescription>
          Bạn có thể giữ nguyên trang này — kết quả sẽ hiển thị ngay khi xong.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <ol className="grid gap-3 sm:grid-cols-3" aria-label="Các bước xử lý">
          {STEPS.map((step, i) => {
            const done = i < activeIndex;
            const active = i === activeIndex;
            return (
              <li
                key={step}
                aria-current={active ? "step" : undefined}
                className={`flex items-center gap-3 rounded-xl border p-3 transition-colors ${
                  active
                    ? "border-primary/40 bg-primary/5"
                    : done
                      ? "border-success/30 bg-success/5"
                      : "bg-muted/40 text-muted-foreground"
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                    done
                      ? "bg-success text-white"
                      : active
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                  }`}
                >
                  {done ? (
                    <Check className="size-4" />
                  ) : active ? (
                    <Loader2 className="size-4 motion-safe:animate-spin" />
                  ) : (
                    i + 1
                  )}
                </span>
                <span className="text-sm font-medium">{step}</span>
                <span className="sr-only">
                  {done ? " — đã xong" : active ? " — đang thực hiện" : " — chờ"}
                </span>
              </li>
            );
          })}
        </ol>

        <div className="space-y-2" role="status" aria-live="polite">
          <div className="flex justify-between text-sm">
            <span className="font-medium">{PHASE_MESSAGES[phase]}</span>
            {phase === "transcribing" && transcribeProgress !== null && (
              <span className="tabular-nums text-muted-foreground">
                {transcribeProgress}%
              </span>
            )}
          </div>
          <div
            className="relative h-2.5 w-full overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-label={PHASE_MESSAGES[phase]}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={
              phase === "transcribing" && transcribeProgress !== null
                ? transcribeProgress
                : undefined
            }
          >
            {phase === "transcribing" && transcribeProgress !== null ? (
              <div
                className="h-full rounded-full bg-primary transition-all duration-1000"
                style={{ width: `${transcribeProgress}%` }}
              />
            ) : (
              <div className="absolute inset-y-0 left-0 w-1/3 rounded-full bg-primary motion-safe:animate-[indeterminate_1.6s_ease-in-out_infinite] motion-reduce:w-3/4" />
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {phase === "transcribing" &&
              remaining !== null &&
              `Còn khoảng ${formatTime(remaining)}`}
            {phase === "transcribing" &&
              remaining === null &&
              `Đã chạy ${formatTime(elapsed)}`}
            {phase === "processing" &&
              `Đã xử lý ${formatTime(elapsed)} — thường mất 1–3 phút`}
          </p>
        </div>

        <div className="flex justify-end border-t pt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setConfirmOpen(true)}
            disabled={cancelling}
          >
            {cancelling ? "Đang hủy..." : "Hủy xử lý"}
          </Button>
        </div>
      </CardContent>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hủy quá trình xử lý?</DialogTitle>
            <DialogDescription>
              Bản ghi âm đã tải lên và tiến trình hiện tại sẽ bị xóa.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Tiếp tục xử lý
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setConfirmOpen(false);
                handleCancel();
              }}
            >
              Hủy xử lý
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
