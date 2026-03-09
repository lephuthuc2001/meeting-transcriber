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
  const [currentPhase, setCurrentPhase] = useState<Phase>("idle");
  const [currentReport, setCurrentReport] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleTranscriptionStarted = useCallback((jobId: string) => {
    setCurrentJobId(jobId);
    setCurrentPhase("transcribing");
    setRefreshKey((prev) => prev + 1);
  }, []);

  const handleProcessingComplete = useCallback((report: string) => {
    setCurrentReport(report);
    setCurrentPhase("done");
    setRefreshKey((prev) => prev + 1);
  }, []);

  const handleProcessingError = useCallback((error: string) => {
    setCurrentPhase("idle");
    setCurrentJobId(null);
    setRefreshKey((prev) => prev + 1);
  }, []);

  const handleCloseReport = useCallback(() => {
    setCurrentReport(null);
    setCurrentPhase("idle");
    setCurrentJobId(null);
  }, []);

  const handleViewReport = useCallback(async (jobId: string) => {
    try {
      const res = await fetch(`${apiUrl}/status?jobId=${jobId}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      if (data.report) {
        setCurrentReport(data.report);
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
          (currentPhase === "transcribing" ||
            currentPhase === "processing") && (
            <ProcessingStatus
              jobId={currentJobId}
              onComplete={handleProcessingComplete}
              onError={handleProcessingError}
            />
          )}

        {/* Job History */}
        <JobHistory refreshKey={refreshKey} onViewReport={handleViewReport} />
      </main>

      {/* Report Viewer Dialog */}
      {currentReport && (
        <ReportViewer report={currentReport} onClose={handleCloseReport} />
      )}
    </div>
  );
}
