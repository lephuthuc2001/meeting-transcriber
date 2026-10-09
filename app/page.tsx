"use client";

import { useState, useCallback } from "react";
import { FileAudio, Upload, Cog, FileText } from "lucide-react";
import { downloadData } from "aws-amplify/storage";
import AudioUploader from "./components/AudioUploader";
import ProcessingStatus from "./components/ProcessingStatus";
import ReportViewer from "./components/ReportViewer";
import JobHistory, { type HistoryJob } from "./components/JobHistory";

type Phase = "idle" | "uploading" | "transcribing" | "processing" | "done";

export default function Home() {
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [currentAudioKey, setCurrentAudioKey] = useState<string | null>(null);
  const [currentPhase, setCurrentPhase] = useState<Phase>("idle");
  const [currentReport, setCurrentReport] = useState<string | null>(null);
  const [currentReportJobId, setCurrentReportJobId] = useState<string | null>(null);
  const [currentTitle, setCurrentTitle] = useState<string | null>(null);
  const [currentCreatedAt, setCurrentCreatedAt] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [audioDuration, setAudioDuration] = useState<number>(0);

  const handleTranscriptionStarted = useCallback((jobId: string, audioDurationSeconds: number, audioKey: string, title: string) => {
    setCurrentJobId(jobId);
    setCurrentTitle(title);
    setCurrentCreatedAt(new Date().toISOString());
    setCurrentAudioKey(audioKey);
    setAudioDuration(audioDurationSeconds);
    setCurrentPhase("transcribing");
    setRefreshKey((prev) => prev + 1);
  }, []);

  const handleProcessingComplete = useCallback((report: string, title?: string) => {
    setCurrentReport(report);
    if (title) setCurrentTitle(title);
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

  const handleViewReport = useCallback(async (job: HistoryJob) => {
    try {
      const { body } = await downloadData({ path: job.reportKey ?? "" }).result;
      const text = await body.text();
      setCurrentReport(text);
      setCurrentReportJobId(job.id);
      setCurrentTitle(job.title ?? null);
      setCurrentCreatedAt(job.createdAt);
      setCurrentPhase("done");
    } catch {
      console.error("Lỗi khi tải biên bản.");
    }
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
      >
        Bỏ qua đến nội dung chính
      </a>

      {/* Header */}
      <header className="bg-primary text-primary-foreground shadow-sm">
        <div className="container mx-auto max-w-5xl px-4 py-5 flex items-center gap-4">
          <div className="flex items-center justify-center size-12 rounded-xl bg-white/15">
            <FileAudio className="size-7" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              Biên Bản Cuộc Họp
            </h1>
            <p className="text-base text-primary-foreground/90">
              Tải lên ghi âm, nhận biên bản Nghị quyết Chi bộ tự động
            </p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main id="main" className="container mx-auto px-4 py-8 space-y-8 max-w-5xl">
        {/* Step guide */}
        <ol className="grid gap-3 sm:grid-cols-3" aria-label="Các bước thực hiện">
          {[
            { icon: Upload, title: "Bước 1", text: "Tải tệp ghi âm lên" },
            { icon: Cog, title: "Bước 2", text: "Chờ hệ thống xử lý" },
            { icon: FileText, title: "Bước 3", text: "Xem và tải biên bản" },
          ].map(({ icon: Icon, title, text }) => (
            <li
              key={title}
              className="flex items-center gap-3 rounded-xl border bg-card px-4 py-3"
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary text-primary">
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <span>
                <span className="block text-sm font-semibold text-primary">{title}</span>
                <span className="block text-base">{text}</span>
              </span>
            </li>
          ))}
        </ol>

        {/* Upload Section */}
        <AudioUploader onTranscriptionStarted={handleTranscriptionStarted} />

        {/* Processing Status */}
        {currentJobId &&
          currentAudioKey &&
          (currentPhase === "transcribing" ||
            currentPhase === "processing") && (
            <ProcessingStatus
              jobId={currentJobId}
              audioKey={currentAudioKey}
              audioDurationSeconds={audioDuration}
              onComplete={handleProcessingComplete}
              onError={handleProcessingError}
              onCancel={handleCancel}
            />
          )}

        {/* Job History */}
        <JobHistory refreshKey={refreshKey} onViewReport={handleViewReport} />
      </main>

      {/* Report Viewer Dialog */}
      {currentReport && (
        <ReportViewer
          report={currentReport}
          jobId={currentReportJobId ?? ""}
          title={currentTitle}
          createdAt={currentCreatedAt}
          onClose={handleCloseReport}
        />
      )}
    </div>
  );
}
