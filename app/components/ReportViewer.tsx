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
    const today = new Date();
    const day = today.getDate();
    const month = today.getMonth() + 1;
    const year = today.getFullYear();

    const wordContent = `<html xmlns:o='urn:schemas-microsoft-com:office:office'
    xmlns:w='urn:schemas-microsoft-com:office:word'
    xmlns='http://www.w3.org/TR/REC-html40'>
    <head>
      <meta charset='utf-8'>
      <title>Nghị Quyết Chi Bộ</title>
      <!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom></w:WordDocument></xml><![endif]-->
      <style>
        body { font-family: 'Times New Roman', serif; font-size: 14pt; margin: 2cm 2.5cm; }
        .header-table { width: 100%; border-collapse: collapse; margin-bottom: 4pt; }
        .header-left { font-weight: bold; font-size: 14pt; width: 50%; vertical-align: top; }
        .header-right { font-weight: bold; font-size: 14pt; width: 50%; text-align: right; vertical-align: top; }
        .so-hieu { text-align: center; font-size: 14pt; margin: 6pt 0; }
        .title { text-align: center; font-weight: bold; font-size: 14pt; margin: 12pt 0 2pt 0; }
        .subtitle { text-align: center; font-weight: bold; font-size: 14pt; margin: 0 0 12pt 0; }
        .content { font-size: 14pt; white-space: pre-wrap; line-height: 1.5; margin: 6pt 0; }
        .footer-table { width: 100%; border-collapse: collapse; margin-top: 16pt; }
        .footer-left { font-size: 13pt; width: 50%; vertical-align: top; }
        .footer-right { font-size: 14pt; font-weight: bold; width: 50%; text-align: center; vertical-align: top; }
      </style>
    </head>
    <body>
      <table class="header-table">
        <tr>
          <td class="header-left">ĐẢNG ỦY PHƯỜNG CẨM LỆ<br/>CHI BỘ ……………………………</td>
          <td class="header-right">ĐẢNG CỘNG SẢN VIỆT NAM<br/>Cẩm Lệ, ngày ${day} tháng ${month} năm ${year}</td>
        </tr>
      </table>
      <div class="so-hieu">*<br/>Số &nbsp;&nbsp;&nbsp;-NQ/CB</div>
      <div class="title">NGHỊ QUYẾT</div>
      <div class="content">${report}</div>
      <table class="footer-table">
        <tr>
          <td class="footer-left">
            Nơi nhận:<br/>
            - Đảng viên chi bộ,<br/>
            - Lưu Chi bộ.
          </td>
          <td class="footer-right">BÍ THƯ</td>
        </tr>
      </table>
    </body>
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
