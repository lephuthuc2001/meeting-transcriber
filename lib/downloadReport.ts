import { buildResolutionDoc } from "@/lib/resolutionDoc";

// "Họp chi bộ tháng 9" -> "Hop chi bo thang 9": plain ASCII survives every
// OS/browser download path and is easy to spot in the Downloads folder.
const toAsciiFileName = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .replace(/[\\/:*?"<>|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);

export function buildReportFileName(title?: string | null, date?: Date) {
  const day = (date ?? new Date()).toISOString().slice(0, 10);
  const name = title ? toAsciiFileName(title) : "";
  return name ? `Nghi quyet - ${name} - ${day}.doc` : `Nghi quyet chi bo - ${day}.doc`;
}

export function downloadReportDoc(report: string, title?: string | null, date?: Date) {
  const wordContent = buildResolutionDoc(report.normalize("NFC"));
  const blob = new Blob(["﻿", wordContent], { type: "application/msword" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = buildReportFileName(title, date);
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
