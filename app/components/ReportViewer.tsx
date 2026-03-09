"use client";

import { useState } from "react";
import { Copy, Download, Printer, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";

interface ReportViewerProps {
  report: string;
  onClose: () => void;
}

export default function ReportViewer({ report, onClose }: ReportViewerProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      const blob = new Blob([report], { type: "text/html" });
      const clipboardItem = new ClipboardItem({ "text/html": blob });
      await navigator.clipboard.write([clipboardItem]);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch {
      // Fallback to plain text copy
      const tempEl = document.createElement("div");
      tempEl.innerHTML = report;
      await navigator.clipboard.writeText(tempEl.textContent || "");
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    }
  };

  const handleDownload = () => {
    const fullHtml = `<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Biên Bản Cuộc Họp</title>
</head>
<body>
${report}
</body>
</html>`;
    const blob = new Blob([fullHtml], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bien-ban-cuoc-hop-${new Date().toISOString().slice(0, 10)}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(`<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="UTF-8">
<title>Biên Bản Cuộc Họp</title>
<style>
  body { font-family: 'Times New Roman', serif; padding: 2rem; }
  @media print { body { padding: 0; } }
</style>
</head>
<body>
${report}
<script>window.onload = function() { window.print(); }</script>
</body>
</html>`);
      printWindow.document.close();
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
          <div
            className="prose prose-sm max-w-none"
            dangerouslySetInnerHTML={{ __html: report }}
          />
        </div>

        {copied && (
          <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 rounded-md px-3 py-2">
            <CheckCircle className="size-4" />
            Đã sao chép! Dán vào Word để xem định dạng.
          </div>
        )}

        <DialogFooter className="flex-wrap gap-2">
          <Button variant="outline" onClick={handleCopy}>
            <Copy className="size-4 mr-2" />
            Sao chép nội dung
          </Button>
          <Button variant="outline" onClick={handleDownload}>
            <Download className="size-4 mr-2" />
            Tải biên bản
          </Button>
          <Button variant="outline" onClick={handlePrint}>
            <Printer className="size-4 mr-2" />
            In / Lưu PDF
          </Button>
          <Button onClick={onClose}>Đóng</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
