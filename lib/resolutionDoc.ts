/**
 * Builds a Word-compatible (.doc) HTML document from the plain-text
 * "Nghị quyết Chi bộ" produced by process-transcript-worker.
 *
 * The worker's prompt emits a fixed layout (Hướng dẫn 42-HD/BTCTW):
 *
 *   ĐẢNG ỦY PHƯỜNG …          <- header block, 4 lines, in this order
 *   CHI BỘ …
 *   Số …-NQ/CB
 *   Cẩm Lệ, ngày … tháng … năm …
 *
 *   NGHỊ QUYẾT
 *   Lãnh đạo thực hiện nhiệm vụ tháng …   <- title line
 *
 *   …body: I./II./III./IV. sections, 1./2. sub-sections, a)/b) items,
 *          "• " bullets, and pipe-delimited table rows in Mục I.3…
 *
 *   Nơi nhận:                  <- recipients list, "- " lines
 *   - …
 *
 *   T/M CHI ỦY                 <- signature block
 *   BÍ THƯ
 *   [name]
 *
 *   PHỤ LỤC: …                 <- optional appendix, starts a new page
 *
 * Everything is plain text except the pipe table, which is the one
 * documented exception (plain text cannot express a 4-column grid).
 */

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const FONT = `font-size:14.0pt;font-family:"Times New Roman",serif`;
const P_BODY = `style='margin-top:6.0pt;margin-right:0in;margin-bottom:6.0pt;margin-left:0in;text-align:justify;text-indent:.5in;line-height:18.0pt'`;
const P_HEAD = `style='margin-top:12.0pt;margin-right:0in;margin-bottom:6.0pt;margin-left:0in;text-align:justify;line-height:18.0pt'`;
const P_FLUSH = `style='margin-top:6.0pt;margin-right:0in;margin-bottom:6.0pt;margin-left:0in;text-align:justify;line-height:18.0pt'`;
const P_BULLET = `style='margin-top:3.0pt;margin-right:0in;margin-bottom:3.0pt;margin-left:.5in;text-align:justify;line-height:18.0pt'`;
const CELL = `style='border:solid windowtext 1.0pt;padding:3.0pt 5.4pt 3.0pt 5.4pt'`;

/** Roman-numeral top-level header, e.g. "I. ĐÁNH GIÁ…" */
const RE_ROMAN = /^(I|II|III|IV|V|VI|VII|VIII|IX|X)\.\s+\S/;
/** Numbered sub-section, e.g. "1. Về công tác chính trị, tư tưởng" */
const RE_NUMBER = /^\d+\.\s+\S/;
/** Lettered item in Vietnamese ordering, e.g. "đ) Công tác quản lý đảng viên" */
const RE_LETTER = /^[a-zđ]\)\s+\S/;
/** Table row: "| a | b | c |" */
const RE_TABLE = /^\|.*\|$/;

interface ParsedReport {
  dangUy: string;
  chiBo: string;
  soNq: string;
  diaDanhNgay: string;
  title: string;
  body: string[];
  noiNhan: string[];
  signature: string[];
  appendix: string[];
}

/**
 * Splits the report into its structural blocks. Missing blocks come back
 * empty — the exporter falls back to placeholders so a partially-formed
 * report still downloads.
 */
