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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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

const STATUS_LABELS: Record<JobStatus, string> = {
  UPLOADING: "Đang tải lên",
  TRANSCRIBING: "Đang chuyển đổi",
  PROCESSING: "Đang xử lý",
  COMPLETED: "Hoàn tất",
  FAILED: "Lỗi",
};

const STATUS_COLORS: Record<JobStatus, string> = {
  UPLOADING: "bg-yellow-100 text-yellow-800 border-yellow-200",
  TRANSCRIBING: "bg-blue-100 text-blue-800 border-blue-200",
  PROCESSING: "bg-purple-100 text-purple-800 border-purple-200",
  COMPLETED: "bg-green-100 text-green-800 border-green-200",
  FAILED: "bg-red-100 text-red-800 border-red-200",
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

  const fetchJobs = useCallback(async () => {
    try {
      setLoading(true);
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
        <CardTitle className="flex items-center gap-2 text-lg">
          <Clock className="size-5" />
          Lịch sử cuộc họp
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Tìm kiếm cuộc họp..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="size-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filteredJobs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <FileAudio className="size-12 mb-3 opacity-40" />
            <p className="text-sm">
              {search ? "Không tìm thấy cuộc họp nào." : "Chưa có cuộc họp nào"}
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tên cuộc họp</TableHead>
                <TableHead>Tên tệp</TableHead>
                <TableHead>Ngày tạo</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead className="text-right">Hành động</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredJobs.map((job) => {
                const status = (job.status as JobStatus) || "UPLOADING";
                return (
                  <TableRow key={job.id}>
                    <TableCell className="font-medium max-w-[200px]">
                      {editingId === job.id ? (
                        <Input
                          autoFocus
                          value={editingTitle}
                          onChange={(e) => setEditingTitle(e.target.value)}
                          onBlur={() => handleTitleSave(job.id)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleTitleSave(job.id);
                            if (e.key === "Escape") setEditingId(null);
                          }}
                          className="h-7 text-sm"
                        />
                      ) : (
                        <span
                          className="cursor-pointer hover:underline truncate block"
                          title="Nhấp để đổi tên"
                          onClick={() => {
                            setEditingId(job.id);
                            setEditingTitle(job.title ?? "");
                          }}
                        >
                          {job.title || "Không có tiêu đề"}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="max-w-[150px] truncate text-muted-foreground">
                      {job.fileName}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(job.createdAt)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={STATUS_COLORS[status]}
                      >
                        {STATUS_LABELS[status] || status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDownloadAudio(job.audioKey)}
                          title="Tải âm thanh"
                        >
                          <Download className="size-4" />
                          <span className="hidden sm:inline ml-1">
                            Tải âm thanh
                          </span>
                        </Button>
                        {status === "COMPLETED" && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleViewReport(job.id, job.reportKey ?? "")}
                            disabled={viewingId === job.id}
                          >
                            {viewingId === job.id ? (
                              <>
                                <Loader2 className="size-3 animate-spin" />
                                Đang tải...
                              </>
                            ) : (
                              "Xem biên bản"
                            )}
                          </Button>
                        )}
                        {(status === "COMPLETED" || status === "FAILED") && (
                          <Button
                            variant="ghost"
                            size="sm"
                            aria-label="Xóa cuộc họp"
                            title="Xóa cuộc họp"
                            onClick={() => setDeleteTarget(job)}
                          >
                            <Trash2 className="size-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
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
