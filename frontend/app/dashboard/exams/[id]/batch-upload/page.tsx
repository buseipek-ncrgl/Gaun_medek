"use client";

export const dynamic = 'force-dynamic';

import { useEffect, useMemo, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { examApi, type BatchStatusItem } from "@/lib/api/examApi";
import { Loader2, UploadCloud, CheckCircle2, XCircle, ArrowLeft } from "lucide-react";

export default function BatchUploadPage() {
  const params = useParams();
  const router = useRouter();
  const examId = params.id as string;

  const [files, setFiles] = useState<File[]>([]);
  const [batchId, setBatchId] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [status, setStatus] = useState<{
    totalFiles: number;
    processedCount: number;
    successCount: number;
    failedCount: number;
    statuses: BatchStatusItem[];
  } | null>(null);
  const [consecutiveErrors, setConsecutiveErrors] = useState(0);
  const [isPolling, setIsPolling] = useState(false);
  const MAX_RETRIES = 10; // Render cold start için daha fazla deneme
  const POLLING_INTERVAL = 5000; // 5 saniye aralık

  const fetchStatus = useCallback(async () => {
    if (!batchId) return;
    
    try {
      const data = await examApi.getBatchStatus(examId, batchId);
      if (!data) {
        throw new Error("Batch durumu alınamadı");
      }
      
      // Reset error counter on success
      setConsecutiveErrors(0);
      
      setStatus({
        totalFiles: data.totalFiles,
        processedCount: data.processedCount,
        successCount: data.successCount,
        failedCount: data.failedCount,
        statuses: data.statuses || [],
      });
      
      if (data.processedCount >= data.totalFiles) {
        toast.success(`Batch puanlama tamamlandı: ${data.successCount} başarılı, ${data.failedCount} başarısız`);
        setIsPolling(false);
        // stop polling
        setTimeout(() => {
          setBatchId(null);
          setConsecutiveErrors(0);
        }, 2000);
      }
    } catch (error: any) {
      console.error("Batch status fetch error:", error);
      
      const newErrorCount = consecutiveErrors + 1;
      setConsecutiveErrors(newErrorCount);
      
      // Stop polling after MAX_RETRIES consecutive errors (likely backend is down)
      if (newErrorCount >= MAX_RETRIES) {
        setIsPolling(false);
        const errorMessage = error?.response?.data?.message || error?.message || "Batch durumu okunamadı";
        toast.error(`${errorMessage} (${MAX_RETRIES} başarısız deneme - polling durduruldu)`);
        toast.info("Backend sunucusu çalışmıyor olabilir. Lütfen kontrol edin ve sayfayı yenileyin.");
        return;
      }
      
      // Show error only on first failure, not on every retry
      if (newErrorCount === 1) {
        const errorMessage = error?.response?.data?.message || error?.message || "Batch durumu okunamadı";
        toast.error(errorMessage);
      }
    }
  }, [batchId, examId, consecutiveErrors]);

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (batchId && isPolling) {
      fetchStatus(); // İlk çağrıyı hemen yap
      interval = setInterval(fetchStatus, POLLING_INTERVAL); // 5 saniyede bir (Render cold start için daha uzun)
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [batchId, fetchStatus, isPolling]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(event.target.files || []);
    setFiles(selected);
  };

  const handleStart = async () => {
    if (!files.length) {
      toast.error("Lütfen PDF dosyaları seçin");
      return;
    }
    setIsUploading(true);
    try {
      const data = await examApi.startBatchScore(examId, files);
      if (!data || !data.batchId) {
        throw new Error("Batch ID alınamadı");
      }
      setBatchId(data.batchId);
      setConsecutiveErrors(0);
      setIsPolling(true);
      setStatus({
        totalFiles: data.totalFiles,
        processedCount: 0,
        successCount: 0,
        failedCount: 0,
        statuses: [],
      });
      toast.success(`${data.totalFiles} dosya için batch puanlama başlatıldı`);
    } catch (error: any) {
      console.error("Batch upload error:", error);
      const errorMessage = error?.response?.data?.message || error?.message || "Batch başlatılamadı. Lütfen tekrar deneyin.";
      toast.error(errorMessage);
    } finally {
      setIsUploading(false);
    }
  };

  const progress = useMemo(() => {
    if (!status) return 0;
    if (status.totalFiles === 0) return 0;
    return Math.round((status.processedCount / status.totalFiles) * 100);
  }, [status]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.back()}
            className="h-10 w-10"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
          <h1 className="text-3xl font-bold tracking-tight">Toplu Sınav Yükleme</h1>
          <p className="text-muted-foreground">
            10-300 PDF’yi bir kerede yükleyin, AI otomatik puanlasın.
          </p>
          </div>
        </div>
        <Button variant="outline" onClick={() => router.push(`/dashboard/exams/${examId}/results`)}>
          Değerlendirme Sonuçlarını Görüntüle
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>PDF Yükle</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <label className="flex flex-col items-center justify-center w-full border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:bg-slate-50">
            <UploadCloud className="h-8 w-8 text-slate-500 mb-2" />
            <span className="text-sm text-slate-600">
              PDF’leri buraya sürükleyin veya seçin (çoklu seçim)
            </span>
            <input
              type="file"
              accept="application/pdf"
              multiple
              className="hidden"
              onChange={handleFileChange}
              disabled={isUploading || Boolean(batchId)}
            />
          </label>

          {files.length > 0 && (
            <div className="border rounded-lg p-3 max-h-64 overflow-auto text-sm">
              <div className="font-semibold mb-2">Seçilen dosyalar ({files.length}):</div>
              <ul className="space-y-1">
                {files.map((f) => (
                  <li key={f.name} className="flex justify-between">
                    <span>{f.name}</span>
                    <span className="text-slate-500">{(f.size / 1024).toFixed(1)} KB</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <Button
            onClick={handleStart}
            disabled={isUploading || Boolean(batchId) || files.length === 0}
            className="h-11 px-6"
          >
            {isUploading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Başlatılıyor...
              </>
            ) : (
              "Toplu Puanlamayı Başlat"
            )}
          </Button>
        </CardContent>
      </Card>

      {batchId && status && status.processedCount < status.totalFiles && (
        <Card className="border-2 border-blue-200 bg-blue-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
              <span>Hesaplanıyor...</span>
            </CardTitle>
          </CardHeader>
        </Card>
      )}

      {status && (
        <Card>
          <CardHeader>
            <CardTitle>İlerleme</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span>Toplam: {status.totalFiles}</span>
              <span>İşlenen: {status.processedCount}</span>
              <span className="text-emerald-600">Başarılı: {status.successCount}</span>
              <span className="text-red-600">Başarısız: {status.failedCount}</span>
            </div>
            <Progress value={progress} />
            <div className="overflow-auto max-h-72 border rounded-lg">
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="p-2 border">Öğrenci</th>
                    <th className="p-2 border">Durum</th>
                    <th className="p-2 border">Not</th>
                  </tr>
                </thead>
                <tbody>
                  {status.statuses.map((s, idx) => (
                    <tr key={idx} className="text-center">
                      <td className="border p-2">{s.studentNumber || "-"}</td>
                      <td className="border p-2">
                        {s.status === "success" ? (
                          <span className="inline-flex items-center gap-1 text-emerald-600">
                            <CheckCircle2 className="h-4 w-4" /> Başarılı
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-red-600">
                            <XCircle className="h-4 w-4" /> Başarısız
                          </span>
                        )}
                      </td>
                      <td className="border p-2 text-left">{s.message || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}


