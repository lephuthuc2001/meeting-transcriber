"use client";

import { useState } from "react";
import { Download, FileText, RefreshCw, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { downloadReportDoc } from "@/lib/downloadReport";
import outputs from "@/amplify_outputs.json";

const apiUrl = (outputs as any).custom?.apiUrl;

interface ReportViewerProps {
  report: string;
  jobId: string;
  title?: string | null;
  createdAt?: string | null;
  onClose: () => void;
}

export default function ReportViewer({
  report: initialReport,
  jobId,
  title,
  createdAt,
  onClose,
}: ReportViewerProps) {
  const [report, setReport] = useState(initialReport);
  const [downloaded, setDownloaded] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [regenerating, setRegenerating] = useState(false);
  const [regenError, setRegenError] = useState<string | null>(null);

  const date = createdAt ? new Date(createdAt) : new Date();

  const handleDownloadDoc = () => {
    downloadReportDoc(report, title, date);
    setDownloaded(true);
  };

  const handleRegenerate = async () => {
    if (!feedback.trim() || !jobId) return;
    setRegenerating(true);
    setRegenError(null);
    try {
      // Kick off async processing
      const res = await fetch(`${apiUrl}/process`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId, feedback: feedback.trim() }),
      });
      if (!res.ok) throw new Error("Lỗi khi kích hoạt tạo lại biên bản.");

      // Poll /status until the new report appears (worker saves it to S3)
      for (let attempt = 0; attempt < 60; attempt++) {
        await new Promise((resolve) => setTimeout(resolve, 5000));
        const statusRes = await fetch(`${apiUrl}/status?jobId=${jobId}`);
        if (statusRes.ok) {
          const statusData = await statusRes.json();
          if (statusData.reportReady && statusData.report) {
            setReport(statusData.report);
            setFeedback("");
            setDownloaded(false);
            toast.success("Đã tạo lại biên bản. Hãy tải lại tệp Word mới.");
            return;
          }
          if (statusData.status === "FAILED") {
            throw new Error(
              statusData.errorMessage || "Tạo lại biên bản thất bại."
            );
          }
        }
      }
      throw new Error("Quá thời gian chờ. Vui lòng thử lại.");
    } catch (err: any) {
      setRegenError(err.message || "Đã xảy ra lỗi. Vui lòng thử lại.");
      toast.error("Tạo lại biên bản thất bại. Vui lòng thử lại.");
    } finally {
      setRegenerating(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto gap-6">
        <DialogHeader>
          <DialogTitle className="text-2xl">Biên bản đã sẵn sàng</DialogTitle>
          <DialogDescription className="text-base">
            Tải tệp Word về máy, sau đó mở để kiểm tra nội dung.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-4 rounded-xl border bg-secondary/50 p-4">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-white text-primary border">
            <FileText className="size-6" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-lg font-semibold">
              {title || "Nghị quyết Chi bộ"}
            </p>
            <p className="text-base text-muted-foreground">
              {date.toLocaleDateString("vi-VN")}
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <Button
            size="lg"
            className="h-16 w-full text-lg font-semibold [&_svg:not([class*='size-'])]:size-6"
            onClick={handleDownloadDoc}
            disabled={regenerating}
          >
            <Download />
            Tải biên bản (Word)
          </Button>
          {downloaded ? (
            <p
              role="status"
              className="flex items-center justify-center gap-2 text-base text-green-800"
            >
              <CheckCircle className="size-5" aria-hidden="true" />
              Đã tải xong. Mở thư mục Tải về (Downloads) để xem tệp.
            </p>
          ) : (
            <p className="text-center text-base text-muted-foreground">
              Tệp sẽ được lưu vào thư mục Tải về (Downloads).
            </p>
          )}
        </div>

        <div className="space-y-3 border-t pt-5">
          <label htmlFor="regen-feedback" className="block text-lg font-semibold">
            Cần sửa nội dung?
          </label>
          <p className="text-base text-muted-foreground">
            Ghi rõ phần cần sửa, hệ thống sẽ viết lại biên bản (mất khoảng 1–2 phút).
          </p>
          <Textarea
            id="regen-feedback"
            placeholder="Ví dụ: Phần II thiếu chi tiết về công tác thu phí"
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            rows={3}
            disabled={regenerating}
          />
          {regenError && (
            <p role="alert" className="text-base text-destructive">{regenError}</p>
          )}
          <Button
            variant="outline"
            onClick={handleRegenerate}
            disabled={!feedback.trim() || regenerating || !jobId}
            className="w-full"
          >
            <RefreshCw className={regenerating ? "animate-spin" : undefined} />
            {regenerating ? "Đang viết lại biên bản..." : "Viết lại biên bản"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
