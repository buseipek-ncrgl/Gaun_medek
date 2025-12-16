"use client";

import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { Loader2, Save, Download, Target, GraduationCap, Info, Search, CheckSquare, Square, RotateCcw, RotateCw, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { programOutcomeApi, type ProgramOutcome } from "@/lib/api/programOutcomeApi";
import { courseApi, type Course } from "@/lib/api/courseApi";

interface MudekMatrixViewProps {
  courseId: string;
  course: Course;
  departmentId: string;
  onUpdate: () => void;
}

interface HistoryState {
  learningOutcomes: any[];
}

export function MudekMatrixView({
  courseId,
  course,
  departmentId,
  onUpdate,
}: MudekMatrixViewProps) {
  const [programOutcomes, setProgramOutcomes] = useState<ProgramOutcome[]>([]);
  const [learningOutcomes, setLearningOutcomes] = useState<any[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [loadingPOs, setLoadingPOs] = useState(true);
  const [hasChanges, setHasChanges] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<"all" | "selected" | "unselected">("all");
  const [history, setHistory] = useState<HistoryState[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [highlightedRow, setHighlightedRow] = useState<number | null>(null);
  const [highlightedCol, setHighlightedCol] = useState<string | null>(null);
  const saveButtonRef = useRef<HTMLButtonElement>(null);
  const tableRef = useRef<HTMLDivElement>(null);

  // Get programId from course
  const programId = typeof (course as any)?.program === "object" && (course as any)?.program !== null
    ? ((course as any).program as any)._id
    : (course as any)?.program || null;

  useEffect(() => {
    loadProgramOutcomes();
    loadLearningOutcomes();
  }, [departmentId, course, programId]);

  useEffect(() => {
    // Sticky save button
    const handleScroll = () => {
      if (saveButtonRef.current) {
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        if (scrollTop > 100) {
          saveButtonRef.current.classList.add("shadow-lg");
        } else {
          saveButtonRef.current.classList.remove("shadow-lg");
        }
      }
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const loadProgramOutcomes = async () => {
    try {
      setLoadingPOs(true);
      let data: ProgramOutcome[] = [];
      
      if (programId) {
        data = await programOutcomeApi.getByProgram(programId);
      } else if (departmentId) {
        data = await programOutcomeApi.getByDepartment(departmentId);
      } else {
        setProgramOutcomes([]);
        return;
      }
      
      setProgramOutcomes(data || []);
    } catch (error: any) {
      toast.error("Program çıktıları yüklenemedi");
      console.error(error);
    } finally {
      setLoadingPOs(false);
    }
  };

  const loadLearningOutcomes = () => {
    if (course.learningOutcomes && Array.isArray(course.learningOutcomes)) {
      const initialData = course.learningOutcomes.map((lo: any) => ({
        code: lo.code || "",
        description: lo.description || "",
        programOutcomes: lo.programOutcomes || lo.relatedProgramOutcomes || [],
      }));
      setLearningOutcomes(initialData);
      setHistory([{ learningOutcomes: JSON.parse(JSON.stringify(initialData)) }]);
      setHistoryIndex(0);
      setHasChanges(false);
    }
  };

  const addToHistory = (newState: any[]) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push({ learningOutcomes: JSON.parse(JSON.stringify(newState)) });
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
    setHasChanges(true);
  };

  const toggleMapping = (loIndex: number, poCode: string) => {
    const updated = [...learningOutcomes];
    const currentPOs = updated[loIndex].programOutcomes || [];
    updated[loIndex].programOutcomes = currentPOs.includes(poCode)
      ? currentPOs.filter((code: string) => code !== poCode)
      : [...currentPOs, poCode];
    setLearningOutcomes(updated);
    addToHistory(updated);
  };

  const handleBulkSelectRow = (loIndex: number, select: boolean) => {
    const updated = [...learningOutcomes];
    if (select) {
      updated[loIndex].programOutcomes = [...programOutcomes.map(po => po.code)];
    } else {
      updated[loIndex].programOutcomes = [];
    }
    setLearningOutcomes(updated);
    addToHistory(updated);
  };

  const handleBulkSelectColumn = (poCode: string, select: boolean) => {
    const updated = learningOutcomes.map((lo) => {
      const currentPOs = lo.programOutcomes || [];
      if (select) {
        if (!currentPOs.includes(poCode)) {
          return { ...lo, programOutcomes: [...currentPOs, poCode] };
        }
      } else {
        return { ...lo, programOutcomes: currentPOs.filter((code: string) => code !== poCode) };
      }
      return lo;
    });
    setLearningOutcomes(updated);
    addToHistory(updated);
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      setLearningOutcomes(JSON.parse(JSON.stringify(history[newIndex].learningOutcomes)));
      setHasChanges(newIndex !== 0);
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      setLearningOutcomes(JSON.parse(JSON.stringify(history[newIndex].learningOutcomes)));
      setHasChanges(newIndex !== history.length - 1);
    }
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      const payload = {
        learningOutcomes: learningOutcomes.map((lo) => ({
          code: lo.code.trim(),
          description: lo.description.trim(),
          programOutcomes: lo.programOutcomes || [],
        })),
      };

      await courseApi.updateCourse(courseId, payload);
      toast.success("ÖÇ → PÇ eşlemesi başarıyla kaydedildi");
      setHasChanges(false);
      onUpdate();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Eşleme kaydedilemedi");
    } finally {
      setIsSaving(false);
    }
  };

  const handleExportPDF = () => {
    window.print();
  };

  // İstatistikler hesapla
  const totalMappings = learningOutcomes.reduce(
    (sum, lo) => sum + (lo.programOutcomes?.length || 0),
    0
  );
  const avgMappingsPerLO = learningOutcomes.length > 0 
    ? (totalMappings / learningOutcomes.length).toFixed(1)
    : "0";
  const coverageByPO = programOutcomes.map((po) => ({
    code: po.code,
    count: learningOutcomes.filter((lo) => 
      lo.programOutcomes?.includes(po.code)
    ).length,
    percentage: learningOutcomes.length > 0
      ? ((learningOutcomes.filter((lo) => lo.programOutcomes?.includes(po.code)).length / learningOutcomes.length) * 100).toFixed(0)
      : "0",
  }));

  // Filter learning outcomes
  const filteredLOs = learningOutcomes.filter((lo) => {
    const matchesSearch = searchQuery === "" || 
      lo.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lo.description.toLowerCase().includes(searchQuery.toLowerCase());
    
    const selectedPOs = lo.programOutcomes || [];
    let matchesFilter = true;
    if (filterType === "selected") {
      matchesFilter = selectedPOs.length > 0;
    } else if (filterType === "unselected") {
      matchesFilter = selectedPOs.length === 0;
    }
    
    return matchesSearch && matchesFilter;
  });

  // Get heatmap intensity (0-100)
  const getHeatmapIntensity = (loIndex: number, poCode: string) => {
    const lo = learningOutcomes[loIndex];
    const isMapped = lo.programOutcomes?.includes(poCode);
    if (!isMapped) return 0;
    
    // Calculate intensity based on how many POs this LO maps to
    const totalPOs = lo.programOutcomes?.length || 0;
    return totalPOs > 0 ? Math.min(100, (1 / totalPOs) * 100) : 0;
  };

  if (loadingPOs) {
    return (
      <Card className="border border-brand-navy/20 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm shadow-modern">
        <CardContent className="p-12 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-brand-navy mx-auto mb-4" />
          <p className="text-lg text-muted-foreground">Program çıktıları yükleniyor...</p>
        </CardContent>
      </Card>
    );
  }

  if (programOutcomes.length === 0) {
    return (
      <Card className="border border-brand-navy/20 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm shadow-modern">
        <CardContent className="p-8 text-center">
          <p className="text-lg text-muted-foreground mb-4">
            Bu bölüm için henüz program çıktısı tanımlanmamış.
          </p>
          <Button
            onClick={() => window.open("/dashboard/program-outcomes", "_blank")}
            variant="outline"
            className="h-11 bg-gradient-to-r from-brand-navy to-[#0f3a6b] text-white hover:from-brand-navy/90 hover:to-[#0f3a6b]/90"
          >
            Program Çıktıları Yönetimi
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (learningOutcomes.length === 0) {
    return (
      <Card className="border border-brand-navy/20 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm shadow-modern">
        <CardContent className="p-8 text-center">
          <p className="text-lg text-muted-foreground">
            Bu ders için henüz öğrenme çıktısı tanımlanmamış. Lütfen dersi düzenleyip öğrenme çıktıları ekleyin.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header - Outside Card */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-1 h-8 bg-gradient-to-b from-brand-navy to-brand-navy/60 rounded-full"></div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-gradient-to-br from-brand-navy/10 to-brand-navy/5 dark:from-brand-navy/20 dark:to-brand-navy/10">
              <GraduationCap className="h-5 w-5 text-brand-navy dark:text-slate-200" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-brand-navy dark:text-slate-100">MEDEK Matrisi</h2>
              <p className="text-sm text-slate-600 dark:text-slate-400">Öğrenme Çıktıları (ÖÇ) ve Program Çıktıları (PÇ) arasındaki ilişki matrisi</p>
            </div>
          </div>
        </div>

        {/* Sticky Save Button and Controls */}
        <div className="sticky top-4 z-10 flex flex-wrap items-center gap-3 p-4 bg-white/90 dark:bg-slate-800/90 backdrop-blur-md border border-brand-navy/20 dark:border-slate-700/50 rounded-lg shadow-modern">
          <Button
            ref={saveButtonRef}
            onClick={handleSave}
            disabled={isSaving || !hasChanges}
            className="h-11 px-6 bg-gradient-to-r from-brand-navy to-[#0f3a6b] hover:from-brand-navy/90 hover:to-[#0f3a6b]/90 text-white shadow-lg hover:shadow-xl transition-all"
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Kaydediliyor...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Değişiklikleri Kaydet
              </>
            )}
          </Button>
          
          {hasChanges && (
            <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400">
              <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></div>
              <span>Kaydedilmemiş değişiklikler var</span>
            </div>
          )}

          <div className="flex items-center gap-2 ml-auto">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleUndo}
              disabled={historyIndex <= 0}
              className="h-9 w-9 p-0 hover:bg-brand-navy/10"
              title="Geri Al"
            >
              <RotateCcw className="h-4 w-4 text-brand-navy dark:text-slate-200" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRedo}
              disabled={historyIndex >= history.length - 1}
              className="h-9 w-9 p-0 hover:bg-brand-navy/10"
              title="Yinele"
            >
              <RotateCw className="h-4 w-4 text-brand-navy dark:text-slate-200" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleExportPDF}
              className="h-9 px-3 hover:bg-brand-navy/10"
              title="PDF İndir"
            >
              <Download className="h-4 w-4 mr-2 text-brand-navy dark:text-slate-200" />
              <span className="text-sm">PDF</span>
            </Button>
          </div>
        </div>

        {/* Search and Filter */}
        <Card className="border border-brand-navy/20 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm shadow-modern">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="ÖÇ ara (kod veya açıklama)..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 border-brand-navy/20 focus:border-brand-navy"
                />
              </div>
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-brand-navy dark:text-slate-200" />
                <div className="flex gap-1 bg-slate-100 dark:bg-slate-700 rounded-lg p-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setFilterType("all")}
                    className={cn(
                      "h-8 px-3 text-xs",
                      filterType === "all" 
                        ? "bg-white dark:bg-slate-600 text-brand-navy dark:text-white shadow-sm" 
                        : "text-slate-600 dark:text-slate-300"
                    )}
                  >
                    Tümü
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setFilterType("selected")}
                    className={cn(
                      "h-8 px-3 text-xs",
                      filterType === "selected" 
                        ? "bg-white dark:bg-slate-600 text-brand-navy dark:text-white shadow-sm" 
                        : "text-slate-600 dark:text-slate-300"
                    )}
                  >
                    Eşleşen
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setFilterType("unselected")}
                    className={cn(
                      "h-8 px-3 text-xs",
                      filterType === "unselected" 
                        ? "bg-white dark:bg-slate-600 text-brand-navy dark:text-white shadow-sm" 
                        : "text-slate-600 dark:text-slate-300"
                    )}
                  >
                    Eşleşmeyen
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* İstatistikler */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="group relative overflow-hidden border border-brand-navy/20 dark:border-slate-700/50 rounded-xl p-5 bg-gradient-to-br from-white to-slate-50/50 dark:from-slate-800 dark:to-slate-800/50 hover:border-brand-navy/50 hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
          <div className="absolute inset-0 bg-gradient-to-b from-[#0a294e] via-[#0f3a6b] to-[#051d35] opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
          <div className="relative flex items-center gap-4">
            <div className="p-3 bg-gradient-to-br from-brand-navy/15 to-brand-navy/5 dark:from-brand-navy/25 dark:to-brand-navy/15 group-hover:from-white/20 group-hover:to-white/10 rounded-xl transition-all duration-300">
              <Target className="h-6 w-6 text-brand-navy dark:text-slate-200 group-hover:text-white transition-colors" />
            </div>
            <div className="flex-1">
              <p className="text-xs font-semibold text-brand-navy/70 dark:text-slate-400 group-hover:text-white/80 uppercase tracking-wide transition-colors mb-1">Toplam ÖÇ</p>
              <p className="text-3xl font-bold text-brand-navy dark:text-slate-100 group-hover:text-white transition-colors">
                {learningOutcomes.length}
              </p>
            </div>
          </div>
        </Card>
        <Card className="group relative overflow-hidden border border-brand-navy/20 dark:border-slate-700/50 rounded-xl p-5 bg-gradient-to-br from-white to-slate-50/50 dark:from-slate-800 dark:to-slate-800/50 hover:border-brand-navy/50 hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
          <div className="absolute inset-0 bg-gradient-to-b from-[#0a294e] via-[#0f3a6b] to-[#051d35] opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
          <div className="relative flex items-center gap-4">
            <div className="p-3 bg-gradient-to-br from-brand-navy/15 to-brand-navy/5 dark:from-brand-navy/25 dark:to-brand-navy/15 group-hover:from-white/20 group-hover:to-white/10 rounded-xl transition-all duration-300">
              <GraduationCap className="h-6 w-6 text-brand-navy dark:text-slate-200 group-hover:text-white transition-colors" />
            </div>
            <div className="flex-1">
              <p className="text-xs font-semibold text-brand-navy/70 dark:text-slate-400 group-hover:text-white/80 uppercase tracking-wide transition-colors mb-1">Toplam PÇ</p>
              <p className="text-3xl font-bold text-brand-navy dark:text-slate-100 group-hover:text-white transition-colors">
                {programOutcomes.length}
              </p>
            </div>
          </div>
        </Card>
        <Card className="group relative overflow-hidden border border-brand-navy/20 dark:border-slate-700/50 rounded-xl p-5 bg-gradient-to-br from-white to-slate-50/50 dark:from-slate-800 dark:to-slate-800/50 hover:border-brand-navy/50 hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
          <div className="absolute inset-0 bg-gradient-to-b from-[#0a294e] via-[#0f3a6b] to-[#051d35] opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
          <div className="relative flex items-center gap-4">
            <div className="p-3 bg-gradient-to-br from-brand-navy/15 to-brand-navy/5 dark:from-brand-navy/25 dark:to-brand-navy/15 group-hover:from-white/20 group-hover:to-white/10 rounded-xl transition-all duration-300">
              <Info className="h-6 w-6 text-brand-navy dark:text-slate-200 group-hover:text-white transition-colors" />
            </div>
            <div className="flex-1">
              <p className="text-xs font-semibold text-brand-navy/70 dark:text-slate-400 group-hover:text-white/80 uppercase tracking-wide transition-colors mb-1">Ortalama Eşleme</p>
              <p className="text-3xl font-bold text-brand-navy dark:text-slate-100 group-hover:text-white transition-colors">
                {avgMappingsPerLO}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Matris Tablosu */}
      <Card className="border border-brand-navy/20 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm shadow-modern">
        <CardContent className="p-0">
          <div 
            ref={tableRef}
            className="overflow-x-auto overflow-y-auto w-full -mx-4 sm:mx-0 px-4 sm:px-0"
            style={{ maxHeight: "600px" }}
          >
            <div className="inline-block min-w-full align-middle">
              <Table className="border-2 w-full min-w-[800px] text-xs sm:text-sm">
              <TableHeader className="sticky top-0 z-20 bg-gradient-to-r from-brand-navy to-[#0f3a6b]">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="sticky left-0 z-30 text-white font-bold text-center min-w-[120px] border-r-2 border-white/20 bg-gradient-to-r from-brand-navy to-[#0f3a6b]">
                    <div className="flex flex-col items-center gap-1">
                      <span>ÖÇ Kodu</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          filteredLOs.forEach((_, index) => {
                            const originalIndex = learningOutcomes.findIndex(lo => lo.code === filteredLOs[index].code);
                            handleBulkSelectRow(originalIndex, true);
                          });
                        }}
                        className="h-6 px-2 text-xs text-white/90 hover:text-white hover:bg-white/20 mt-1"
                        title="Tümünü Seç"
                      >
                        <CheckSquare className="h-3 w-3" />
                      </Button>
                    </div>
                  </TableHead>
                  <TableHead className="sticky left-[120px] z-20 text-white font-bold min-w-[300px] border-r-2 border-white/20 bg-gradient-to-r from-brand-navy to-[#0f3a6b]">
                    ÖÇ Açıklaması
                  </TableHead>
                  {programOutcomes.map((po) => (
                    <TableHead
                      key={po.code}
                      className="text-white font-bold text-center min-w-[100px] border-r-2 border-white/20 last:border-r-0 relative group"
                      onMouseEnter={() => setHighlightedCol(po.code)}
                      onMouseLeave={() => setHighlightedCol(null)}
                    >
                      <div className="flex flex-col items-center gap-1">
                        <span>{po.code}</span>
                        <span className="text-xs font-normal opacity-90">
                          {coverageByPO.find((c) => c.code === po.code)?.count || 0} ÖÇ
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleBulkSelectColumn(po.code, true)}
                          className="h-6 px-2 text-xs text-white/90 hover:text-white hover:bg-white/20 mt-1 opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Tümünü Seç"
                        >
                          <CheckSquare className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLOs.map((lo, filteredIndex) => {
                  const originalIndex = learningOutcomes.findIndex(l => l.code === lo.code);
                  const selectedPOs = lo.programOutcomes || [];
                  const isRowHighlighted = highlightedRow === originalIndex;
                  
                  return (
                    <TableRow
                      key={originalIndex}
                      className={cn(
                        "hover:bg-brand-navy/5 dark:hover:bg-brand-navy/10 transition-colors",
                        isRowHighlighted && "bg-brand-navy/10 dark:bg-brand-navy/20"
                      )}
                      onMouseEnter={() => setHighlightedRow(originalIndex)}
                      onMouseLeave={() => setHighlightedRow(null)}
                    >
                      <TableCell className="sticky left-0 z-10 font-bold text-center bg-white dark:bg-slate-800 border-r-2 border-brand-navy/20 dark:border-slate-700/50">
                        <Badge variant="default" className="bg-gradient-to-r from-brand-navy to-[#0f3a6b] text-white">
                          {lo.code}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleBulkSelectRow(originalIndex, selectedPOs.length < programOutcomes.length)}
                          className="h-6 px-2 text-xs mt-1 hover:bg-brand-navy/10"
                          title={selectedPOs.length < programOutcomes.length ? "Tümünü Seç" : "Tümünü Kaldır"}
                        >
                          {selectedPOs.length < programOutcomes.length ? (
                            <CheckSquare className="h-3 w-3" />
                          ) : (
                            <Square className="h-3 w-3" />
                          )}
                        </Button>
                      </TableCell>
                      <TableCell className="sticky left-[120px] z-10 bg-white dark:bg-slate-800 border-r-2 border-brand-navy/20 dark:border-slate-700/50">
                        <p className="text-sm text-foreground">{lo.description}</p>
                        {selectedPOs.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {selectedPOs.map((poCode: string) => (
                              <Badge
                                key={poCode}
                                variant="outline"
                                className="text-xs border-brand-navy/30 text-brand-navy dark:text-slate-300"
                              >
                                {poCode}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </TableCell>
                      {programOutcomes.map((po) => {
                        const isMapped = selectedPOs.includes(po.code);
                        const isColHighlighted = highlightedCol === po.code;
                        const intensity = getHeatmapIntensity(originalIndex, po.code);
                        const isCellHighlighted = isRowHighlighted || isColHighlighted;
                        
                        return (
                          <TableCell
                            key={po.code}
                            className={cn(
                              "text-center border-r-2 border-brand-navy/10 dark:border-slate-700/30 last:border-r-0 cursor-pointer transition-all duration-200",
                              isMapped 
                                ? "bg-gradient-to-br from-brand-navy/20 to-brand-navy/10 dark:from-brand-navy/30 dark:to-brand-navy/20" 
                                : "hover:bg-brand-navy/5 dark:hover:bg-slate-700/50",
                              isCellHighlighted && "bg-brand-navy/15 dark:bg-brand-navy/25"
                            )}
                            onClick={() => toggleMapping(originalIndex, po.code)}
                            onMouseEnter={() => {
                              setHighlightedRow(originalIndex);
                              setHighlightedCol(po.code);
                            }}
                            onMouseLeave={() => {
                              setHighlightedRow(null);
                              setHighlightedCol(null);
                            }}
                          >
                            <div className="flex items-center justify-center">
                              <div className={cn(
                                "w-8 h-8 rounded-lg flex items-center justify-center transition-all",
                                isMapped 
                                  ? "bg-gradient-to-br from-brand-navy to-[#0f3a6b] text-white shadow-md hover:shadow-lg hover:scale-110" 
                                  : "border-2 border-brand-navy/30 hover:border-brand-navy hover:bg-brand-navy/10"
                              )}>
                                {isMapped && (
                                  <span className="text-sm font-bold">✓</span>
                                )}
                              </div>
                            </div>
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            </div>
          </div>
        </CardContent>
      </Card>

      {filteredLOs.length === 0 && (
        <Card className="border border-brand-navy/20 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm shadow-modern">
          <CardContent className="p-8 text-center">
            <p className="text-lg text-muted-foreground">
              {filterType === "selected" 
                ? "Eşleşen öğrenme çıktısı bulunamadı."
                : filterType === "unselected"
                ? "Eşleşmeyen öğrenme çıktısı bulunamadı."
                : "Öğrenme çıktısı bulunamadı."}
            </p>
          </CardContent>
        </Card>
      )}

      {/* PÇ Kapsam Analizi */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-1 h-8 bg-gradient-to-b from-brand-navy to-brand-navy/60 rounded-full"></div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-gradient-to-br from-brand-navy/10 to-brand-navy/5 dark:from-brand-navy/20 dark:to-brand-navy/10">
              <Info className="h-5 w-5 text-brand-navy dark:text-slate-200" />
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-brand-navy dark:text-slate-100">PÇ Kapsam Analizi</h2>
          </div>
        </div>
        <Card className="border border-brand-navy/20 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm shadow-modern">
          <CardContent className="p-4 sm:p-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {coverageByPO.map((coverage) => (
                <div
                  key={coverage.code}
                  className="group p-4 border border-brand-navy/20 dark:border-slate-700/50 rounded-lg bg-white/50 dark:bg-slate-800/50 hover:border-brand-navy/50 hover:shadow-md transition-all duration-300 hover:-translate-y-1 cursor-pointer"
                  onClick={() => {
                    setHighlightedCol(coverage.code);
                    setTimeout(() => setHighlightedCol(null), 2000);
                  }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <Badge variant="outline" className="bg-gradient-to-r from-brand-navy/10 to-brand-navy/5 dark:from-brand-navy/20 dark:to-brand-navy/10 border-brand-navy/30 text-brand-navy dark:text-slate-200">
                      {coverage.code}
                    </Badge>
                    <span className="text-sm font-semibold text-brand-navy dark:text-slate-100">
                      {coverage.percentage}%
                    </span>
                  </div>
                  <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2.5 mb-2">
                    <div
                      className="bg-gradient-to-r from-brand-navy to-[#0f3a6b] h-2.5 rounded-full transition-all duration-500"
                      style={{ width: `${coverage.percentage}%` }}
                    />
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    {coverage.count} / {learningOutcomes.length} ÖÇ
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bilgi Notu */}
      <Card className="border border-brand-navy/20 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm shadow-modern">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-brand-navy dark:text-slate-200 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-slate-700 dark:text-slate-300">
              <p className="font-semibold mb-1 text-brand-navy dark:text-slate-100">Kullanım Kılavuzu:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Matris üzerindeki hücrelere tıklayarak ÖÇ → PÇ eşlemesi yapabilirsiniz</li>
                <li>Bir ÖÇ, birden fazla PÇ'ye eşlenebilir</li>
                <li>Satır/sütun başlıklarındaki butonlarla toplu seçim yapabilirsiniz</li>
                <li>Değişiklikleri kaydetmek için "Değişiklikleri Kaydet" butonuna tıklayın</li>
                <li>Matrisi PDF olarak indirmek için "PDF" butonunu kullanın</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
