import type { Context, S3Event } from "aws-lambda";
import {
  S3Client,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { applyAutoTitle, setMeetingJobStatus } from "../shared/meetingJob";

const s3Client = new S3Client();
const BUCKET_NAME = process.env.BUCKET_NAME!;

const SYSTEM_PROMPT = `Bạn là thư ký ghi biên bản Nghị quyết Chi bộ chuyên nghiệp.
Dưới đây là bản ghi chép tự động từ buổi sinh hoạt Chi bộ.

Hãy soạn thảo Nghị quyết Chi bộ theo đúng thể thức tại Hướng dẫn số 42-HD/BTCTW ngày 28/10/2025 của Ban Tổ chức Trung ương, xuất ra PLAIN TEXT (KHÔNG dùng HTML hay Markdown), theo đúng khung sau:

DÒNG ĐẦU TIÊN của câu trả lời (trước toàn bộ nghị quyết) phải có dạng "TIÊU ĐỀ: <tên ngắn gọn của cuộc họp, tối đa 12 từ, nêu nội dung chính và tháng/năm nếu biết>", ví dụ "TIÊU ĐỀ: Sinh hoạt chi bộ tháng 9/2026 – thu đảng phí, chuẩn bị đại hội". Dòng này dùng để đặt tên cuộc họp, hệ thống sẽ tách ra trước khi lưu; sau đó mới đến dòng "ĐẢNG ỦY …".

ĐẢNG ỦY PHƯỜNG [tên phường, mặc định: CẨM LỆ]
CHI BỘ [số/tên chi bộ]
Số [số]-NQ/CB
[Địa danh], ngày [dd] tháng [mm] năm [yyyy]

NGHỊ QUYẾT
Lãnh đạo thực hiện nhiệm vụ tháng [tháng/năm của kỳ tới]

[Đoạn mở đầu, viết liền một đoạn: Ngày [dd/mm/yyyy], tại [địa điểm], Chi bộ [tên] tổ chức sinh hoạt chi bộ thường kỳ tháng [tháng/năm]. Tổng số đảng viên của chi bộ: [số] đồng chí; có mặt [số] đồng chí; vắng mặt [số] đồng chí (có lý do [số], không có lý do [số]); đảng viên được miễn công tác, sinh hoạt đảng: [số] đồng chí. Thời lượng sinh hoạt: [số] phút (nếu bản ghi chép không nêu, ghi "…… phút"). Đồng chí [họ tên], Bí thư Chi bộ chủ trì; đồng chí [họ tên] được cử làm thư ký kỳ họp. Chi bộ đã thông báo tình hình nộp đảng phí và thông qua chương trình sinh hoạt.]

Sau khi nghe Chi ủy báo cáo, chi bộ đã thảo luận, tự phê bình và phê bình, thống nhất ban hành nghị quyết như sau:

I. ĐÁNH GIÁ KẾT QUẢ LÃNH ĐẠO THÁNG [tháng liền trước]
1. Về công tác chính trị, tư tưởng
a) Phổ biến tình hình thời sự, chủ trương và văn bản mới
[Nội dung]
b) Đánh giá tình hình tư tưởng đảng viên và dư luận nhân dân
[Nội dung]

2. Về lãnh đạo thực hiện nhiệm vụ chính trị
a) Công tác tuyên truyền, vận động nhân dân, xây dựng khối đại đoàn kết
b) Lãnh đạo phát triển kinh tế – xã hội, xây dựng tổ dân phố văn minh, giữ gìn an ninh trật tự
c) Thực hiện dân chủ ở cơ sở, xây dựng đời sống văn hóa, phong trào thi đua
d) Công tác phòng, chống tham nhũng, lãng phí, tiêu cực; bảo đảm vệ sinh môi trường, trật tự đô thị
đ) Công tác quản lý đảng viên, tạo nguồn phát triển đảng
e) Việc thực hiện Kết luận Trung ương 4 gắn với Kết luận số 01-KL/TW
[Danh sách trên là các đầu mục gợi ý. Mỗi mục ghi đầy đủ nội dung tương ứng được đề cập trong bản ghi chép, trong đó mọi ý kiến phát biểu liên quan được ghi theo quy tắc GHI Ý KIẾN PHÁT BIỂU ở cuối; bỏ mục nào hoàn toàn không được đề cập, và bổ sung đầu mục mới nếu bản ghi chép có nội dung không thuộc mục nào ở trên. SAU KHI bỏ/bổ sung, PHẢI đánh lại thứ tự chữ cái LIÊN TỤC bắt đầu từ a) — tuyệt đối không để ngắt quãng (không được bắt đầu bằng c), cũng không được nhảy từ b) sang d)).]

3. Kết quả thực hiện Nghị quyết Chi bộ tháng [tháng liền trước]
Chi ủy tổng hợp, đối chiếu kết quả thực hiện từng nhiệm vụ đề ra tại Mục II Nghị quyết Chi bộ tháng [tháng liền trước] như sau:
| TT | Nhiệm vụ đề ra tại Nghị quyết tháng [tháng liền trước] | Tình trạng đầu kỳ | Kết quả thực hiện |
| 1 | [nhiệm vụ] | [Đang triển khai / Có mốc thời hạn / Nhiệm vụ thường xuyên / Chưa xác định mốc / …] | [kết quả] |
| 2 | … | … | … |

4. Biểu dương, nhắc nhở đảng viên
[Nội dung biểu dương và nhắc nhở]

5. Hạn chế, khuyết điểm và nguyên nhân
Một là, [hạn chế]. Nguyên nhân: [nguyên nhân].
Hai là, [hạn chế]. Nguyên nhân: [nguyên nhân].
[…tiếp tục Ba là, Bốn là…]

II. PHƯƠNG HƯỚNG, NHIỆM VỤ THÁNG [tháng tới]
1. Về công tác chính trị, tư tưởng
[Nội dung]

2. Về lãnh đạo thực hiện nhiệm vụ chính trị
a) [Tên đầu việc]
[Nội dung: các ý kiến phát biểu về đầu việc này (theo quy tắc GHI Ý KIẾN PHÁT BIỂU), sau đó là kết luận: giao ai chủ trì, làm gì, thời hạn hoàn thành, báo cáo kết quả tại kỳ sinh hoạt nào]
b) [Tên đầu việc]
[…tiếp tục c) d) đ) e) g) h) theo đúng thứ tự chữ cái tiếng Việt dùng trong văn bản Đảng: a, b, c, d, đ, e, g, h, i, k. Luôn bắt đầu từ a) và đánh liên tục, không ngắt quãng.]
[Khi một đầu việc có nhiều nội dung nhỏ, liệt kê bằng dấu chấm đầu dòng "• " ở đầu dòng.]

III. PHÂN CÔNG NHIỆM VỤ VÀ TỔ CHỨC THỰC HIỆN
1. [Phân công của Chi ủy đối với từng đảng viên, thời hạn, cơ chế theo dõi báo cáo]
2. [Trách nhiệm của các chi ủy viên phụ trách, Ban Công tác Mặt trận, Tổ hòa giải, các đoàn thể]
3. [Giao đồng chí Bí thư Chi bộ ký ban hành, đăng tải Nghị quyết trên ứng dụng Sổ tay đảng viên điện tử và báo cáo Đảng ủy phường trong thời hạn 02 ngày kể từ ngày kết thúc kỳ sinh hoạt theo Hướng dẫn số 42-HD/BTCTW ngày 28/10/2025 của Ban Tổ chức Trung ương.]

IV. TỰ ĐÁNH GIÁ CHẤT LƯỢNG KỲ SINH HOẠT
Căn cứ khung tiêu chí tại Mục II Hướng dẫn số 42-HD/BTCTW, chi bộ tự chấm điểm kỳ sinh hoạt tháng [tháng/năm] như sau: chấp hành thời gian, thời lượng sinh hoạt [n]/5 điểm; tỷ lệ đảng viên dự sinh hoạt [n]/5 điểm; công tác chuẩn bị [n]/10 điểm; tổ chức sinh hoạt [n]/40 điểm; thực hiện nguyên tắc tổ chức, sinh hoạt đảng [n]/5 điểm; kết quả lãnh đạo thực hiện nghị quyết kỳ trước [n]/30 điểm; kết thúc sinh hoạt [n]/5 điểm. Tổng số điểm: [tổng]/100 điểm, tự xếp loại: [Tốt (từ 90 điểm) / Khá (từ 70 đến dưới 90 điểm) / Trung bình (từ 50 đến dưới 70 điểm) / Kém (dưới 50 điểm)]
Hạn chế cần khắc phục trong kỳ sinh hoạt tiếp theo: [nội dung]

Nghị quyết này được chi bộ thảo luận và biểu quyết thông qua tại kỳ sinh hoạt ngày [dd/mm/yyyy], với [số]/[số] đồng chí tán thành, đạt tỷ lệ [%].

Nơi nhận:
- Đảng ủy phường [tên] (để báo cáo),
- Cấp ủy viên phường phụ trách chi bộ,
- Ban CTMT, các đoàn thể KDC [số] (để thực hiện),
- Toàn thể đảng viên chi bộ,
- Đăng tải trên Sổ tay đảng viên điện tử,
- Lưu hồ sơ chi bộ.

T/M CHI ỦY
BÍ THƯ
[Họ tên Bí thư]

[KẾT THÚC nghị quyết tại dòng họ tên Bí thư. KHÔNG viết phần PHỤ LỤC.]

GHI Ý KIẾN PHÁT BIỂU (bắt buộc, áp dụng cho Mục I và Mục II):
- Mỗi lượt phát biểu trong bản ghi chép (báo cáo, ý kiến thảo luận, chất vấn, trả lời, kết luận) phải được ghi vào mục phù hợp, mỗi lượt một đoạn riêng, theo dạng: "[Đồng chí <họ tên>, <chức danh nếu có> hoặc Người phát biểu N] (Nam/Nữ nếu xác định được) phát biểu: [lời phát biểu]".
- [lời phát biểu] phải GIỮ NGUYÊN LỜI của người nói: giữ đúng câu chữ, cách xưng hô, cách diễn đạt, thứ tự ý và TẤT CẢ các ý, chi tiết, số liệu, ví dụ mà người đó nói. Chỉ được phép: bỏ các từ đệm vô nghĩa (ừ, à, ờ, thì là, mà…), bỏ từ lặp do nói vấp, thêm dấu câu cho dễ đọc.
- TUYỆT ĐỐI KHÔNG tóm tắt, KHÔNG rút gọn, KHÔNG diễn đạt lại bằng lời khác, KHÔNG chuyển sang lời kể gián tiếp (kiểu "đồng chí A đề nghị cần…"), KHÔNG gộp ý kiến của nhiều người thành một, KHÔNG bỏ qua lượt phát biểu nào kể cả lượt ngắn. Độ dài lời phát biểu trong nghị quyết phải tương đương độ dài trong bản ghi chép.
- Nếu một lượt phát biểu đề cập nhiều nội dung thuộc các mục khác nhau, tách thành các đoạn ở đúng từng mục, mỗi đoạn vẫn giữ nguyên lời; không được làm mất phần nào. Lượt phát biểu không thuộc mục gợi ý nào thì bổ sung đầu mục mới cho phù hợp.
- Giữ thứ tự phát biểu như trong bản ghi chép trong cùng một mục. Sau các ý kiến, nếu bản ghi chép có kết luận hoặc thống nhất của chi bộ về nội dung đó thì ghi tiếp.
- Nhận diện người nói: bản ghi chép dùng nhãn [spk_0], [spk_1]… Hãy xác định họ tên, chức danh từ ngữ cảnh (người được gọi tên, tự giới thiệu, người chủ trì…) và gọi nhất quán trong toàn văn bản. Không xác định được tên thì gọi "Người phát biểu N" theo số nhãn (spk_0 → "Người phát biểu 1", spk_1 → "Người phát biểu 2"…). Nhận diện giới tính dựa vào đại từ xưng hô (anh, chị, ông, bà…) hoặc ngữ cảnh. Bản ghi chép tự động có thể nhận nhầm người nói ở chỗ chuyển lượt; khi ngữ cảnh cho thấy rõ, hãy ghi đúng người nói.

QUAN TRỌNG:
- Sử dụng plain text hoàn toàn. KHÔNG dùng HTML, Markdown, hay ký tự đặc biệt. NGOẠI LỆ DUY NHẤT: bảng ở Mục I.3 viết theo dạng các dòng bắt đầu và kết thúc bằng dấu "|", mỗi ô cách nhau bằng "|" (dòng đầu tiên là dòng tiêu đề). KHÔNG chèn dòng gạch ngang "|---|---|" kiểu Markdown.
- Bốn dòng đầu tiên (ĐẢNG ỦY…, CHI BỘ…, Số…-NQ/CB, [Địa danh], ngày…) là phần thể thức bắt buộc, luôn giữ đúng thứ tự này để hệ thống xuất file Word đọc được. Thông tin nào không có trong bản ghi chép thì để dấu chấm lửng "……" trên đúng dòng đó, KHÔNG xóa dòng.
- Tiêu đề Mục I, II, III, IV viết IN HOA, đúng dạng "I. ", "II. ", "III. ", "IV. ".
- TUYỆT ĐỐI KHÔNG tóm tắt, rút gọn, hay lược bỏ bất kỳ thông tin nào của bản ghi chép. Mọi nội dung, số liệu, tên người, ngày tháng, văn bản (số hiệu, ngày ban hành) được đề cập đều phải xuất hiện ở mục phù hợp.
- Nội dung thảo luận trong bản ghi chép phải được phân bổ vào đúng mục I và II, ghi theo quy tắc GHI Ý KIẾN PHÁT BIỂU ở trên. Các phần mang tính tổng hợp (bảng ở Mục I.3, "Một là, Hai là…" ở Mục I.5, Mục III, Mục IV) được phép viết gọn, nhưng không thay thế cho việc ghi nguyên lời các ý kiến.
- Nếu thông tin nào không có trong bản ghi chép: ở đoạn mở đầu và các dòng thể thức, để dấu chấm lửng "……" đúng chỗ để người ký điền tay; ở phần nội dung, ghi "[không đề cập]". Riêng các mục a), b), c)… hoàn toàn không được đề cập thì bỏ hẳn mục đó rồi đánh lại chữ cái liên tục từ a).
- Giữ nguyên tiếng Việt.`;

/**
 * Reads an Anthropic Messages SSE stream into the final text. Streaming keeps
 * the connection busy during a generation that can run for many minutes.
 */
async function readClaudeStream(
  body: ReadableStream<Uint8Array>
): Promise<{ text: string; stopReason?: string }> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let text = "";
  let stopReason: string | undefined;

  const handleEvent = (raw: string) => {
    const data = raw
      .split("\n")
      .filter((l) => l.startsWith("data:"))
      .map((l) => l.slice(5).trimStart())
      .join("\n");
    if (!data) return;
    const event = JSON.parse(data);
    if (event.type === "content_block_delta" && event.delta?.type === "text_delta") {
      text += event.delta.text;
    } else if (event.type === "message_delta" && event.delta?.stop_reason) {
      stopReason = event.delta.stop_reason;
    } else if (event.type === "error") {
      throw new Error(`Claude API stream error: ${JSON.stringify(event.error)}`);
    }
  };

  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    // stream: true keeps a multibyte Vietnamese character split across chunks intact
    buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n");
    let sep: number;
    while ((sep = buffer.indexOf("\n\n")) !== -1) {
      handleEvent(buffer.slice(0, sep));
      buffer = buffer.slice(sep + 2);
    }
  }
  buffer += decoder.decode().replace(/\r\n/g, "\n");
  if (buffer.trim()) handleEvent(buffer);
  return { text, stopReason };
}

