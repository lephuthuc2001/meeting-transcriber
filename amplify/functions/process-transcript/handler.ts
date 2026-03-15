import type { APIGatewayProxyHandler } from "aws-lambda";
import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";

const s3Client = new S3Client();
const BUCKET_NAME = process.env.BUCKET_NAME!;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
};

const SYSTEM_PROMPT_VI = `Bạn là trợ lý tạo biên bản cuộc họp chuyên nghiệp.
Dưới đây là bản ghi chép tự động từ một cuộc họp.

Hãy tạo biên bản theo định dạng sau (plain text, KHÔNG dùng HTML hay Markdown):

[TÊN CUỘC HỌP - suy ra từ nội dung]
================================
THÔNG TIN CUỘC HỌP
-------------------
- Loại họp: [suy ra từ nội dung]
- Thời gian: [nếu được đề cập]
- Nội dung chính: [số phần]

[PHẦN 1: TÊN PHẦN - THEO CHƯƠNG TRÌNH THỰC TẾ]
-----------------------------------------------
[Dùng số thứ tự cho các mục chính]
1. [Mục chính]:
   - [Chi tiết]
     + [Chi tiết nhỏ hơn nếu cần]

[PHẦN 2: ...] (tiếp tục theo chương trình thực tế của cuộc họp)

Ý KIẾN THẢO LUẬN
-----------------
- [Các ý kiến từ người tham dự]

KẾT LUẬN / LƯU Ý KHÁC
-----------------------
[Các kết luận và lưu ý]

QUAN TRỌNG:
- Sử dụng plain text hoàn toàn. KHÔNG dùng HTML, Markdown, hay ký tự đặc biệt.
- Đặt tên phần theo CHƯƠNG TRÌNH THỰC TẾ của cuộc họp (không theo mẫu cứng).
- Trích xuất đầy đủ: số tiền, tên người, ngày tháng, số liệu cụ thể.
- Tiêu đề phần dùng CHỮ HOA.
- Giữ nguyên tiếng Việt. Đảm bảo nội dung chính xác theo bản ghi chép.`;

const SYSTEM_PROMPT_EN = `You are a professional meeting minutes assistant.
Below is an automatically transcribed recording from a meeting.

Create meeting minutes in the following format (plain text, NO HTML or Markdown):

[MEETING NAME - inferred from content]
================================
MEETING INFORMATION
-------------------
- Meeting type: [inferred from content]
- Date/Time: [if mentioned]
- Main sections: [number of sections]

[SECTION 1: SECTION NAME - BASED ON ACTUAL AGENDA]
-----------------------------------------------
[Use numbered items for main points]
1. [Main item]:
   - [Detail]
     + [Sub-detail if needed]

[SECTION 2: ...] (continue following the actual meeting agenda)

DISCUSSION POINTS
-----------------
- [Points raised by participants]

CONCLUSIONS / OTHER NOTES
-----------------------
[Conclusions and notes]

IMPORTANT:
- Use plain text only. NO HTML, Markdown, or special characters.
- Name sections according to the ACTUAL AGENDA of the meeting (not a fixed template).
- Extract fully: amounts, names, dates, specific figures.
- Section headings in ALL CAPS.
- Keep content accurate to the transcript.`;

async function callClaude(transcript: string, language = "vi-VN"): Promise<string> {
  const isEnglish = language === "en-US";
  const systemPrompt = isEnglish ? SYSTEM_PROMPT_EN : SYSTEM_PROMPT_VI;
  const userMessage = isEnglish
    ? `Here is the meeting transcript:\n\n${transcript}`
    : `Đây là bản ghi chép cuộc họp:\n\n${transcript}`;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: userMessage,
        },
      ],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Claude API error ${response.status}: ${err}`);
  }

  const data = (await response.json()) as any;
  return data.content?.[0]?.text ?? "";
}

export const handler: APIGatewayProxyHandler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: CORS_HEADERS, body: "" };
  }

  try {
    const body = JSON.parse(event.body || "{}");
    const { jobId, language = "vi-VN" } = body;

    if (!jobId) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: "Missing required field: jobId" }),
      };
    }

    // Read transcript from S3
    const transcriptObj = await s3Client.send(
      new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: `transcripts/${jobId}.json`,
      }),
    );
    const transcriptRaw = await transcriptObj.Body?.transformToString();
    if (!transcriptRaw) {
      return {
        statusCode: 404,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: "Transcript not found" }),
      };
    }

    const transcriptData = JSON.parse(transcriptRaw);
    const transcriptText: string =
      transcriptData.results?.transcripts?.[0]?.transcript ?? "";

    // Call Claude API via fetch (no SDK needed)
    const reportContent = await callClaude(transcriptText, language);

    // Save report to S3
    await s3Client.send(
      new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: `reports/${jobId}.txt`,
        Body: reportContent,
        ContentType: "text/plain; charset=utf-8",
      }),
    );

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        jobId,
        status: "COMPLETED",
        report: reportContent,
      }),
    };
  } catch (error) {
    console.error("Error processing transcript:", error);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        error: "Failed to process transcript",
        details: error instanceof Error ? error.message : String(error),
      }),
    };
  }
};
