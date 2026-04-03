"use client";

import { useState, useCallback } from "react";
import { FileAudio } from "lucide-react";
import AudioUploader from "./components/AudioUploader";
import ProcessingStatus from "./components/ProcessingStatus";
import ReportViewer from "./components/ReportViewer";
import JobHistory from "./components/JobHistory";
import outputs from "@/amplify_outputs.json";

const apiUrl = (outputs as any).custom?.apiUrl;

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

  const handleViewReport = useCallback(async (jobId: string) => {
    try {
      const res = await fetch(`${apiUrl}/status?jobId=${jobId}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      if (data.report) {
        setCurrentReport(data.report);
        setCurrentReportJobId(jobId);
        setCurrentPhase("done");
      }
    } catch {
      console.error("Lỗi khi tải biên bản.");
    }
  }, []);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center gap-3">
          <div className="flex items-center justify-center size-10 rounded-lg bg-primary text-primary-foreground">
            <FileAudio className="size-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">
              Biên Bản Cuộc Họp
            </h1>
            <p className="text-sm text-muted-foreground">
              Chuyển đổi ghi âm cuộc họp thành biên bản tự động
            </p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6 space-y-6 max-w-5xl">
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
          onClose={handleCloseReport}
        />
      )}
    </div>
  );
}
