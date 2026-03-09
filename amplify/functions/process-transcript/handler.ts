import type { APIGatewayProxyHandler } from "aws-lambda";
import { S3Client, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import Anthropic from "@anthropic-ai/sdk";

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

1. **Tóm tắt cuộc họp** (2-3 câu tổng quan)
2. **Các nội dung chính đã thảo luận** (danh sách bullet points)
3. **Quyết định đã đưa ra** (nếu có)
4. **Công việc cần thực hiện (Action Items)** (ai làm gì, deadline nếu được đề cập)
5. **Ghi chú khác**

QUAN TRỌNG: Sử dụng HTML đơn giản với các thẻ h1, h2, p, ul, li, table.
KHÔNG dùng CSS phức tạp hoặc class - chỉ dùng inline style cơ bản.
Điều này để nội dung có thể copy-paste vào Microsoft Word mà vẫn giữ định dạng.
Giữ nguyên tiếng Việt. Đảm bảo nội dung chính xác theo bản ghi chép.`;

export const handler: APIGatewayProxyHandler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: "",
    };
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
    const getCommand = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: `transcripts/${jobId}.json`,
    });

    const transcriptResponse = await s3Client.send(getCommand);
    const transcriptBody = await transcriptResponse.Body?.transformToString();

    if (!transcriptBody) {
      return {
        statusCode: 404,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: "Transcript not found" }),
      };
    }

    const transcriptData = JSON.parse(transcriptBody);
    const transcriptText = transcriptData.results.transcripts[0].transcript;

    // Call Claude API
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      messages: [
        {
          role: "user",
          content: `Đây là bản ghi chép cuộc họp:\n\n${transcriptText}`,
        },
      ],
      system: SYSTEM_PROMPT,
    });

    const reportContent =
      message.content[0].type === "text" ? message.content[0].text : "";

    // Save report to S3
    const putCommand = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: `reports/${jobId}.html`,
      Body: reportContent,
      ContentType: "text/html; charset=utf-8",
    });

    await s3Client.send(putCommand);

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