async function callClaude(
  transcript: string,
  feedback: string | undefined,
  signal: AbortSignal
): Promise<string> {
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
      model: "claude-sonnet-5-5",
      // Verbatim speaker quotes make the report roughly as long as the
      // transcript itself; 128K is Sonnet 5.5's output maximum. In practice
      // the worker's 900s timeout is the tighter limit.
      max_tokens: 128000,
      stream: true,
      // Sonnet 5.5 rejects { type: "disabled" }; between_tools is its
      // thinking-off setting, valid only at effort "high" or below. "high"
      // keeps the output thorough, which the verbatim quotes need.
      thinking: { type: "between_tools" },
      output_config: { effort: "high" },
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    }),
    signal,
  });

  if (!response.ok || !response.body) {
    const err = await response.text();
    throw new Error(`Claude API error ${response.status}: ${err}`);
  }

  const { text, stopReason } = await readClaudeStream(response.body);
  if (stopReason === "refusal") {
    throw new Error("Claude declined to generate the report (stop_reason: refusal)");
  }
  // A cut-off report would silently lose the speakers at the end
  if (stopReason === "max_tokens") {
    throw new Error("Claude output hit max_tokens; report would be truncated");
  }
  if (!text) {
    throw new Error(`Claude API returned no text content (stop_reason: ${stopReason})`);
  }
  return text;
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

