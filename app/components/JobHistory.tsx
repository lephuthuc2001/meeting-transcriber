"use client";

import { useState, useEffect, useCallback } from "react";
import { generateClient } from "aws-amplify/data";
import { getUrl } from "aws-amplify/storage";
import type { Schema } from "@/amplify/data/resource";
import {
  Search,
  Download,
  FileAudio,
  Clock,
  Trash2,
  Loader2,
  ChevronLeft,
  ChevronRight,
  FileText,
  Pencil,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { JobStatus } from "@/lib/types";
import outputs from "@/amplify_outputs.json";

const client = generateClient<Schema>({ authMode: "iam" });
const apiUrl = (outputs as any).custom?.apiUrl;

const PAGE_SIZE = 5;

// Longer than transcription + generation ever take; a row still in flight
// past this was never picked up (e.g. transcribed before the S3 trigger
// existed) and needs a manual kick.
const STUCK_AFTER_MS = 60 * 60 * 1000;

const isStuck = (job: { status?: string | null; updatedAt: string }) =>
  (job.status === "TRANSCRIBING" || job.status === "PROCESSING") &&
  Date.now() - new Date(job.updatedAt).getTime() > STUCK_AFTER_MS;

const STATUS_LABELS: Record<JobStatus, string> = {
  UPLOADING: "Đang tải lên",
  TRANSCRIBING: "Đang chuyển đổi",
  PROCESSING: "Đang xử lý",
  COMPLETED: "Hoàn tất",
  FAILED: "Lỗi",
};

const STATUS_COLORS: Record<JobStatus, string> = {
  UPLOADING: "bg-amber-100 text-amber-900 border-amber-300",
  TRANSCRIBING: "bg-blue-100 text-blue-900 border-blue-300",
  PROCESSING: "bg-indigo-100 text-indigo-900 border-indigo-300",
  COMPLETED: "bg-green-100 text-green-900 border-green-300",
  FAILED: "bg-red-100 text-red-900 border-red-300",
};

interface JobHistoryProps {
  refreshKey: number;
  onViewReport: (jobId: string, reportKey: string) => Promise<void>;
}

export default function JobHistory({
  refreshKey,
  onViewReport,
}: JobHistoryProps) {
  const [jobs, setJobs] = useState<Array<Schema["MeetingJob"]["type"]>>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Schema["MeetingJob"]["type"] | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const [retryingId, setRetryingId] = useState<string | null>(null);

  const fetchJobs = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const { data } = await client.models.MeetingJob.list({
        limit: 100,
      });
      const sorted = [...data].sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      setJobs(sorted);
    } catch (err) {
      console.error("Lỗi khi tải danh sách cuộc họp:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs, refreshKey]);

  // Rows still in flight may have finished while no tab was open. /status
  // reconciles the row server-side, so refetch once any of them settles.
  const pendingIds = jobs
    .filter((j) => j.status === "TRANSCRIBING" || j.status === "PROCESSING")
    .map((j) => j.id)
    .join(",");

  useEffect(() => {
    if (!pendingIds || !apiUrl) return;
    const reconcile = async () => {
      const settled = await Promise.all(
        pendingIds.split(",").map(async (jobId) => {
          try {
            const res = await fetch(`${apiUrl}/status?jobId=${jobId}`);
            if (!res.ok) return false;
            const data = await res.json();
            return data.reportReady || data.status === "FAILED";
          } catch {
            return false;
          }
        })
      );
      if (settled.some(Boolean)) fetchJobs(true);
    };
    reconcile();
    const intervalId = setInterval(reconcile, 15000);
    return () => clearInterval(intervalId);
  }, [pendingIds, fetchJobs]);

  const handleRetry = async (jobId: string) => {
    setRetryingId(jobId);
    try {
      const res = await fetch(`${apiUrl}/process`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      toast.success("Đang tạo lại biên bản");
      await fetchJobs(true);
    } catch (err) {
      console.error("Lỗi khi tạo lại biên bản:", err);
      toast.error("Không thể tạo lại biên bản. Vui lòng thử lại.");
    } finally {
      setRetryingId(null);
    }
  };

  const handleDownloadAudio = async (audioKey: string) => {
    try {
      const { url } = await getUrl({ path: audioKey });
      window.open(url.toString(), "_blank");
    } catch (err) {
      console.error("Lỗi khi tải âm thanh:", err);
    }
  };

  const handleViewReport = async (jobId: string, reportKey: string) => {
    setViewingId(jobId);
    try {
      await onViewReport(jobId, reportKey);
    } finally {
      setViewingId(null);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    const { id: jobId, audioKey, reportKey } = deleteTarget;
    setDeletingId(jobId);
    try {
      const res = await fetch(`${apiUrl}/delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId, audioKey, reportKey }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await client.models.MeetingJob.delete({ id: jobId });
      setJobs((prev) => prev.filter((j) => j.id !== jobId));
      setDeleteTarget(null);
      toast.success("Đã xóa cuộc họp");
    } catch (err) {
      console.error("Lỗi khi xóa cuộc họp:", err);
      toast.error("Không thể xóa cuộc họp. Vui lòng thử lại.");
    } finally {
      setDeletingId(null);
    }
  };

  const handleTitleSave = async (jobId: string) => {
    const trimmed = editingTitle.trim();
    if (trimmed) {
      await client.models.MeetingJob.update({ id: jobId, title: trimmed });
      setJobs((prev) =>
        prev.map((j) => (j.id === jobId ? { ...j, title: trimmed } : j))
      );
    }
    setEditingId(null);
  };

  const filteredJobs = jobs.filter((job) => {
    if (!search) return true;
    const term = search.toLowerCase();
    return (
      (job.title?.toLowerCase().includes(term)) ||
      (job.fileName?.toLowerCase().includes(term))
    );
  });

  const totalPages = Math.max(1, Math.ceil(filteredJobs.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pagedJobs = filteredJobs.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );
  const rangeStart = filteredJobs.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(currentPage * PAGE_SIZE, filteredJobs.length);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("vi-VN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-3 text-2xl">
          <Clock className="size-6 text-primary" aria-hidden="true" />
          Lịch sử cuộc họp
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="relative">
          <Search
            className="absolute left-4 top-1/2 -translate-y-1/2 size-5 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            aria-label="Tìm kiếm cuộc họp"
            placeholder="Tìm theo tên cuộc họp hoặc tên tệp..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="pl-11"
          />
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-10">
            <div className="size-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filteredJobs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <FileAudio className="size-14 mb-3 opacity-50" aria-hidden="true" />
            <p className="text-lg">
              {search ? "Không tìm thấy cuộc họp nào." : "Chưa có cuộc họp nào"}
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {pagedJobs.map((job) => {
              const status = (job.status as JobStatus) || "UPLOADING";
              return (
                <li
                  key={job.id}
                  className="rounded-xl border bg-card p-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    {editingId === job.id ? (
                      <Input
                        autoFocus
                        aria-label="Tên cuộc họp"
                        value={editingTitle}
                        onChange={(e) => setEditingTitle(e.target.value)}
                        onBlur={() => handleTitleSave(job.id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleTitleSave(job.id);
                          if (e.key === "Escape") setEditingId(null);
                        }}
                      />
                    ) : (
                      <button
                        type="button"
                        className="group flex max-w-full cursor-pointer items-center gap-2 text-left text-lg font-semibold hover:text-primary focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 rounded"
                        title="Nhấn để đổi tên"
                        onClick={() => {
                          setEditingId(job.id);
                          setEditingTitle(job.title ?? "");
                        }}
                      >
                        <span className="truncate">
                          {job.title || "Không có tiêu đề"}
                        </span>
                        <Pencil
                          className="size-4 shrink-0 text-muted-foreground group-hover:text-primary"
                          aria-hidden="true"
                        />
                        <span className="sr-only">Đổi tên</span>
                      </button>
                    )}
                    <p className="truncate text-base text-muted-foreground">
                      {job.fileName}
                    </p>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-base text-muted-foreground">
                      <span>{formatDate(job.createdAt)}</span>
                      <Badge
                        variant="outline"
                        className={`text-sm px-3 py-0.5 ${STATUS_COLORS[status]}`}
                      >
                        {STATUS_LABELS[status] || status}
                      </Badge>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {status === "COMPLETED" && (
                      <Button
                        onClick={() => handleViewReport(job.id, job.reportKey ?? "")}
                        disabled={viewingId === job.id}
                      >
                        {viewingId === job.id ? (
                          <>
                            <Loader2 className="size-4 animate-spin" />
                            Đang tải...
                          </>
                        ) : (
                          <>
                            <FileText className="size-4" />
                            Xem biên bản
                          </>
                        )}
                      </Button>
                    )}
                    {(status === "FAILED" || isStuck(job)) && (
                      <Button
                        variant="outline"
                        onClick={() => handleRetry(job.id)}
                        disabled={retryingId === job.id}
                      >
                        {retryingId === job.id ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <RotateCcw className="size-4" />
                        )}
                        Tạo lại biên bản
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      onClick={() => handleDownloadAudio(job.audioKey)}
                    >
                      <Download className="size-4" />
                      Tải âm thanh
                    </Button>
                    {(status === "COMPLETED" || status === "FAILED") && (
                      <Button
                        variant="outline"
                        size="icon"
                        aria-label="Xóa cuộc họp"
                        title="Xóa cuộc họp"
                        onClick={() => setDeleteTarget(job)}
                      >
                        <Trash2 className="size-5 text-destructive" />
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {!loading && filteredJobs.length > PAGE_SIZE && (
          <nav
            aria-label="Phân trang lịch sử cuộc họp"
            className="flex flex-col items-center gap-3 border-t pt-4 sm:flex-row sm:justify-between"
          >
            <p className="text-base text-muted-foreground" aria-live="polite">
              Hiển thị {rangeStart}–{rangeEnd} / {filteredJobs.length} cuộc họp
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => setPage(currentPage - 1)}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="size-4" />
                Trước
              </Button>
              <span className="min-w-24 text-center text-base font-medium">
                Trang {currentPage} / {totalPages}
              </span>
              <Button
                variant="outline"
                onClick={() => setPage(currentPage + 1)}
                disabled={currentPage === totalPages}
              >
                Sau
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </nav>
        )}
      </CardContent>

      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Xóa cuộc họp?</DialogTitle>
            <DialogDescription>
              Bạn có chắc muốn xóa cuộc họp{" "}
              <strong>{deleteTarget?.title || "Không có tiêu đề"}</strong>?
              Hành động này sẽ xóa toàn bộ dữ liệu (âm thanh, bản ghi, biên bản) và không thể hoàn tác.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              disabled={!!deletingId}
            >
              Hủy
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteConfirm}
              disabled={!!deletingId}
            >
              {deletingId ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Đang xóa...
                </>
              ) : (
                "Xóa"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