export function parseReport(report: string): ParsedReport {
  const lines = report.split("\n").map((l) => l.replace(/\s+$/, ""));

  const parsed: ParsedReport = {
    dangUy: "",
    chiBo: "",
    soNq: "",
    diaDanhNgay: "",
    title: "",
    body: [],
    noiNhan: [],
    signature: [],
    appendix: [],
  };

  let i = 0;
  const skipBlank = () => {
    while (i < lines.length && lines[i].trim() === "") i++;
  };

  // --- Header block: everything before the "NGHỊ QUYẾT" title line --------
  // The title must appear near the top; a report without one (an older-format
  // report, or a truncated generation) has no header block and is all body.
  const titleIdx = lines.findIndex(
    (l, idx) => idx < 12 && l.trim().toUpperCase() === "NGHỊ QUYẾT"
  );

  if (titleIdx !== -1) {
    for (; i < titleIdx; i++) {
      const t = lines[i].trim();
      if (t === "") continue;
      if (/^ĐẢNG ỦY/i.test(t)) parsed.dangUy = t;
      else if (/^CHI BỘ/i.test(t)) parsed.chiBo = t;
      else if (/^Số\s/i.test(t)) parsed.soNq = t;
      else if (/ngày\s+.*\s+tháng\s+.*\s+năm/i.test(t)) parsed.diaDanhNgay = t;
    }
    i = titleIdx + 1;
    skipBlank();
    // The line after the title is the subject line ("Lãnh đạo thực hiện…"),
    // unless the body starts immediately with a Roman-numeral section.
    if (i < lines.length && !RE_ROMAN.test(lines[i].trim())) {
      parsed.title = lines[i].trim();
      i++;
    }
  }

  // --- Body / Nơi nhận / signature / appendix ------------------------------
  type Section = "body" | "noiNhan" | "signature" | "appendix";
  let section: Section = "body";

  for (; i < lines.length; i++) {
    const t = lines[i].trim();

    if (/^Nơi nhận:/i.test(t)) {
      section = "noiNhan";
      continue;
    }
    if (/^(T\/M CHI ỦY|BÍ THƯ|P\.\s*BÍ THƯ)$/i.test(t)) {
      section = "signature";
    }
    if (/^PHỤ LỤC[\s:]/i.test(t)) {
      section = "appendix";
    }

    switch (section) {
      case "noiNhan":
        if (t.startsWith("-")) parsed.noiNhan.push(t);
        else if (t !== "") {
          // Not a recipient line — the block ended without a signature marker.
          section = "body";
          parsed.body.push(lines[i]);
        }
        break;
      case "signature":
        if (t !== "") parsed.signature.push(t);
        break;
      case "appendix":
        parsed.appendix.push(lines[i]);
        break;
      default:
        parsed.body.push(lines[i]);
    }
  }

  // Trim trailing blank lines from the body.
  while (parsed.body.length && parsed.body[parsed.body.length - 1].trim() === "")
    parsed.body.pop();

  return parsed;
}

/** Renders one "| a | b | c |" run as a bordered Word table. */
function renderTable(rows: string[]): string {
  const cells = rows.map((r) =>
    r
      .replace(/^\|/, "")
      .replace(/\|$/, "")
      .split("|")
      .map((c) => c.trim())
  );
  const html = cells
    .map((row, rowIdx) => {
      const tds = row
        .map((cell) => {
          const inner = rowIdx === 0 ? `<b>${esc(cell)}</b>` : esc(cell);
          const align = rowIdx === 0 ? ` align=center style='text-align:center'` : "";
          return `<td ${CELL}><p class=MsoNormal${align}><span style='${FONT}'>${inner || "&nbsp;"}</span></p></td>`;
        })
        .join("");
      return ` <tr>${tds}</tr>`;
    })
    .join("\n");
  return `<table border=1 cellspacing=0 cellpadding=0 width="100%" style='border-collapse:collapse;border:solid windowtext 1.0pt'>\n${html}\n</table>`;
}

