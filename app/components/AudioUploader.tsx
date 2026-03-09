"use client";

import { useState, useRef, useCallback } from "react";
import { uploadData } from "aws-amplify/storage";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "@/amplify/data/resource";
import { Upload, FileAudio } from "lucide-react";
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
const client = generateClient<Schema>({ authMode: "apiKey" });

const ACCEPTED_FORMATS = ".m4a,.mp3,.wav,.mp4,.flac";

interface AudioUploaderProps {
  onTranscriptionStarted: (jobId: string) => void;
}

export default function AudioUploader({
  onTranscriptionStarted,
}: AudioUploaderProps) {
  const [title, setTitle] = useState("");
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = useCallback(
    async (file: File) => {
      setUploading(true);
      setProgress(0);
      setError(null);

      const s3Key = `audio/${Date.now()}-${file.name}`;

      try {
        await uploadData({
          path: s3Key,
          data: file,
          options: {
            onProgress: ({ transferredBytes, totalBytes }) => {
              if (totalBytes) {
                setProgress(Math.round((transferredBytes / totalBytes) * 100));
              }
            },
          },
        }).result;

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
        });

        onTranscriptionStarted(data.jobId);
        setTitle("");
      } catch (err: any) {
        setError(err.message || "Đã xảy ra lỗi khi tải lên.");
      } finally {
        setUploading(false);
        setProgress(0);
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      }
    },
    [title, onTranscriptionStarted]
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleUpload(file);
  };

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const file = e.dataTransfer.files?.[0];
      if (file) handleUpload(file);
    },
    [handleUpload]
  );

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Upload className="size-5" />
          Tải lên bản ghi âm mới
        </CardTitle>
        <CardDescription>
          Tải lên tệp âm thanh cuộc họp để tạo biên bản tự động
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <label className="text-sm font-medium mb-1.5 block">
            Tên cuộc họp (không bắt buộc)
          </label>
          <Input
            type="text"
            placeholder="Ví dụ: Họp ban giám đốc ngày 08/03"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={uploading}
          />
        </div>

        <div
          className={`relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors cursor-pointer ${
            isDragOver
              ? "border-primary bg-primary/5"
              : "border-muted-foreground/25 hover:border-primary/50"
          } ${uploading ? "pointer-events-none opacity-60" : ""}`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_FORMATS}
            onChange={handleFileChange}
            className="hidden"
            disabled={uploading}
          />

          {uploading ? (
            <div className="flex flex-col items-center gap-3 w-full">
              <FileAudio className="size-10 text-primary animate-pulse" />
              <p className="text-sm font-medium">Đang tải lên...</p>
              <div className="w-full max-w-xs bg-muted rounded-full h-2.5">
                <div
                  className="bg-primary h-2.5 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground">{progress}%</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <FileAudio className="size-10 text-muted-foreground" />
              <p className="text-sm font-medium text-center">
                Kéo thả tệp âm thanh vào đây hoặc nhấn để chọn
              </p>
              <p className="text-xs text-muted-foreground">
                Định dạng hỗ trợ: .m4a, .mp3, .wav, .mp4, .flac
              </p>
            </div>
          )}
        </div>

        {error && (
          <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