// Strips the leading "TIÊU ĐỀ: …" line so parseReport still sees ĐẢNG ỦY… first
function splitTitle(raw: string): { title?: string; report: string } {
  const match = raw.match(/^\s*TIÊU ĐỀ\s*:\s*(.+)\r?\n/i);
  if (!match) return { report: raw };
  const title = match[1].trim().slice(0, 150);
  return { title: title || undefined, report: raw.slice(match[0].length).replace(/^\s*\n/, "") };
}

type WorkerEvent = { jobId: string; feedback?: string } | S3Event;

const REPORT_KEY = (jobId: string) => `reports/${jobId}.txt`;

async function reportExists(jobId: string): Promise<boolean> {
  try {
    await s3Client.send(
      new HeadObjectCommand({ Bucket: BUCKET_NAME, Key: REPORT_KEY(jobId) })
    );
    return true;
  } catch {
    return false;
  }
}

// Abort the Claude call this long before the Lambda deadline, so the catch
// block still has time to mark the row FAILED instead of the invocation being
// killed with the row left PROCESSING.
const DEADLINE_MARGIN_MS = 30_000;

async function processJob(
  jobId: string,
  feedback: string | undefined,
  context: Context
): Promise<void> {
  console.log(`Worker processing jobId: ${jobId}`);
  await setMeetingJobStatus(jobId, "PROCESSING");

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

    const { title, report: reportContent } = splitTitle(
      await callClaude(
        transcriptText,
        feedback,
        AbortSignal.timeout(
          Math.max(context.getRemainingTimeInMillis() - DEADLINE_MARGIN_MS, 1_000)
        )
      )
    );

    await s3Client.send(
      new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: REPORT_KEY(jobId),
        Body: reportContent,
        ContentType: "text/plain; charset=utf-8",
        // S3 metadata must be ASCII, so the Vietnamese title is URI-encoded
        ...(title && { Metadata: { title: encodeURIComponent(title) } }),
      })
    );

    if (title) await applyAutoTitle(jobId, title);
    await setMeetingJobStatus(jobId, "COMPLETED", {
      reportKey: REPORT_KEY(jobId),
    });
    console.log(`Worker completed jobId: ${jobId}`);
  } catch (error) {
    console.error(`Worker failed for jobId ${jobId}:`, error);
    // Recorded instead of rethrown: an async retry would re-bill a full
    // Claude generation, and the user can re-run from the UI.
    await setMeetingJobStatus(jobId, "FAILED", {
      errorMessage: "Không thể tạo biên bản. Vui lòng thử lại.",
    });
  }
}

// Two triggers:
// - S3 ObjectCreated on transcripts/*.json (wired in backend.ts) — the normal
//   path, so a report is generated even if the browser is gone.
// - InvokeCommand from process-transcript — manual re-runs, e.g. regenerate
//   with feedback.
export const handler = async (event: WorkerEvent, context: Context) => {
  if (!("Records" in event)) {
    await processJob(event.jobId, event.feedback, context);
    return;
  }

  for (const record of event.Records) {
    const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, " "));
    const match = key.match(/^transcripts\/(.+)\.json$/);
    if (!match) continue;
    const jobId = match[1];

    // S3 events can be delivered more than once
    if (await reportExists(jobId)) {
      console.log(`Report already exists for jobId ${jobId}, skipping`);
      continue;
    }
    await processJob(jobId, undefined, context);
  }
};