/** Renders the body lines, grouping consecutive pipe rows into tables. */
function renderBody(lines: string[]): string {
  const out: string[] = [];
  let tableRows: string[] = [];

  const flushTable = () => {
    if (tableRows.length) {
      out.push(renderTable(tableRows));
      tableRows = [];
    }
  };

  for (const line of lines) {
    const t = line.trim();

    if (RE_TABLE.test(t)) {
      // Drop Markdown separator rows ("|---|---|") if the model emits them.
      if (!/^\|[\s\-:|]+\|$/.test(t)) tableRows.push(t);
      continue;
    }
    flushTable();

    if (t === "") {
      // Paragraph margins already provide the spacing; an empty paragraph
      // here would double it up against the reference document.
      continue;
    }

    if (RE_ROMAN.test(t)) {
      out.push(
        `<p ${P_HEAD}><b><span style='${FONT}'>${esc(t.toUpperCase())}</span></b></p>`
      );
    } else if (RE_NUMBER.test(t)) {
      out.push(`<p ${P_FLUSH}><b><span style='${FONT}'>${esc(t)}</span></b></p>`);
    } else if (RE_LETTER.test(t)) {
      out.push(`<p ${P_FLUSH}><i><span style='${FONT}'>${esc(t)}</span></i></p>`);
    } else if (/^[•\-\u2022]\s/.test(t)) {
      out.push(`<p ${P_BULLET}><span style='${FONT}'>${esc(t)}</span></p>`);
    } else {
      out.push(`<p ${P_BODY}><span style='${FONT}'>${esc(t)}</span></p>`);
    }
  }
  flushTable();
  return out.join("\n");
}

function renderAppendix(lines: string[]): string {
  const trimmed = [...lines];
  while (trimmed.length && trimmed[0].trim() === "") trimmed.shift();
  while (trimmed.length && trimmed[trimmed.length - 1].trim() === "") trimmed.pop();
  if (!trimmed.length) return "";
  const heading = trimmed.shift()!.trim();
  return `
<br clear=all style='page-break-before:always'>
<p class=MsoNormal align=center style='text-align:center'><b><span style='${FONT}'>${esc(heading)}</span></b></p>
<p class=MsoNormal align=center style='text-align:center'><span style='${FONT}'>&nbsp;</span></p>
${renderBody(trimmed)}`;
}

/**
 * Builds the full Word HTML document. `report` is the worker's plain-text
 * output; the return value is written to a Blob by the caller.
 */
