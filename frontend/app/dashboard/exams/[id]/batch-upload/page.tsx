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
    <div className="space-y-4 sm:space-y-6 p-3 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.back()}
            className="h-9 w-9 sm:h-10 sm:w-10 flex-shrink-0"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
          <h1 className="text-3xl font-bold tracking-tight">Toplu Sınav Yükleme</h1>
          <p className="text-muted-foreground">
            10-300 PDF’yi bir kerede yükleyin, puanlama otomatik başlasın.
          </p>
          </div>
        </div>
        <Button 
          variant="outline" 
          onClick={() => router.push(`/dashboard/exams/${examId}/results`)}
          className="h-9 sm:h-10 px-3 sm:px-4 text-xs sm:text-sm w-full sm:w-auto"
        >
          <span className="hidden sm:inline">Değerlendirme Sonuçlarını Görüntüle</span>
          <span className="sm:hidden">Sonuçları Gör</span>
        </Button>
      </div>

      <Card>
        <CardHeader className="p-4 sm:p-6">
          <CardTitle className="text-base sm:text-lg md:text-xl">PDF Yükle</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 sm:space-y-4 p-4 sm:p-6">
          <label className="flex flex-col items-center justify-center w-full border-2 border-dashed rounded-lg p-4 sm:p-6 md:p-8 text-center cursor-pointer hover:bg-slate-50 transition-colors">
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
            <div className="border rounded-lg p-2 sm:p-3 max-h-48 sm:max-h-64 overflow-auto text-xs sm:text-sm">
              <div className="font-semibold mb-2 text-xs sm:text-sm">Seçilen dosyalar ({files.length}):</div>
              <ul className="space-y-1">
                {files.map((f) => (
                  <li key={f.name} className="flex justify-between items-center gap-2 break-words">
                    <span className="truncate flex-1 min-w-0">{f.name}</span>
                    <span className="text-slate-500 text-xs flex-shrink-0 whitespace-nowrap">{(f.size / 1024).toFixed(1)} KB</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <Button
            onClick={handleStart}
            disabled={isUploading || Boolean(batchId) || files.length === 0}
            className="h-10 sm:h-11 px-4 sm:px-6 text-sm sm:text-base w-full sm:w-auto"
          >
            {isUploading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" /> <span className="hidden sm:inline">Başlatılıyor...</span><span className="sm:hidden">Yükleniyor...</span>
              </>
            ) : (
              <>
                <span className="hidden sm:inline">Toplu Puanlamayı Başlat</span>
                <span className="sm:hidden">Başlat</span>
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {batchId && status && status.processedCount < status.totalFiles && (
        <Card className="border-2 border-blue-200 bg-blue-50">
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <Loader2 className="h-4 w-4 sm:h-5 sm:w-5 animate-spin text-blue-600 flex-shrink-0" />
              <span>Hesaplanıyor...</span>
            </CardTitle>
          </CardHeader>
        </Card>
      )}

      {status && (
        <Card>
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="text-base sm:text-lg md:text-xl">İlerleme</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 p-4 sm:p-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4 text-xs sm:text-sm">
              <div className="flex flex-col">
                <span className="text-muted-foreground">Toplam</span>
                <span className="font-semibold">{status.totalFiles}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-muted-foreground">İşlenen</span>
                <span className="font-semibold">{status.processedCount}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-muted-foreground">Başarılı</span>
                <span className="font-semibold text-emerald-600">{status.successCount}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-muted-foreground">Başarısız</span>
                <span className="font-semibold text-red-600">{status.failedCount}</span>
              </div>
            </div>
            <Progress value={progress} className="h-2 sm:h-3" />
            <div className="overflow-x-auto -mx-2 sm:mx-0 max-h-64 sm:max-h-72 border rounded-lg">
              <table className="w-full text-xs sm:text-sm min-w-[500px]">
                <thead className="bg-slate-50 dark:bg-slate-800 sticky top-0">
                  <tr>
                    <th className="p-1.5 sm:p-2 border text-left font-medium">Öğrenci</th>
                    <th className="p-1.5 sm:p-2 border text-center font-medium">Durum</th>
                    <th className="p-1.5 sm:p-2 border text-left font-medium">Not</th>
                  </tr>
                </thead>
                <tbody>
                  {status.statuses.map((s, idx) => (
                    <tr key={idx} className={idx % 2 === 0 ? "bg-background" : "bg-muted/30"}>
                      <td className="border p-1.5 sm:p-2 break-words">{s.studentNumber || "-"}</td>
                      <td className="border p-1.5 sm:p-2 text-center">
                        {s.status === "success" ? (
                          <span className="inline-flex items-center gap-1 text-emerald-600 text-xs sm:text-sm">
                            <CheckCircle2 className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" /> 
                            <span className="hidden sm:inline">Başarılı</span>
                            <span className="sm:hidden">✓</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-red-600 text-xs sm:text-sm">
                            <XCircle className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" /> 
                            <span className="hidden sm:inline">Başarısız</span>
                            <span className="sm:hidden">✗</span>
                          </span>
                        )}
                      </td>
                      <td className="border p-1.5 sm:p-2 text-left break-words">{s.message || "-"}</td>
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


