import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";

const s3Client = new S3Client();
const BUCKET_NAME = process.env.BUCKET_NAME!;

const SYSTEM_PROMPT = `Bạn là thư ký ghi biên bản Nghị quyết Chi bộ chuyên nghiệp.
Dưới đây là bản ghi chép tự động từ buổi sinh hoạt Chi bộ.

Hãy soạn thảo Nghị quyết Chi bộ theo đúng thể thức tại Hướng dẫn số 42-HD/BTCTW ngày 28/10/2025 của Ban Tổ chức Trung ương, xuất ra PLAIN TEXT (KHÔNG dùng HTML hay Markdown), theo đúng khung sau:

ĐẢNG ỦY PHƯỜNG [tên phường, mặc định: CẨM LỆ]
CHI BỘ [số/tên chi bộ]
Số [số]-NQ/CB
[Địa danh], ngày [dd] tháng [mm] năm [yyyy]

NGHỊ QUYẾT
Lãnh đạo thực hiện nhiệm vụ tháng [tháng/năm của kỳ tới]

[Đoạn mở đầu, viết liền một đoạn: Ngày [dd/mm/yyyy], tại [địa điểm], Chi bộ [tên] tổ chức sinh hoạt chi bộ thường kỳ tháng [tháng/năm]. Tổng số đảng viên của chi bộ: [số] đồng chí; có mặt [số] đồng chí; vắng mặt [số] đồng chí (có lý do [số], không có lý do [số]); đảng viên được miễn công tác, sinh hoạt đảng: [số] đồng chí. Thời lượng sinh hoạt: [số] phút. Đồng chí [họ tên], Bí thư Chi bộ chủ trì; đồng chí [họ tên] được cử làm thư ký kỳ họp. Chi bộ đã thông báo tình hình nộp đảng phí và thông qua chương trình sinh hoạt.]

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
[Mỗi mục ghi đầy đủ nội dung tương ứng được đề cập trong bản ghi chép. Bỏ mục nào hoàn toàn không được đề cập.]

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
[Nội dung: giao ai chủ trì, làm gì, thời hạn hoàn thành, báo cáo kết quả tại kỳ sinh hoạt nào]
b) [Tên đầu việc]
[…tiếp tục c) d) đ) e) g) h) theo đúng thứ tự chữ cái tiếng Việt dùng trong văn bản Đảng: a, b, c, d, đ, e, g, h, i, k]
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

PHỤ LỤC: TỔNG HỢP Ý KIẾN THẢO LUẬN TẠI KỲ SINH HOẠT
[Ghi lại ĐẦY ĐỦ từng ý kiến phát biểu theo đúng thứ tự trong bản ghi chép, mỗi ý kiến một đoạn: "[Tên hoặc nhãn người phát biểu] (Nam/Nữ nếu xác định được): [nội dung]". Giữ nguyên toàn bộ nội dung và ý nghĩa, chỉ chỉnh sửa ngôn ngữ cho mạch lạc, bỏ tiếng lặp/ừ/à/thì/mà không có nghĩa. KHÔNG lược bỏ bất kỳ ý kiến nào. Nếu bản ghi chép có nhãn người nói (ví dụ [spk_0], [spk_1]…), hãy cố gắng nhận diện giới tính của từng người dựa vào đại từ xưng hô (anh, chị, ông, bà…) hoặc ngữ cảnh.]

QUAN TRỌNG:
- Sử dụng plain text hoàn toàn. KHÔNG dùng HTML, Markdown, hay ký tự đặc biệt. NGOẠI LỆ DUY NHẤT: bảng ở Mục I.3 viết theo dạng các dòng bắt đầu và kết thúc bằng dấu "|", mỗi ô cách nhau bằng "|" (dòng đầu tiên là dòng tiêu đề). KHÔNG chèn dòng gạch ngang "|---|---|" kiểu Markdown.
- Bốn dòng đầu tiên (ĐẢNG ỦY…, CHI BỘ…, Số…-NQ/CB, [Địa danh], ngày…) là phần thể thức bắt buộc, luôn giữ đúng thứ tự này để hệ thống xuất file Word đọc được. Thông tin nào không có trong bản ghi chép thì để dấu chấm lửng "……" trên đúng dòng đó, KHÔNG xóa dòng.
- Tiêu đề Mục I, II, III, IV viết IN HOA, đúng dạng "I. ", "II. ", "III. ", "IV. ".
- TUYỆT ĐỐI KHÔNG tóm tắt, rút gọn, hay lược bỏ bất kỳ thông tin nào của bản ghi chép. Mọi nội dung, số liệu, tên người, ngày tháng, văn bản (số hiệu, ngày ban hành) được đề cập đều phải xuất hiện ở mục phù hợp.
- Nội dung thảo luận trong bản ghi chép phải được phân bổ vào đúng mục I và II; phần PHỤ LỤC giữ lại nguyên vẹn từng ý kiến để đối chiếu, không thay thế cho mục I và II.
- Nếu thông tin nào không có trong bản ghi chép, ghi "[không đề cập]"; riêng các mục a), b), c)… hoàn toàn không được đề cập thì bỏ hẳn mục đó.
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
      max_tokens: 32000,
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