export function buildResolutionDoc(report: string): string {
  const p = parseReport(report);

  const today = new Date();
  const fallbackDate = `Cẩm Lệ, ngày ${today.getDate()} tháng ${
    today.getMonth() + 1
  } năm ${today.getFullYear()}`;

  const dangUy = p.dangUy || "ĐẢNG ỦY PHƯỜNG CẨM LỆ";
  const chiBoLabel = p.chiBo || "CHI BỘ ……………………";
  const soNq = p.soNq || "Số      -NQ/CB";
  const diaDanhNgay = p.diaDanhNgay || fallbackDate;

  const noiNhan = p.noiNhan.length
    ? p.noiNhan
    : ["- Đảng viên chi bộ,", "- Lưu Chi bộ."];

  // Signature: "T/M CHI ỦY" / "BÍ THƯ" / optional signer name.
  const sigLines = p.signature.length ? p.signature : ["T/M CHI ỦY", "BÍ THƯ"];
  const sigTitles = sigLines.filter((l) => /^(T\/M|BÍ THƯ|P\.)/i.test(l));
  const sigName = sigLines.filter((l) => !/^(T\/M|BÍ THƯ|P\.)/i.test(l));

  const sigHtml = [
    ...sigTitles.map(
      (l) =>
        `   <p class=MsoNormal align=center style='text-align:center'><b><span style='${FONT}'>${esc(l)}</span></b></p>`
    ),
    ...Array.from(
      { length: 5 },
      () =>
        `   <p class=MsoNormal align=center style='text-align:center'><span style='${FONT}'>&nbsp;</span></p>`
    ),
    ...sigName.map(
      (l) =>
        `   <p class=MsoNormal align=center style='text-align:center'><b><span style='${FONT}'>${esc(l)}</span></b></p>`
    ),
  ].join("\n");

  return `<html xmlns:o='urn:schemas-microsoft-com:office:office'
xmlns:w='urn:schemas-microsoft-com:office:word'
xmlns='http://www.w3.org/TR/REC-html40'>
<head>
<meta http-equiv=Content-Type content="text/html; charset=utf-8">
<meta name=Generator content="Microsoft Word 15 (filtered)">
<style>
 p.MsoNormal, li.MsoNormal, div.MsoNormal { margin:0in; text-align:justify; font-size:14.0pt; font-family:"Times New Roman",serif; }
 p.MsoBodyText, li.MsoBodyText, div.MsoBodyText { margin-top:0in; margin-right:0in; margin-bottom:6.0pt; margin-left:0in; font-size:14.0pt; font-family:"Times New Roman",serif; }
 table { font-size:14.0pt; font-family:"Times New Roman",serif; }
 @page WordSection1 { size:595.3pt 841.9pt; margin:.79in .59in .79in 1.18in; }
 div.WordSection1 { page:WordSection1; }
</style>
</head>
<body lang=VI style='word-wrap:break-word'>
<div class=WordSection1>

<table border=0 cellspacing=0 cellpadding=0 style='border-collapse:collapse'>
 <tr>
  <td width=302 valign=top style='width:226.55pt;padding:0in 5.4pt 0in 5.4pt'>
   <p class=MsoNormal align=center style='text-align:center'><span style='${FONT}'>${esc(dangUy)}</span></p>
   <p class=MsoNormal align=center style='text-align:center'><b><span style='${FONT}'>${esc(chiBoLabel)}</span></b></p>
   <p class=MsoNormal align=center style='text-align:center'><span style='${FONT}'>*</span></p>
   <p class=MsoNormal align=center style='text-align:center'><span style='${FONT}'>${esc(soNq)}</span></p>
  </td>
  <td width=19 valign=top style='width:14.2pt;padding:0in 5.4pt 0in 5.4pt'><p class=MsoNormal>&nbsp;</p></td>
  <td width=302 valign=top style='width:226.5pt;padding:0in 5.4pt 0in 5.4pt'>
   <p class=MsoNormal align=center style='text-align:center'><b><span style='${FONT}'>ĐẢNG CỘNG SẢN VIỆT NAM</span></b></p>
   <p class=MsoNormal align=center style='text-align:center'><span style='${FONT}'>—————————————</span></p>
   <p class=MsoNormal align=center style='margin-top:6.0pt;text-align:center'><i><span style='${FONT}'>${esc(diaDanhNgay)}</span></i></p>
  </td>
 </tr>
</table>

<p class=MsoNormal align=center style='text-align:center'><span style='${FONT}'>&nbsp;</span></p>

<p class=MsoNormal align=center style='text-align:center'><b><span style='${FONT}'>NGHỊ QUYẾT</span></b></p>

<p class=MsoNormal align=center style='text-align:center'><b><span style='${FONT}'>${esc(
    p.title || "Lãnh đạo thực hiện nhiệm vụ tháng ……"
  )}</span></b></p>

<p class=MsoNormal align=center style='text-align:center'><span style='${FONT}'>—————</span></p>

${renderBody(p.body)}

<table border=0 cellspacing=0 cellpadding=0 style='margin-left:5.4pt;border-collapse:collapse'>
 <tr>
  <td width=302 valign=top style='width:3.15in;padding:0in 5.4pt 0in 5.4pt'>
   <p class=MsoNormal style='margin-bottom:2.0pt'><b><i><u><span style='font-size:13.0pt;font-family:"Times New Roman",serif'>Nơi nhận:</span></u></i></b></p>
${noiNhan
  .map(
    (l) =>
      `   <p class=MsoNormal><span style='font-size:12.0pt;font-family:"Times New Roman",serif'>${esc(l)}</span></p>`
  )
  .join("\n")}
  </td>
  <td width=19 valign=top style='width:14.2pt;padding:0in 5.4pt 0in 5.4pt'><p class=MsoNormal>&nbsp;</p></td>
  <td width=302 valign=top style='width:3.15in;padding:0in 5.4pt 0in 5.4pt'>
${sigHtml}
  </td>
 </tr>
</table>
${renderAppendix(p.appendix)}

</div>
</body>
</html>`;
}
