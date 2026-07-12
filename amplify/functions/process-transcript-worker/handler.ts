import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";

const s3Client = new S3Client();
const BUCKET_NAME = process.env.BUCKET_NAME!;

const SYSTEM_PROMPT = `Bạn là thư ký ghi biên bản Nghị quyết Chi bộ chuyên nghiệp.
Dưới đây là bản ghi chép tự động từ buổi sinh hoạt Chi bộ.

Nếu bản ghi chép có nhãn người nói (ví dụ [spk_0], [spk_1],...), hãy cố gắng nhận diện giới tính của từng người dựa vào đại từ xưng hô trong nội dung (anh, chị, ông, bà...) hoặc ngữ cảnh. Khi ghi lại ý kiến thảo luận, ghi rõ "(Nam)" hoặc "(Nữ)" sau tên/nhãn người phát biểu nếu xác định được.

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

3. Ý kiến thảo luận:
[Ghi lại ĐẦY ĐỦ từng ý kiến phát biểu theo đúng thứ tự trong bản ghi chép. Giữ nguyên toàn bộ nội dung và ý nghĩa, chỉ chỉnh sửa ngôn ngữ cho mạch lạc, bỏ tiếng lặp/ừ/à/thì/mà không có nghĩa. Ghi rõ từng người: "Người phát biểu [N] (Nam/Nữ nếu xác định được): [nội dung]". KHÔNG lược bỏ bất kỳ ý kiến nào.]

4. Kết luận và lưu ý khác:
[Ghi lại ĐẦY ĐỦ toàn bộ phần kết luận và các lưu ý cuối buổi theo đúng thứ tự. Giữ nguyên toàn bộ nội dung và ý nghĩa, chỉ chỉnh sửa ngôn ngữ cho mạch lạc, bỏ tiếng lặp/ừ/à không có nghĩa. KHÔNG lược bỏ bất kỳ lưu ý nào.]

III. Chấm điểm sinh hoạt chi bộ
Qua sinh hoạt chi bộ tháng [tháng]/[năm], Chi bộ thống nhất chấm [điểm]/100 điểm - Đảng viên chi bộ biểu quyết đạt 100%.

QUAN TRỌNG:
- Sử dụng plain text hoàn toàn. KHÔNG dùng HTML, Markdown, hay ký tự đặc biệt.
- TUYỆT ĐỐI KHÔNG tóm tắt, rút gọn, hay lược bỏ bất kỳ thông tin nào.
- Ghi lại ĐẦY ĐỦ, CHI TIẾT mọi nội dung, ý kiến, số liệu, tên người, ngày tháng được đề cập trong bản ghi chép.
- Mục 3 (Ý kiến thảo luận) và mục 4 (Kết luận và lưu ý khác) PHẢI ghi đầy đủ từng ý, không được tóm tắt hay gộp ý. Chỉ được chỉnh ngôn ngữ cho mạch lạc (bỏ tiếng lặp, ừ, à), không thay đổi nội dung.
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
      model: "claude-sonnet-5",
      max_tokens: 16000,
      thinking: { type: "disabled" },
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Claude API error ${response.status}: ${err}`);
  }

  const data = (await response.json()) as any;
  const textBlock = data.content?.find((block: any) => block.type === "text");
  if (!textBlock?.text) {
    throw new Error(
      `Claude API returned no text content (stop_reason: ${data.stop_reason})`
    );
  }
  return textBlock.text;
}

/**
 * Build a speaker-labelled transcript from AWS Transcribe output.
 * When speaker_labels are present, each line is prefixed with [spk_N].
 * Falls back to the plain transcript when speaker data is missing.
 */
function buildSpeakerTranscript(transcriptData: any): string {
  const items: any[] = transcriptData.results?.items ?? [];
  const speakerSegments: any[] =
    transcriptData.results?.speaker_labels?.segments ?? [];

  if (speakerSegments.length === 0) {
    return transcriptData.results?.transcripts?.[0]?.transcript ?? "";
  }

  // Map each item's start_time → speaker label
  const timeToSpeaker = new Map<string, string>();
  for (const seg of speakerSegments) {
    for (const item of seg.items ?? []) {
      timeToSpeaker.set(item.start_time, item.speaker_label as string);
    }
  }

  let result = "";
  let currentSpeaker = "";
  for (const item of items) {
    const content: string = item.alternatives?.[0]?.content ?? "";
    if (item.type === "punctuation") {
      result += content;
      continue;
    }
    const speaker = timeToSpeaker.get(item.start_time) ?? currentSpeaker;
    if (speaker !== currentSpeaker) {
      if (result && !result.endsWith("\n")) result += "\n";
      result += `\n[${speaker}]: `;
      currentSpeaker = speaker;
    }
    result += content + " ";
  }
  return result.trim();
}

// Invoked asynchronously by process-transcript — not an API Gateway handler
export const handler = async (event: { jobId: string; feedback?: string }) => {
  const { jobId, feedback } = event;
  console.log(`Worker processing jobId: ${jobId}`);

  try {
    const transcriptObj = await s3Client.send(
      new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: `transcripts/${jobId}.json`,
      })
    );
    const transcriptRaw = await transcriptObj.Body?.transformToString();
    if (!transcriptRaw) throw new Error("Transcript not found");

    const transcriptData = JSON.parse(transcriptRaw);
    const transcriptText = buildSpeakerTranscript(transcriptData);

    const reportContent = await callClaude(transcriptText, feedback);

    await s3Client.send(
      new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: `reports/${jobId}.txt`,
        Body: reportContent,
        ContentType: "text/plain; charset=utf-8",
      })
    );

    console.log(`Worker completed jobId: ${jobId}`);
  } catch (error) {
    console.error(`Worker failed for jobId ${jobId}:`, error);
    throw error;
  }
};
