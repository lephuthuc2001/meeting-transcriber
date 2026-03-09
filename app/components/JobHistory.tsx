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
} from "lucide-react";
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
import type { JobStatus } from "@/lib/types";
import outputs from "@/amplify_outputs.json";

const client = generateClient<Schema>({ authMode: "apiKey" });
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
  onViewReport: (jobId: string) => void;
}

export default function JobHistory({
  refreshKey,
  onViewReport,
}: JobHistoryProps) {
  const [jobs, setJobs] = useState<Array<Schema["MeetingJob"]["type"]>>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

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

  const handleViewReport = async (jobId: string) => {
    onViewReport(jobId);
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
                    <TableCell className="font-medium max-w-[200px] truncate">
                      {job.title || "Không có tiêu đề"}
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
                            onClick={() => handleViewReport(job.id)}
                          >
                            Xem biên bản
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
    </Card>
  );
}
