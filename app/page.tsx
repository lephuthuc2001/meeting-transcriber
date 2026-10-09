"use client";

import { useState, useCallback } from "react";
import { FileAudio, History } from "lucide-react";
import { downloadData } from "aws-amplify/storage";
import AudioUploader from "./components/AudioUploader";
import ProcessingStatus from "./components/ProcessingStatus";
import ReportViewer from "./components/ReportViewer";
import JobHistory from "./components/JobHistory";

const HOW_IT_WORKS = [
  { title: "Tải ghi âm", desc: "Kéo thả tệp .mp3, .m4a, .wav… của buổi họp." },
  { title: "Gỡ băng tự động", desc: "Chuyển giọng nói tiếng Việt, tách từng người phát biểu." },
  { title: "Soạn nghị quyết", desc: "Nhận văn bản hoàn chỉnh, tải về Word để chỉnh sửa." },
];

type Phase = "idle" | "uploading" | "transcribing" | "processing" | "done";

export default function Home() {
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [currentAudioKey, setCurrentAudioKey] = useState<string | null>(null);
  const [currentPhase, setCurrentPhase] = useState<Phase>("idle");
  const [currentReport, setCurrentReport] = useState<string | null>(null);
  const [currentReportJobId, setCurrentReportJobId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [audioDuration, setAudioDuration] = useState<number>(0);

  const handleTranscriptionStarted = useCallback((jobId: string, audioDurationSeconds: number, audioKey: string) => {
    setCurrentJobId(jobId);
    setCurrentAudioKey(audioKey);
    setAudioDuration(audioDurationSeconds);
    setCurrentPhase("transcribing");
    setRefreshKey((prev) => prev + 1);
  }, []);

  const handleProcessingComplete = useCallback((report: string) => {
    setCurrentReport(report);
    setCurrentReportJobId(currentJobId);
    setCurrentPhase("done");
    setRefreshKey((prev) => prev + 1);
  }, [currentJobId]);

  const handleProcessingError = useCallback((error: string) => {
    setCurrentPhase("idle");
    setCurrentJobId(null);
    setRefreshKey((prev) => prev + 1);
  }, []);

  const handleCancel = useCallback(() => {
    setCurrentPhase("idle");
    setCurrentJobId(null);
    setCurrentAudioKey(null);
    setRefreshKey((prev) => prev + 1);
  }, []);

  const handleCloseReport = useCallback(() => {
    setCurrentReport(null);
    setCurrentReportJobId(null);
    setCurrentPhase("idle");
    setCurrentJobId(null);
    setCurrentAudioKey(null);
  }, []);

  const handleViewReport = useCallback(async (jobId: string, reportKey: string) => {
    try {
      const { body } = await downloadData({ path: reportKey }).result;
      const text = await body.text();
      setCurrentReport(text);
      setCurrentReportJobId(jobId);
      setCurrentPhase("done");
    } catch {
      console.error("Lỗi khi tải biên bản.");
    }
  }, []);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
          <div
            aria-hidden="true"
            className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm ring-2 ring-gold/60"
          >
            <FileAudio className="size-5" />
          </div>
          <div className="min-w-0">
            <p className="truncate font-serif text-lg font-bold leading-tight tracking-tight">
              Biên Bản Cuộc Họp
            </p>
            <p className="truncate text-xs text-muted-foreground">
              Nghị quyết Chi bộ từ bản ghi âm
            </p>
          </div>
          <a
            href="#lich-su"
            className="ml-auto inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            <History className="size-4" aria-hidden="true" />
            <span className="hidden sm:inline">Lịch sử</span>
            <span className="sr-only sm:hidden">Lịch sử cuộc họp</span>
          </a>
        </div>
      </header>

      {/* Hero */}
      <section className="hero-pattern border-b">
        <div className="mx-auto max-w-5xl px-4 py-10 sm:py-14">
          <h1 className="max-w-2xl text-balance font-serif text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
            Từ bản ghi âm đến{" "}
            <span className="text-primary">Nghị quyết Chi bộ</span> trong vài
            phút
          </h1>
          <p className="mt-3 max-w-xl text-pretty text-base text-muted-foreground">
            Tải lên bản ghi âm buổi sinh hoạt, hệ thống tự động gỡ băng, nhận
            diện người phát biểu và soạn văn bản đúng thể thức Hướng dẫn
            42-HD/BTCTW.
          </p>

          <ol className="mt-8 grid gap-3 sm:grid-cols-3">
            {HOW_IT_WORKS.map((step, i) => (
              <li
                key={step.title}
                className="flex items-start gap-3 rounded-xl border bg-card/80 p-4 shadow-xs"
              >
                <span
                  aria-hidden="true"
                  className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary"
                >
                  {i + 1}
                </span>
                <div>
                  <p className="text-sm font-semibold">{step.title}</p>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {step.desc}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Main Content */}
      <main id="main" className="mx-auto max-w-5xl space-y-8 px-4 py-8">
        {currentJobId &&
        currentAudioKey &&
        (currentPhase === "transcribing" || currentPhase === "processing") ? (
          <ProcessingStatus
            jobId={currentJobId}
            audioKey={currentAudioKey}
            audioDurationSeconds={audioDuration}
            onComplete={handleProcessingComplete}
            onError={handleProcessingError}
            onCancel={handleCancel}
          />
        ) : (
          <AudioUploader onTranscriptionStarted={handleTranscriptionStarted} />
        )}

        <JobHistory refreshKey={refreshKey} onViewReport={handleViewReport} />
      </main>

      <footer className="border-t py-6 text-center text-xs text-muted-foreground">
        Văn bản do AI soạn thảo — vui lòng rà soát trước khi ban hành.
      </footer>

      {/* Report Viewer Dialog */}
      {currentReport && (
        <ReportViewer
          report={currentReport}
          jobId={currentReportJobId ?? ""}
          onClose={handleCloseReport}
        />
      )}
    </div>
  );
}
