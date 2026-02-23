"use client";

import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { Loader2, Save, Target, ChevronDown, ChevronUp, Search, CheckSquare, Square, RotateCcw, RotateCw, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { programOutcomeApi, type ProgramOutcome } from "@/lib/api/programOutcomeApi";
import { courseApi, type Course } from "@/lib/api/courseApi";

interface LearningOutcomeMappingProps {
  courseId: string;
  course: Course;
  departmentId: string;
  onUpdate: () => void;
}

interface HistoryState {
  learningOutcomes: any[];
}

export function LearningOutcomeMapping({
  courseId,
  course,
  departmentId,
  onUpdate,
}: LearningOutcomeMappingProps) {
  const [programOutcomes, setProgramOutcomes] = useState<ProgramOutcome[]>([]);
  const [learningOutcomes, setLearningOutcomes] = useState<any[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [loadingPOs, setLoadingPOs] = useState(true);
  const [expandedLOs, setExpandedLOs] = useState<Set<number>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<"all" | "selected" | "unselected">("all");
  const [history, setHistory] = useState<HistoryState[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [hasChanges, setHasChanges] = useState(false);
  const saveButtonRef = useRef<HTMLButtonElement>(null);

  // Get programId from course
  const programId = typeof (course as any)?.program === "object" && (course as any)?.program !== null
    ? ((course as any).program as any)._id
    : (course as any)?.program || null;

  useEffect(() => {
    loadProgramOutcomes();
    loadLearningOutcomes();
  }, [departmentId, course, programId]);

  useEffect(() => {
    // Auto-expand first LO on load
    if (learningOutcomes.length > 0 && expandedLOs.size === 0) {
      setExpandedLOs(new Set([0]));
    }
  }, [learningOutcomes.length]);

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

  const toggleProgramOutcome = (loIndex: number, poCode: string) => {
    const updated = [...learningOutcomes];
    const currentPOs = updated[loIndex].programOutcomes || [];
    updated[loIndex].programOutcomes = currentPOs.includes(poCode)
      ? currentPOs.filter((code: string) => code !== poCode)
      : [...currentPOs, poCode];
    setLearningOutcomes(updated);
    addToHistory(updated);
  };

  const toggleLOExpanded = (index: number) => {
    const newExpanded = new Set(expandedLOs);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedLOs(newExpanded);
  };

  const handleBulkSelect = (poCode: string, select: boolean) => {
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

  // Filter program outcomes
  const filteredPOs = programOutcomes.filter((po) => {
    const matchesSearch = searchQuery === "" || 
      po.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      po.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  // Filter learning outcomes based on filterType
  const filteredLOs = learningOutcomes.filter((lo, index) => {
    const selectedPOs = lo.programOutcomes || [];
    if (filterType === "selected") {
      return selectedPOs.length > 0;
    } else if (filterType === "unselected") {
      return selectedPOs.length === 0;
    }
    return true;
  });

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
    <div className="space-y-4 sm:space-y-6 min-w-0">
      {/* Header - Outside Card */}
      <div className="space-y-3 sm:space-y-4">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="w-1 h-6 sm:h-8 bg-gradient-to-b from-brand-navy to-brand-navy/60 rounded-full flex-shrink-0"></div>
          <div className="flex items-center gap-2 min-w-0">
            <div className="p-1.5 sm:p-2 rounded-lg bg-gradient-to-br from-brand-navy/10 to-brand-navy/5 dark:from-brand-navy/20 dark:to-brand-navy/10 flex-shrink-0">
              <Target className="h-4 w-4 sm:h-5 sm:w-5 text-brand-navy dark:text-slate-200" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-xl md:text-2xl font-bold text-brand-navy dark:text-slate-100 break-words">ÖÇ → PÇ Eşlemesi</h2>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 break-words">Her öğrenme çıktısı için hangi program çıktılarına katkıda bulunduğunu seçin</p>
            </div>
          </div>
        </div>

        {/* Sticky Save Button and Controls */}
        <div className="sticky top-2 sm:top-4 z-10 flex flex-wrap items-center gap-2 sm:gap-3 p-3 sm:p-4 bg-white/90 dark:bg-slate-800/90 backdrop-blur-md border border-brand-navy/20 dark:border-slate-700/50 rounded-lg shadow-modern">
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
          </div>
        </div>

        {/* Search and Filter */}
        <Card className="border border-brand-navy/20 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm shadow-modern">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="PÇ ara (kod veya açıklama)..."
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
                    Seçili
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
                    Seçili Değil
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Learning Outcomes Cards */}
      <div className="space-y-4">
        {filteredLOs.map((lo, loIndex) => {
          const originalIndex = learningOutcomes.findIndex(l => l.code === lo.code);
          const selectedPOs = lo.programOutcomes || [];
          const isExpanded = expandedLOs.has(originalIndex);
          
          return (
            <Card 
              key={originalIndex} 
              className="border border-brand-navy/20 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm shadow-modern hover:shadow-lg transition-all duration-300"
            >
              <CardContent className="p-0">
                {/* LO Header - Collapsible */}
                <div 
                  className="p-4 sm:p-5 cursor-pointer hover:bg-brand-navy/5 dark:hover:bg-brand-navy/10 transition-colors"
                  onClick={() => toggleLOExpanded(originalIndex)}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <Badge 
                        variant="default" 
                        className="bg-gradient-to-r from-brand-navy to-[#0f3a6b] text-white text-sm sm:text-base px-3 py-1.5 flex-shrink-0"
                      >
                        {lo.code}
                      </Badge>
                      <div className="flex-1 min-w-0">
                        <p className="text-base sm:text-lg font-semibold text-brand-navy dark:text-slate-100 break-words">
                          {lo.description}
                        </p>
                        <div className="flex items-center gap-2 mt-2">
                          <Badge 
                            variant="outline" 
                            className="text-xs border-brand-navy/30 text-brand-navy dark:text-slate-300"
                          >
                            {selectedPOs.length} PÇ seçili
                          </Badge>
                          {selectedPOs.length > 0 && (
                            <span className="text-xs text-slate-600 dark:text-slate-400">
                              {selectedPOs.join(", ")}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 flex-shrink-0 hover:bg-brand-navy/10"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleLOExpanded(originalIndex);
                      }}
                    >
                      {isExpanded ? (
                        <ChevronUp className="h-5 w-5 text-brand-navy dark:text-slate-200" />
                      ) : (
                        <ChevronDown className="h-5 w-5 text-brand-navy dark:text-slate-200" />
                      )}
                    </Button>
                  </div>
                </div>

                {/* LO Content - Collapsible */}
                {isExpanded && (
                  <div className="px-4 sm:px-5 pb-4 sm:pb-5 border-t border-brand-navy/10 dark:border-slate-700/50 pt-4">
                    <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                      Bu öğrenme çıktısı hangi program çıktılarına katkıda bulunur?
                    </p>
                    
                    {/* Grid Layout for PÇs */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {filteredPOs.map((po) => {
                        const isSelected = selectedPOs.includes(po.code);
                        return (
                          <div
                            key={po.code}
                            onClick={() => toggleProgramOutcome(originalIndex, po.code)}
                            className={cn(
                              "group relative p-3 sm:p-4 rounded-lg border-2 cursor-pointer transition-all duration-200",
                              "hover:shadow-md hover:-translate-y-0.5",
                              isSelected
                                ? "bg-gradient-to-br from-brand-navy to-[#0f3a6b] border-brand-navy text-white shadow-md"
                                : "bg-white dark:bg-slate-800 border-brand-navy/20 dark:border-slate-700/50 hover:border-brand-navy/50 hover:bg-brand-navy/5 dark:hover:bg-brand-navy/10"
                            )}
                          >
                            <div className="flex items-start gap-3">
                              <div className={cn(
                                "mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all",
                                isSelected
                                  ? "bg-white border-white"
                                  : "border-brand-navy/40 dark:border-slate-400 group-hover:border-brand-navy"
                              )}>
                                {isSelected && (
                                  <span className="text-brand-navy text-xs font-bold">✓</span>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className={cn(
                                  "font-semibold text-sm mb-1",
                                  isSelected ? "text-white" : "text-brand-navy dark:text-slate-100"
                                )}>
                                  {po.code}
                                </p>
                                <p className={cn(
                                  "text-xs line-clamp-2",
                                  isSelected 
                                    ? "text-white/90" 
                                    : "text-slate-600 dark:text-slate-400"
                                )}>
                                  {po.description}
                                </p>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Bulk Actions */}
                    {filteredPOs.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-brand-navy/10 dark:border-slate-700/50">
                        <p className="text-xs font-semibold text-brand-navy dark:text-slate-300 mb-2">Toplu İşlemler:</p>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              filteredPOs.forEach(po => {
                                if (!selectedPOs.includes(po.code)) {
                                  toggleProgramOutcome(originalIndex, po.code);
                                }
                              });
                            }}
                            className="h-8 text-xs border-brand-navy/20 hover:bg-brand-navy/10"
                          >
                            <CheckSquare className="h-3 w-3 mr-1" />
                            Tümünü Seç
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              selectedPOs.forEach((poCode: string) => {
                                toggleProgramOutcome(originalIndex, poCode);
                              });
                            }}
                            className="h-8 text-xs border-brand-navy/20 hover:bg-brand-navy/10"
                          >
                            <Square className="h-3 w-3 mr-1" />
                            Tümünü Kaldır
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filteredLOs.length === 0 && (
        <Card className="border border-brand-navy/20 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm shadow-modern">
          <CardContent className="p-8 text-center">
            <p className="text-lg text-muted-foreground">
              {filterType === "selected" 
                ? "Seçili öğrenme çıktısı bulunamadı."
                : filterType === "unselected"
                ? "Seçili olmayan öğrenme çıktısı bulunamadı."
                : "Öğrenme çıktısı bulunamadı."}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
