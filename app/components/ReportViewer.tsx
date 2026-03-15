"use client";

import { useState } from "react";
import { Copy, Download, CheckCircle } from "lucide-react";
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
    await navigator.clipboard.writeText(report);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  const handleDownloadDoc = () => {
    const wordContent = `<html xmlns:o='urn:schemas-microsoft-com:office:office'
    xmlns:w='urn:schemas-microsoft-com:office:word'
    xmlns='http://www.w3.org/TR/REC-html40'>
    <head>
      <meta charset='utf-8'>
      <title>Biên Bản Cuộc Họp</title>
      <!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View></w:WordDocument></xml><![endif]-->
      <style>
        body { font-family: 'Courier New', monospace; margin: 2cm; white-space: pre-wrap; }
      </style>
    </head>
    <body><pre>${report}</pre></body>
  </html>`;
    const blob = new Blob(["\ufeff", wordContent], { type: "application/msword" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bien-ban-cuoc-hop-${new Date().toISOString().slice(0, 10)}.doc`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
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
          <Button variant="outline" onClick={handleDownloadDoc}>
            <Download className="size-4 mr-2" />
            Tải Word (.doc)
          </Button>
          <Button onClick={onClose}>Đóng</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
