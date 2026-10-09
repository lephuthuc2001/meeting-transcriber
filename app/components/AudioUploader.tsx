"use client";

import { useState, useRef, useCallback } from "react";
import { uploadData, type UploadDataWithPathOutput } from "aws-amplify/storage";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "@/amplify/data/resource";
import { Upload, FileAudio, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import outputs from "@/amplify_outputs.json";

const apiUrl = (outputs as any).custom?.apiUrl;
const client = generateClient<Schema>({ authMode: "iam" });

const ACCEPTED_FORMATS = ".m4a,.mp3,.wav,.mp4,.flac";

interface AudioUploaderProps {
  onTranscriptionStarted: (jobId: string, audioDurationSeconds: number, audioKey: string) => void;
}

const getAudioDuration = (file: File): Promise<number> =>
  new Promise((resolve) => {
    const audio = new Audio();
    audio.src = URL.createObjectURL(file);
    audio.onloadedmetadata = () => {
      URL.revokeObjectURL(audio.src);
      resolve(Math.round(audio.duration));
    };
    audio.onerror = () => resolve(0);
  });

export default function AudioUploader({
  onTranscriptionStarted,
}: AudioUploaderProps) {
  const [title, setTitle] = useState("");
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadTaskRef = useRef<UploadDataWithPathOutput | null>(null);

  const handleUpload = useCallback(
    async (file: File) => {
      // Check if storage is properly configured (requires npx ampx sandbox to run first)
      const storageBucket = (outputs as any).storage?.bucket_name;
      if (!storageBucket) {
        setError(
          "Chưa kết nối với máy chủ lưu trữ. Vui lòng chạy 'npx ampx sandbox' trước khi sử dụng."
        );
        return;
      }

      const ext = `.${file.name.split(".").pop()?.toLowerCase() ?? ""}`;
      if (!ACCEPTED_FORMATS.split(",").includes(ext)) {
        setError(
          `Định dạng "${ext}" chưa được hỗ trợ. Vui lòng chọn tệp ${ACCEPTED_FORMATS.replaceAll(",", ", ")}.`
        );
        return;
      }

      setUploading(true);
      setFileName(file.name);
      setProgress(0);
      setError(null);

      const s3Key = `audio/${Date.now()}-${file.name}`;
      const audioDurationSeconds = await getAudioDuration(file);

      try {
        const task = uploadData({
          path: s3Key,
          data: file,
          options: {
            onProgress: ({ transferredBytes, totalBytes }) => {
              if (totalBytes) {
                setProgress(Math.round((transferredBytes / totalBytes) * 100));
              }
            },
          },
        });
        uploadTaskRef.current = task;
        await task.result;

        const response = await fetch(`${apiUrl}/transcribe`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            s3Key,
            title: title || file.name.replace(/\.[^/.]+$/, ""),
            fileName: file.name,
          }),
        });

        if (!response.ok) {
          throw new Error("Không thể bắt đầu chuyển đổi. Vui lòng thử lại.");
        }

        const data = await response.json();

        // Create DynamoDB record for job history
        await client.models.MeetingJob.create({
          id: data.jobId,
          title: title || file.name.replace(/\.[^/.]+$/, ""),
          status: "TRANSCRIBING",
          audioKey: s3Key,
          fileName: file.name,
          audioDurationSeconds,
        });

        onTranscriptionStarted(data.jobId, audioDurationSeconds, s3Key);
        setTitle("");
      } catch (err: any) {
        setError(err.message || "Đã xảy ra lỗi khi tải lên.");
      } finally {
        setUploading(false);
        setFileName(null);
        setProgress(0);
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      }
    },
    [title, onTranscriptionStarted]
  );

  const handleCancel = () => {
    uploadTaskRef.current?.cancel();
    uploadTaskRef.current = null;
    setUploading(false);
    setFileName(null);
    setProgress(0);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleUpload(file);
  };

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      if (uploading) return;
      const file = e.dataTransfer.files?.[0];
      if (file) handleUpload(file);
    },
    [handleUpload, uploading]
  );

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const openPicker = () => {
    if (!uploading) fileInputRef.current?.click();
  };

  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <CardTitle className="font-serif text-xl">
          Tải lên bản ghi âm mới
        </CardTitle>
        <CardDescription>
          Hỗ trợ cuộc họp tiếng Việt, tối đa 10 người phát biểu.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-1.5">
          <label htmlFor="meeting-title" className="text-sm font-medium">
            Tên cuộc họp{" "}
            <span className="font-normal text-muted-foreground">
              (không bắt buộc)
            </span>
          </label>
          <Input
            id="meeting-title"
            type="text"
            placeholder="Ví dụ: Sinh hoạt Chi bộ tháng 10/2025"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={uploading}
            maxLength={120}
          />
        </div>

        <div
          role="button"
          tabIndex={uploading ? -1 : 0}
          aria-disabled={uploading}
          aria-label="Chọn hoặc kéo thả tệp âm thanh"
          className={`group relative flex min-h-56 flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 ${
            uploading
              ? "cursor-default border-primary/40 bg-primary/5"
              : isDragOver
                ? "cursor-copy border-primary bg-primary/10"
                : "cursor-pointer border-input bg-secondary/50 hover:border-primary/60 hover:bg-primary/5"
          }`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={openPicker}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              openPicker();
            }
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_FORMATS}
            onChange={handleFileChange}
            className="hidden"
            disabled={uploading}
            tabIndex={-1}
            aria-hidden="true"
          />

          {uploading ? (
            <div
              className="flex w-full max-w-sm flex-col items-center gap-3"
              role="status"
              aria-live="polite"
            >
              <FileAudio
                className="size-10 text-primary motion-safe:animate-pulse"
                aria-hidden="true"
              />
              <p className="max-w-full truncate text-sm font-medium">
                {fileName ?? "Đang tải lên..."}
              </p>
              <div
                className="h-2.5 w-full overflow-hidden rounded-full bg-muted"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={progress}
                aria-label="Tiến độ tải lên"
              >
                <div
                  className="h-full rounded-full bg-primary transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-xs tabular-nums text-muted-foreground">
                Đang tải lên… {progress}%
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  handleCancel();
                }}
              >
                Hủy tải lên
              </Button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <span
                aria-hidden="true"
                className="flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary transition-transform group-hover:scale-105"
              >
                <Upload className="size-6" />
              </span>
              <p className="text-base font-semibold">
                {isDragOver
                  ? "Thả tệp để bắt đầu"
                  : "Kéo thả tệp âm thanh vào đây"}
              </p>
              <p className="text-sm text-muted-foreground">
                hoặc{" "}
                <span className="font-medium text-primary underline underline-offset-4">
                  chọn tệp từ máy tính
                </span>
              </p>
              <ul className="mt-1 flex flex-wrap justify-center gap-1.5" aria-label="Định dạng hỗ trợ">
                {ACCEPTED_FORMATS.split(",").map((f) => (
                  <li
                    key={f}
                    className="rounded-md border bg-card px-2 py-0.5 text-xs font-medium text-muted-foreground"
                  >
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {error && (
          <div
            role="alert"
            className="flex items-start gap-2.5 rounded-lg border border-destructive/30 bg-destructive/10 p-3"
          >
            <AlertCircle
              className="mt-0.5 size-4 shrink-0 text-destructive"
              aria-hidden="true"
            />
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
