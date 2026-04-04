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
    const today = new Date();
    const day = today.getDate();
    const month = today.getMonth() + 1;
    const year = today.getFullYear();

    const esc = (s: string) =>
      s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

    // Extract "Chi bộ tháng X/Y" subtitle and skip the duplicate title Claude outputs.
    let subtitleMonth = "";
    const bodyLines: string[] = [];
    let pastPreamble = false;
    for (const line of report.split("\n")) {
      const trimmed = line.trim();
      if (!pastPreamble) {
        if (trimmed === "NGHỊ QUYẾT") continue;
        if (/^Chi bộ tháng/i.test(trimmed)) {
          // Extract the month/year portion, e.g. "3/2026" or "tháng 3/2026"
          const m = trimmed.match(/tháng\s+(.+)/i);
          subtitleMonth = m ? m[1] : trimmed;
          continue;
        }
        if (trimmed === "") continue;
        pastPreamble = true;
      }
      bodyLines.push(line);
    }

    const pStyle = `style='margin-top:6.0pt;margin-right:0in;margin-bottom:6.0pt;margin-left:0in;text-indent:.5in;line-height:18.0pt'`;
    const spanStyle = `style='font-size:14.0pt;font-family:"Times New Roman",serif'`;

    // Format body lines to match template paragraph styles
    const formattedBody = bodyLines
      .map((line) => {
        const t = line.trim();
        if (t === "") return `<p ${pStyle}><span ${spanStyle}>&nbsp;</span></p>`;
        // Roman-numeral top-level headers: I., II., III. …
        if (/^(I{1,3}|IV|V?I{0,3}|IX|X)\.\s/.test(t)) {
          return `<p ${pStyle}><b><span ${spanStyle}>${esc(t)}</span></b></p>`;
        }
        // Numbered sub-section headers: 1., 2., 3. …
        if (/^\d+\.\s/.test(t)) {
          return `<p ${pStyle}><b><span ${spanStyle}>${esc(t)}</span></b></p>`;
        }
        // * note lines — regular weight (matches template)
        if (t.startsWith("*")) {
          return `<p ${pStyle}><span ${spanStyle}>${esc(t)}</span></p>`;
        }
        return `<p ${pStyle}><span ${spanStyle}>${esc(t)}</span></p>`;
      })
      .join("\n");

    const wordContent = `<html xmlns:o='urn:schemas-microsoft-com:office:office'
xmlns:w='urn:schemas-microsoft-com:office:word'
xmlns='http://www.w3.org/TR/REC-html40'>
<head>
<meta http-equiv=Content-Type content="text/html; charset=utf-8">
<meta name=Generator content="Microsoft Word 15 (filtered)">
<style>
 p.MsoNormal, li.MsoNormal, div.MsoNormal { margin:0in; text-align:justify; font-size:11.0pt; font-family:"Calibri",sans-serif; }
 p.MsoBodyText, li.MsoBodyText, div.MsoBodyText { margin-top:0in; margin-right:0in; margin-bottom:6.0pt; margin-left:0in; font-size:12.0pt; font-family:"Times New Roman",serif; }
 p.MsoBodyTextIndent, li.MsoBodyTextIndent, div.MsoBodyTextIndent { margin-top:0in; margin-right:0in; margin-bottom:6.0pt; margin-left:0in; text-align:justify; font-size:11.0pt; font-family:"Calibri",sans-serif; }
 @page WordSection1 { size:595.3pt 841.9pt; margin:.5in .5in .5in .5in; }
 div.WordSection1 { page:WordSection1; }
</style>
</head>
<body lang=VI style='word-wrap:break-word'>
<div class=WordSection1>

<table border=0 cellspacing=0 cellpadding=0 style='border-collapse:collapse'>
 <tr>
  <td width=302 valign=top style='width:226.55pt;padding:0in 5.4pt 0in 5.4pt'>
   <p class=MsoNormal><span style='font-size:14.0pt;font-family:"Times New Roman",serif'>ĐẢNG ỦY PHƯỜNG CẨM LỆ</span></p>
   <p class=MsoNormal><b><span style='font-size:14.0pt;font-family:"Times New Roman",serif'>CHI BỘ </span></b><span style='font-size:14.0pt;font-family:"Times New Roman",serif'>……………………………</span></p>
   <p class=MsoNormal align=center style='text-align:center'><span style='font-size:14.0pt;font-family:"Times New Roman",serif'>*</span></p>
   <p class=MsoNormal align=center style='text-align:center'><span style='font-size:14.0pt;font-family:"Times New Roman",serif'>Số &nbsp;&nbsp;&nbsp;&nbsp;-NQ/CB</span></p>
   <p class=MsoNormal align=center style='text-align:center'><span style='font-size:14.0pt;font-family:"Times New Roman",serif'>&nbsp;</span></p>
  </td>
  <td width=19 valign=top style='width:14.2pt;padding:0in 5.4pt 0in 5.4pt'><p class=MsoNormal>&nbsp;</p></td>
  <td width=302 valign=top style='width:226.5pt;padding:0in 5.4pt 0in 5.4pt'>
   <p class=MsoNormal align=right style='text-align:right'><b><span style='font-size:14.0pt;font-family:"Times New Roman",serif'>ĐẢNG CỘNG SẢN VIỆT NAM</span></b></p>
   <p class=MsoNormal align=center style='text-align:right'><b><span style='font-size:13.0pt;font-family:"Times New Roman",serif;text-decoration:underline'>Độc lập - Tự do - Hạnh phúc</span></b></p>
   <p class=MsoNormal align=right style='margin-top:6.0pt;text-align:right'><i><span style='font-size:14.0pt;font-family:"Times New Roman",serif'>Cẩm Lệ, ngày ${day} tháng ${month} năm ${year}</span></i></p>
  </td>
 </tr>
</table>

<p class=MsoNormal align=center style='text-align:center'><b><span style='font-size:14.0pt;font-family:"Times New Roman",serif'>&nbsp;</span></b></p>

<p class=MsoNormal align=center style='text-align:center'><b><span style='font-size:14.0pt;font-family:"Times New Roman",serif'>NGHỊ QUYẾT </span></b></p>

<p class=MsoNormal align=center style='text-align:center'><b><span style='font-size:14.0pt;font-family:"Times New Roman",serif'>Chi bộ tháng </span></b><span style='font-size:14.0pt;font-family:"Times New Roman",serif'>${esc(subtitleMonth)}</span></p>

<p class=MsoNormal align=center style='text-align:center'><span style='font-size:14.0pt;font-family:"Times New Roman",serif'>&nbsp;</span></p>

${formattedBody}

<p style='margin-top:6.0pt;margin-right:0in;margin-bottom:6.0pt;margin-left:0in;text-indent:.5in;line-height:18.0pt'><span style='font-size:14.0pt;font-family:"Times New Roman",serif'>Trên đây là Nghị quyết thực hiện nhiệm vụ tháng ${esc(subtitleMonth)} của Chi bộ …………………………………………………, Chi bộ yêu cầu các đảng viên, cụ thể hóa thành nhiệm vụ cụ từng tập thể, cá nhân để triển khai thực hiện đạt kết quả.</span></p>

<table border=0 cellspacing=0 cellpadding=0 style='margin-left:5.4pt;border-collapse:collapse'>
 <tr style='height:122.35pt'>
  <td width=302 valign=top style='width:3.15in;padding:0in 5.4pt 0in 5.4pt;height:122.35pt'>
   <p class=MsoNormal style='margin-bottom:2.0pt'><u><span style='font-size:13.0pt;font-family:"Times New Roman",serif'>Nơi nhận:</span></u></p>
   <p class=MsoNormal><span style='font-size:13.0pt;font-family:"Times New Roman",serif'>- Đảng viên chi bộ,</span></p>
   <p class=MsoNormal><span style='font-size:13.0pt;font-family:"Times New Roman",serif'>- Lưu Chi bộ.</span></p>
  </td>
  <td width=19 valign=top style='width:14.2pt;padding:0in 5.4pt 0in 5.4pt;height:122.35pt'><p class=MsoBodyText><span style='font-size:14.0pt'>&nbsp;</span></p></td>
  <td width=302 valign=top style='width:3.15in;padding:0in 5.4pt 0in 5.4pt;height:122.35pt'>
   <p class=MsoBodyText align=center style='margin-bottom:0in;text-align:center'><b><span style='font-size:14.0pt'>BÍ THƯ</span></b></p>
   <p class=MsoBodyText align=center style='margin-bottom:0in;text-align:center'><b><span style='font-size:14.0pt'>&nbsp;</span></b></p>
   <p class=MsoBodyText align=center style='margin-bottom:0in;text-align:center'><b><span style='font-size:14.0pt'>&nbsp;</span></b></p>
   <p class=MsoBodyText align=center style='margin-bottom:0in;text-align:center'><b><span style='font-size:14.0pt'>&nbsp;</span></b></p>
   <p class=MsoBodyText align=center style='margin-bottom:0in;text-align:center'><b><span style='font-size:14.0pt'>&nbsp;</span></b></p>
   <p class=MsoBodyText align=center style='margin-bottom:0in;text-align:center'><b><span style='font-size:14.0pt'>&nbsp;</span></b></p>
  </td>
 </tr>
</table>

</div>
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
