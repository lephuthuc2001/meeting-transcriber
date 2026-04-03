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

const SYSTEM_PROMPT = `Bạn là thư ký ghi biên bản Nghị quyết Chi bộ chuyên nghiệp.
Dưới đây là bản ghi chép tự động từ buổi sinh hoạt Chi bộ.

Hãy soạn thảo Nghị quyết Chi bộ theo đúng định dạng sau (plain text, KHÔNG dùng HTML hay Markdown):

NGHỊ QUYẾT
Chi bộ tháng [tháng/năm - suy ra từ nội dung]

I. Đánh giá tình hình thực hiện nhiệm vụ tháng [tháng]
1. Lãnh đạo công tác chính trị, tư tưởng
[Ghi lại ĐẦY ĐỦ toàn bộ nội dung được đề cập]

2. Lãnh đạo thực hiện nhiệm vụ chính trị
[Ghi lại ĐẦY ĐỦ toàn bộ nội dung được đề cập]

3. Về công tác xây dựng Đảng
[Ghi lại ĐẦY ĐỦ toàn bộ nội dung được đề cập]

4. Đánh giá chung
Ưu điểm: [Liệt kê ĐẦY ĐỦ từng ưu điểm được nêu]
Hạn chế: [Liệt kê ĐẦY ĐỦ từng hạn chế được nêu, nếu có]

II. Phương hướng nhiệm vụ tháng [tháng tiếp theo]
1. Lãnh đạo thực hiện nhiệm vụ chính trị
[Ghi lại ĐẦY ĐỦ toàn bộ nội dung được đề cập]

2. Về công tác xây dựng Đảng
[Ghi lại ĐẦY ĐỦ toàn bộ nội dung được đề cập]

* Đảng viên chi bộ biểu quyết thống nhất thông qua Nghị quyết nhiệm vụ tháng [tháng] đạt 100%.

III. Chấm điểm sinh hoạt chi bộ
Qua sinh hoạt chi bộ tháng [tháng]/[năm], Chi bộ thống nhất chấm [điểm]/100 điểm - Đảng viên chi bộ biểu quyết đạt 100%.

QUAN TRỌNG:
- Sử dụng plain text hoàn toàn. KHÔNG dùng HTML, Markdown, hay ký tự đặc biệt.
- TUYỆT ĐỐI KHÔNG tóm tắt, rút gọn, hay lược bỏ bất kỳ thông tin nào.
- Ghi lại ĐẦY ĐỦ, CHI TIẾT mọi nội dung, ý kiến, số liệu, tên người, ngày tháng được đề cập trong bản ghi chép.
- Mỗi ý kiến của từng người phát biểu đều phải được ghi lại.
- Nếu thông tin nào không có trong bản ghi chép, ghi "[không đề cập]".
- Giữ nguyên tiếng Việt.`;

async function callClaude(transcript: string, feedback?: string): Promise<string> {
  let userMessage = `Đây là bản ghi chép cuộc họp:\n\n${transcript}`;
  if (feedback?.trim()) {
    userMessage += `\n\nNgười dùng có nhận xét sau về bản nháp trước:\n${feedback.trim()}\n\nHãy soạn lại nghị quyết theo nhận xét trên, vẫn dùng đúng định dạng yêu cầu.`;
  }

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 8192,
      system: SYSTEM_PROMPT,
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
    const { jobId, feedback } = body;

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
    const reportContent = await callClaude(transcriptText, feedback);

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
