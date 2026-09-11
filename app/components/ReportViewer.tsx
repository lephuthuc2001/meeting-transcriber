"use client";

import { useState } from "react";
import { Copy, Download, CheckCircle, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { buildResolutionDoc } from "@/lib/resolutionDoc";
import outputs from "@/amplify_outputs.json";

const apiUrl = (outputs as any).custom?.apiUrl;

interface ReportViewerProps {
  report: string;
  jobId: string;
  onClose: () => void;
}

export default function ReportViewer({ report: initialReport, jobId, onClose }: ReportViewerProps) {
  const [report, setReport] = useState(initialReport);
  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [regenerating, setRegenerating] = useState(false);
  const [regenError, setRegenError] = useState<string | null>(null);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(report);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  const handleDownloadDoc = () => {
    const wordContent = buildResolutionDoc(report);
    const blob = new Blob(["\ufeff", wordContent], { type: "application/msword" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `nghi-quyet-chi-bo-${new Date().toISOString().slice(0, 10)}.doc`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
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
            toast.success("Đã tạo lại biên bản thành công!");
            return;
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
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Biên bản cuộc họp</DialogTitle>
          <DialogDescription>
            Xem, sao chép hoặc tải xuống biên bản cuộc họp
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto rounded-md border bg-white p-6">
          <pre className="text-sm font-mono whitespace-pre-wrap break-words">{report}</pre>
        </div>

        {/* Feedback section */}
        <div className="space-y-2 pt-2">
          <Textarea
            placeholder="Nhận xét / yêu cầu chỉnh sửa... (ví dụ: Phần II thiếu chi tiết về công tác thu phí)"
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            rows={3}
            disabled={regenerating}
          />
          {regenError && (
            <p className="text-sm text-destructive">{regenError}</p>
          )}
          <Button
            variant="secondary"
            onClick={handleRegenerate}
            disabled={!feedback.trim() || regenerating || !jobId}
            className="w-full"
          >
            {regenerating ? (
              <>
                <RefreshCw className="size-4 mr-2 animate-spin" />
                Đang tạo lại...
              </>
            ) : (
              <>
                <RefreshCw className="size-4 mr-2" />
                Tạo lại biên bản
              </>
            )}
          </Button>
        </div>

        {copied && (
          <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 rounded-md px-3 py-2">
            <CheckCircle className="size-4" />
            Đã sao chép! Dán vào Word để xem định dạng.
          </div>
        )}

        <DialogFooter className="flex-wrap gap-2">
          <Button variant="outline" onClick={handleCopy} disabled={regenerating}>
            <Copy className="size-4 mr-2" />
            Sao chép nội dung
          </Button>
          <Button variant="outline" onClick={handleDownloadDoc} disabled={regenerating}>
            <Download className="size-4 mr-2" />
            Tải Word (.doc)
          </Button>
          <Button onClick={onClose}>Đóng</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
