import type { APIGatewayProxyHandler } from "aws-lambda";
import { S3Client, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";

const s3Client = new S3Client();
const BUCKET_NAME = process.env.BUCKET_NAME!;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
};

const SYSTEM_PROMPT = `Bạn là trợ lý tạo biên bản cuộc họp chuyên nghiệp.
Dưới đây là bản ghi chép tự động từ một cuộc họp bằng tiếng Việt.
Hãy tạo một biên bản cuộc họp với các phần sau:

1. Tóm tắt cuộc họp (2-3 câu tổng quan)
2. Các nội dung chính đã thảo luận (danh sách bullet points)
3. Quyết định đã đưa ra (nếu có)
4. Công việc cần thực hiện - Action Items (ai làm gì, deadline nếu được đề cập)
5. Ghi chú khác

QUAN TRỌNG: Sử dụng HTML đơn giản với các thẻ h1, h2, p, ul, li.
KHÔNG dùng CSS phức tạp hoặc class - chỉ dùng inline style cơ bản nếu cần.
Điều này để nội dung có thể copy-paste vào Microsoft Word mà vẫn giữ định dạng.
Giữ nguyên tiếng Việt. Đảm bảo nội dung chính xác theo bản ghi chép.`;

async function callClaude(transcript: string): Promise<string> {
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
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Đây là bản ghi chép cuộc họp:\n\n${transcript}`,
        },
      ],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Claude API error ${response.status}: ${err}`);
  }

  const data = await response.json() as any;
  return data.content?.[0]?.text ?? "";
}

export const handler: APIGatewayProxyHandler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: CORS_HEADERS, body: "" };
  }

  try {
    const body = JSON.parse(event.body || "{}");
    const { jobId } = body;

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
      })
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
    const reportContent = await callClaude(transcriptText);

    // Save report to S3
    await s3Client.send(
      new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: `reports/${jobId}.html`,
        Body: reportContent,
        ContentType: "text/html; charset=utf-8",
      })
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
