"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  examApi,
  type Exam,
  type CreateExamDto,
  type UpdateExamDto,
} from "@/lib/api/examApi";
import { courseApi, type Course } from "@/lib/api/courseApi";

interface ExamFormProps {
  mode: "create" | "edit";
  examId?: string;
  initialData?: Exam;
  /** Güncelleme sonrası güncel sınav verisi ile çağrılır (hemen yansıması için). */
  onSuccess?: (updatedExam?: Exam) => void;
}

type QuestionRow = {
  questionNumber: number;
  /** Tek ÖÇ (eski format, geriye dönük uyumluluk) */
  learningOutcomeCode?: string;
  /** Birden fazla ÖÇ (her soru için). Gönderimde bunu kullanıyoruz. */
  learningOutcomeCodes: string[];
};

export function ExamForm({ mode, examId, initialData, onSuccess }: ExamFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [courses, setCourses] = useState<Course[]>([]);
  const [courseId, setCourseId] = useState(() => {
    if (initialData?.courseId) {
      // Handle both string and populated object
      if (typeof initialData.courseId === 'string') {
        console.log("📌 Initial courseId (string):", initialData.courseId);
        return initialData.courseId;
      } else if (typeof initialData.courseId === 'object' && initialData.courseId !== null) {
        console.log("📌 Initial courseId (object):", initialData.courseId._id);
        return initialData.courseId._id;
      }
    }
    console.log("📌 Initial courseId: empty");
    return "";
  });
  const [examType, setExamType] = useState<"midterm" | "final">(
    initialData?.examType || "midterm"
  );
  const [examCode, setExamCode] = useState(initialData?.examCode || "");
  const [passingScore, setPassingScore] = useState<number>(() => {
    const v = initialData?.passingScore;
    if (typeof v === "number" && v >= 0 && v <= 100) return v;
    return 60;
  });
  const maxScore = 100; // Her zaman 100, sabit
  const [existingExams, setExistingExams] = useState<Exam[]>([]);
  const [examCodeError, setExamCodeError] = useState("");
  const [questions, setQuestions] = useState<QuestionRow[]>([]);
  const [openDropdownIndex, setOpenDropdownIndex] = useState<number | null>(null);
  const dropdownRefs = useRef<Record<number, HTMLDivElement | null>>({});

  useEffect(() => {
    fetchCourses();
  }, []);

  // Açılır liste dışına tıklanınca kapat
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (openDropdownIndex === null) return;
      const container = dropdownRefs.current[openDropdownIndex];
      if (container && !container.contains(target)) {
        setOpenDropdownIndex(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [openDropdownIndex]);

  // Düzenleme modunda initialData'dan course bilgisini al ve courses array'ine ekle
  useEffect(() => {
    if (mode === "edit" && initialData?.courseId) {
      const courseIdValue = typeof initialData.courseId === 'string' 
        ? initialData.courseId 
        : initialData.courseId._id;
      
      // Fetch full course data to get midtermExam and finalExam info
      const loadCourseData = async () => {
        try {
          console.log("🔄 Loading course data for edit mode, courseId:", courseIdValue);
          const fullCourse = await courseApi.getById(courseIdValue);
          console.log("✅ Course loaded:", {
            _id: fullCourse._id,
            name: fullCourse.name,
            midtermExam: fullCourse.midtermExam,
            finalExam: fullCourse.finalExam,
            hasMidtermQuestionCount: !!fullCourse.midtermExam?.questionCount,
            hasFinalQuestionCount: !!fullCourse.finalExam?.questionCount,
          });
          setCourses(prev => {
            const exists = prev.find(c => c._id === fullCourse._id);
            if (!exists) {
              return [...prev, fullCourse];
            } else {
              // Update existing course with full data
              return prev.map(c => c._id === fullCourse._id ? fullCourse : c);
            }
          });
        } catch (error) {
          console.error("❌ Failed to load course data:", error);
          // Fallback: use populated course from initialData if available
      if (typeof initialData.courseId === 'object' && initialData.courseId !== null) {
        const populatedCourse = initialData.courseId as any;
        setCourses(prev => {
          const exists = prev.find(c => c._id === populatedCourse._id);
          if (!exists) {
            return [...prev, {
              _id: populatedCourse._id,
              name: populatedCourse.name,
              code: populatedCourse.code,
              learningOutcomes: populatedCourse.learningOutcomes || [],
            } as Course];
          }
          return prev;
        });
      }
        }
      };
      
      loadCourseData();
    }
  }, [mode, initialData]);

  // Düzenleme modunda initialData güncellendiğinde (örn. kayıt sonrası refetch) form state'ini senkronize et
  useEffect(() => {
    if (mode !== "edit" || !initialData) return;
    const v = initialData.passingScore;
    if (typeof v === "number" && v >= 0 && v <= 100) setPassingScore(v);
  }, [mode, initialData?.passingScore]);

  // Soru bazlı işlem kaldırıldı - artık genel puan kullanılıyor

  const fetchCourses = async () => {
    try {
      const data = await courseApi.getAll();
      setCourses(data);
    } catch (error) {
      toast.error("Dersler yüklenemedi");
    }
  };

  const checkExamCode = async () => {
    if (!courseId || !examCode.trim()) {
      setExamCodeError("");
      return;
    }

    try {
      const courseExams = await examApi.getByCourse(courseId);
      setExistingExams(courseExams);
      const duplicate = courseExams.find(
        (exam) => 
          exam.examCode.trim().toLowerCase() === examCode.trim().toLowerCase() &&
          (mode === "create" || (mode === "edit" && exam._id !== examId))
      );
      if (duplicate) {
        setExamCodeError(`"${examCode.trim()}" sınav kodu bu ders için zaten mevcut. Aynı ders içinde aynı sınav kodu kullanılamaz.`);
      } else {
        setExamCodeError("");
      }
    } catch (error) {
      console.error("Sınav kontrolü yapılamadı:", error);
      setExamCodeError("");
    }
  };

  useEffect(() => {
    if (courseId && examCode.trim()) {
      checkExamCode();
    } else {
      setExamCodeError("");
      setExistingExams([]);
    }
  }, [courseId, examCode, mode, examId]);

  const selectedCourse = useMemo(
    () => courses.find((c) => c._id === courseId),
    [courses, courseId]
  );

  const learningOutcomeOptions =
    selectedCourse?.learningOutcomes?.map((lo) => ({
      code: lo.code,
      label: `${lo.code} – ${lo.description}`,
    })) || [];

  // Get question count from course based on exam type, or from exam's existing questions
  const questionCount = useMemo(() => {
    // In edit mode, if exam has questions, use that count as fallback
    if (mode === "edit" && initialData?.questions && Array.isArray(initialData.questions) && initialData.questions.length > 0) {
      const examQuestionCount = initialData.questions.length;
      if (selectedCourse) {
        const courseQuestionCount = examType === "midterm" 
          ? selectedCourse.midtermExam?.questionCount || 0
          : selectedCourse.finalExam?.questionCount || 0;
        // Use course count if available, otherwise use exam's question count
        const count = courseQuestionCount > 0 ? courseQuestionCount : examQuestionCount;
        console.log("📊 Question count calculated:", {
          examType,
          count,
          fromCourse: courseQuestionCount,
          fromExam: examQuestionCount,
          midtermExam: selectedCourse.midtermExam,
          finalExam: selectedCourse.finalExam,
        });
        return count;
      } else {
        // No course selected yet, use exam's question count
        console.log("📊 Question count from exam (no course yet):", examQuestionCount);
        return examQuestionCount;
      }
    }
    
    if (!selectedCourse) {
      console.log("⚠️ No selectedCourse for questionCount");
      return 0;
    }
    const count = examType === "midterm" 
      ? selectedCourse.midtermExam?.questionCount || 0
      : selectedCourse.finalExam?.questionCount || 0;
    console.log("📊 Question count calculated:", {
      examType,
      count,
      midtermExam: selectedCourse.midtermExam,
      finalExam: selectedCourse.finalExam,
    });
    return count;
  }, [selectedCourse, examType, mode, initialData?.questions]);

  // Track previous learningOutcomes, questions, and questions length to detect changes
  const prevLearningOutcomesRef = useRef<string[] | undefined>(undefined);
  const prevQuestionsRef = useRef<any[] | undefined>(undefined);
  const prevQuestionsLengthRef = useRef<number>(0);

  // Initialize questions when course or exam type changes
  useEffect(() => {
    const initialLOs = mode === "edit" && initialData?.learningOutcomes && Array.isArray(initialData.learningOutcomes) && initialData.learningOutcomes.length > 0
      ? initialData.learningOutcomes
      : null;

    const learningOutcomesChanged = JSON.stringify(prevLearningOutcomesRef.current) !== JSON.stringify(initialData?.learningOutcomes);
    const questionsChanged = JSON.stringify(prevQuestionsRef.current) !== JSON.stringify(initialData?.questions);
    const initialDataQuestionsChanged = mode === "edit" && initialData?.questions && Array.isArray(initialData.questions) && 
      JSON.stringify(prevQuestionsRef.current) !== JSON.stringify(initialData.questions);

    console.log("🔍 Questions initialization:", {
      questionCount,
      selectedCourse: selectedCourse ? { 
        _id: selectedCourse._id, 
        name: selectedCourse.name,
        midtermExam: selectedCourse.midtermExam,
        finalExam: selectedCourse.finalExam,
      } : null,
      courseId,
      examType,
      mode,
      hasInitialLOs: !!initialLOs,
      initialLOsCount: initialLOs?.length || 0,
      currentQuestionsCount: questions.length,
      learningOutcomesChanged,
      questionsChanged,
      initialDataQuestionsChanged,
      initialDataQuestionsCount: initialData?.questions?.length || 0,
    });

    // Initialize if we have question count OR if we have existing questions in edit mode
    const hasQuestionCount = questionCount > 0;
    const hasExistingQuestions = mode === "edit" && initialData?.questions && Array.isArray(initialData.questions) && initialData.questions.length > 0;
    
    if ((hasQuestionCount && selectedCourse) || (hasExistingQuestions && mode === "edit")) {
      // Initialize if learningOutcomes or questions changed (after save) or if questions need to be created
      const shouldInitialize = (learningOutcomesChanged || questionsChanged || initialDataQuestionsChanged) && mode === "edit";
      const needsInitialization = prevQuestionsLengthRef.current === 0 || prevQuestionsLengthRef.current !== questionCount;
      
      console.log("🔍 Initialization check:", {
        shouldInitialize,
        needsInitialization,
        prevLength: prevQuestionsLengthRef.current,
        currentLength: questionCount,
        hasQuestionCount,
        hasExistingQuestions,
        initialDataQuestionsChanged,
      });
      
      if (shouldInitialize || needsInitialization) {
        console.log("✅ Initializing questions with count:", questionCount);
        // In edit mode, try to load existing questions from initialData first
        // If initialData questions changed (after update), use them
        if (mode === "edit" && initialData?.questions && Array.isArray(initialData.questions) && initialData.questions.length > 0) {
          const examQuestions = initialData.questions;
          const toRow = (q: { questionNumber: number; learningOutcomeCode?: string; learningOutcomeCodes?: string[] }) => {
            const codes = Array.isArray((q as any).learningOutcomeCodes) && (q as any).learningOutcomeCodes.length > 0
              ? (q as any).learningOutcomeCodes
              : ((q as any).learningOutcomeCode ? [(q as any).learningOutcomeCode] : []);
            return { questionNumber: q.questionNumber, learningOutcomeCodes: codes };
          };
          if (examQuestions.length === questionCount) {
            setQuestions(examQuestions.map(toRow));
            prevQuestionsRef.current = examQuestions.map(toRow);
          } else {
            const adjustedQuestions = Array.from({ length: questionCount }, (_, i) => {
              const existing = examQuestions.find(q => q.questionNumber === i + 1);
              return existing ? toRow(existing) : { questionNumber: i + 1, learningOutcomeCodes: [] as string[] };
            });
            setQuestions(adjustedQuestions);
            prevQuestionsRef.current = adjustedQuestions;
          }
          prevLearningOutcomesRef.current = initialData.learningOutcomes;
          prevQuestionsLengthRef.current = questionCount;
        } else if (initialLOs && initialLOs.length > 0) {
          const newQuestions = Array.from({ length: questionCount }, (_, i) => ({
            questionNumber: i + 1,
            learningOutcomeCodes: [initialLOs[i % initialLOs.length] || ""].filter(Boolean),
          }));
          setQuestions(newQuestions);
          prevLearningOutcomesRef.current = initialLOs;
          prevQuestionsRef.current = newQuestions;
          prevQuestionsLengthRef.current = questionCount;
        } else {
          if (prevQuestionsLengthRef.current === 0 || prevQuestionsLengthRef.current !== questionCount) {
            const newQuestions = Array.from({ length: questionCount }, (_, i) => ({
              questionNumber: i + 1,
              learningOutcomeCodes: [] as string[],
            }));
            setQuestions(newQuestions);
            prevQuestionsRef.current = newQuestions;
            prevQuestionsLengthRef.current = questionCount;
          }
        }
      }
    } else if (questionCount === 0) {
      // Don't clear questions if questionCount is 0 - keep existing questions
      // This prevents losing mappings when course data is loading or missing
      if (mode === "edit" && initialData?.questions && Array.isArray(initialData.questions) && initialData.questions.length > 0) {
        if (prevQuestionsLengthRef.current !== initialData.questions.length) {
          const toRow = (q: any) => ({
            questionNumber: q.questionNumber,
            learningOutcomeCodes: Array.isArray(q.learningOutcomeCodes) && q.learningOutcomeCodes.length > 0
              ? q.learningOutcomeCodes
              : (q.learningOutcomeCode ? [q.learningOutcomeCode] : []),
          });
          setQuestions(initialData.questions.map(toRow));
          prevQuestionsLengthRef.current = initialData.questions.length;
          prevQuestionsRef.current = initialData.questions.map(toRow);
        }
      } else if (prevQuestionsLengthRef.current > 0 && questions.length > 0) {
        // Keep current questions if they exist
        console.log("⚠️ Question count is 0, but keeping current questions:", questions.length);
        // Don't clear - just don't update
      }
    } else {
      console.log("⏳ Waiting for course data...", {
        questionCount,
        hasSelectedCourse: !!selectedCourse,
        courseId,
        examType,
      });
    }
    // Note: If selectedCourse is not loaded yet, questions will remain empty
    // They will be initialized once course is loaded
  }, [questionCount, mode, initialData?.learningOutcomes, selectedCourse, courseId, examType]);

  const handleQuestionLoToggle = (index: number, loCode: string) => {
    setQuestions((prev) =>
      prev.map((q, idx) => {
        if (idx !== index) return q;
        const codes = q.learningOutcomeCodes || [];
        const next = codes.includes(loCode)
          ? codes.filter((c) => c !== loCode)
          : [...codes, loCode];
        return { ...q, learningOutcomeCodes: next };
      })
    );
  };

  const validateForm = () => {
    if (!courseId) {
      toast.error("Ders seçimi zorunludur");
      return false;
    }
    if (!examCode.trim()) {
      toast.error("Sınav kodu zorunludur");
      return false;
    }
    if (examCodeError) {
      toast.error(examCodeError);
      return false;
    }
    for (const q of questions) {
      if (!q.learningOutcomeCodes?.length) {
        toast.error(`Soru ${q.questionNumber} için en az bir ÖÇ seçmelisiniz`);
        return false;
      }
    }
    if (learningOutcomeOptions.length === 0) {
      toast.error("Bu ders için tanımlı öğrenme çıktısı yok");
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    setIsSubmitting(true);
    try {
      const selectedLOs = questions.flatMap((q) => q.learningOutcomeCodes || []);
      const uniqueLOs = Array.from(new Set(selectedLOs));

      const payload: CreateExamDto | UpdateExamDto = {
        courseId,
        examType,
        examCode: examCode.trim(),
        maxScore: Number(maxScore),
        learningOutcomes: uniqueLOs.length > 0 ? uniqueLOs : undefined,
        passingScore: passingScore >= 0 && passingScore <= 100 ? passingScore : 60,
      };

      if (mode === "create") {
        (payload as CreateExamDto).questions = questions.length > 0
          ? questions.map((q) => ({ questionNumber: q.questionNumber, learningOutcomeCodes: q.learningOutcomeCodes || [] }))
          : undefined;
      } else if (mode === "edit") {
        (payload as UpdateExamDto).questions = questions.map((q) => ({
          questionNumber: q.questionNumber,
          learningOutcomeCodes: q.learningOutcomeCodes || [],
        }));
      }

      if (mode === "create") {
        await examApi.create(payload as CreateExamDto);
        toast.success("Sınav başarıyla oluşturuldu");
        
        // Dispatch event to notify other components (e.g., courses page)
        window.dispatchEvent(new CustomEvent('examCreated', { 
          detail: { courseId, examType: examType } 
        }));
        
        router.push("/exams");
      } else if (mode === "edit" && examId) {
        const updated = await examApi.update(examId, payload as UpdateExamDto);
        toast.success("Sınav başarıyla güncellendi");
        window.dispatchEvent(new CustomEvent('examUpdated', { 
          detail: { courseId, examId } 
        }));
        onSuccess?.(updated);
        return;
      }
      onSuccess?.();
    } catch (error: any) {
      const errorMessage =
        error?.response?.data?.message ||
        error?.message ||
        "Sınav kaydedilemedi";
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6 min-w-0">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
        <div className="space-y-2 min-w-0">
          <Label htmlFor="courseId" className="text-sm sm:text-base">
            Ders <span className="text-red-500">*</span>
          </Label>
          <Select
            id="courseId"
            value={courseId}
            disabled={isSubmitting || mode === "edit"}
            onChange={(e) => setCourseId(e.target.value)}
            className="h-10 sm:h-12 text-sm sm:text-base w-full"
          >
            <option value="">Bir ders seçin</option>
            {courses.map((course) => (
              <option key={course._id} value={course._id}>
                {course.code} - {course.name}
              </option>
            ))}
          </Select>
        </div>

        <div className="space-y-2 min-w-0">
          <Label htmlFor="examType" className="text-sm sm:text-base">
            Sınav Türü <span className="text-red-500">*</span>
          </Label>
          <Select
            id="examType"
            value={examType}
            onChange={(e) => setExamType(e.target.value as "midterm" | "final")}
            disabled={isSubmitting}
            className="h-10 sm:h-12 text-sm sm:text-base w-full"
          >
            <option value="midterm">Vize</option>
            <option value="final">Final</option>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
        <div className="space-y-2 min-w-0 md:col-span-1">
          <Label htmlFor="examCode" className="text-sm sm:text-base">
            Sınav Kodu <span className="text-red-500">*</span>
          </Label>
          <Input
            id="examCode"
            value={examCode}
            onChange={(e) => setExamCode(e.target.value)}
            disabled={isSubmitting}
            placeholder="Örn: VIZE-2025-1"
            className={`h-10 sm:h-12 text-sm sm:text-base w-full ${examCodeError ? "border-red-500 focus:border-red-500" : ""}`}
          />
          {examCodeError && (
            <p className="text-xs sm:text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-2 rounded-lg break-words">
              {examCodeError}
            </p>
          )}
        </div>
        <div className="space-y-2 min-w-0">
          <Label htmlFor="maxScore" className="text-sm sm:text-base">
            Maksimum Puan
          </Label>
          <div className="h-10 sm:h-12 text-sm sm:text-base flex items-center px-3 sm:px-4 bg-slate-50 dark:bg-slate-800 rounded-md border border-input">
            <span className="font-semibold">100</span>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Maksimum toplam puan (sabit)
          </p>
        </div>
        <div className="space-y-2 min-w-0">
          <Label htmlFor="passingScore" className="text-sm sm:text-base">
            Geçme notu (0–100)
          </Label>
          <Input
            id="passingScore"
            type="number"
            min={0}
            max={100}
            value={passingScore}
            onChange={(e) => {
              const n = parseInt(e.target.value, 10);
              if (!Number.isNaN(n)) setPassingScore(Math.min(100, Math.max(0, n)));
            }}
            disabled={isSubmitting}
            className="h-10 sm:h-12 text-sm sm:text-base w-full"
          />
          <p className="text-xs sm:text-sm text-muted-foreground">
            Bu puan ve üzeri geçer sayılır.
          </p>
        </div>
      </div>

      <Card className="border-2 border-gray-200 dark:border-slate-700 overflow-hidden">
        <CardHeader className="p-4 sm:p-6">
          <CardTitle className="text-base sm:text-lg">Sorular → ÖÇ Seçimi</CardTitle>
          {!courseId && (
            <p className="text-xs sm:text-sm text-amber-600 mt-2">
              ⚠️ ÖÇ seçmek için önce bir ders seçmelisiniz.
            </p>
          )}
          {courseId && learningOutcomeOptions.length === 0 && (
            <p className="text-xs sm:text-sm text-amber-600 mt-2">
              ⚠️ Bu ders için henüz öğrenme çıktısı (ÖÇ) tanımlanmamış. Lütfen önce ders için ÖÇ ekleyin.
            </p>
          )}
          {courseId && learningOutcomeOptions.length > 0 && (
            <p className="text-xs sm:text-sm text-muted-foreground mt-2">
              Her soruyu ilgili öğrenme çıktısına (ÖÇ) eşleyin. MEDEK değerlendirmesi için zorunludur.
            </p>
          )}
          {courseId && questionCount === 0 && selectedCourse && (
            <div className="text-xs sm:text-sm text-amber-600 mt-2 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
              <p className="font-semibold mb-2">
              ⚠️ Bu ders için {examType === "midterm" ? "vize" : "final"} sınavı için soru sayısı tanımlanmamış.
              </p>
              <p className="mb-2">
                ÖÇ eşleştirmesi yapabilmek için önce ders düzenleme sayfasından soru sayısını eklemeniz gerekiyor.
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  const courseIdValue = typeof selectedCourse._id === 'string' ? selectedCourse._id : selectedCourse._id;
                  router.push(`/dashboard/courses/${courseIdValue}`);
                }}
                className="mt-2 border-amber-300 text-amber-700 hover:bg-amber-100 dark:border-amber-700 dark:text-amber-300 dark:hover:bg-amber-900/30 text-xs sm:text-sm w-full sm:w-auto"
              >
                Ders Düzenleme Sayfasına Git
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent className="space-y-3 sm:space-y-4 p-4 sm:p-6 pt-0">
          {questionCount === 0 && (
            <p className="text-sm text-muted-foreground">
              {courseId && selectedCourse 
                ? "Bu ders için soru sayısı tanımlanmamış. Lütfen ders düzenleme sayfasından soru sayısını ekleyin."
                : "Soru sayısı girildiğinde satırlar oluşacak."}
            </p>
          )}
          {questions.map((q, idx) => {
            const selectedCodes = q.learningOutcomeCodes || [];
            const hasSelection = selectedCodes.length > 0;
            return (
              <div
                key={q.questionNumber}
                className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 p-3 sm:p-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 min-w-0"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-400">
                    Soru {q.questionNumber}
                  </span>
                  {!hasSelection && (
                    <Badge variant="outline" className="text-xs text-amber-600 border-amber-300">
                      ÖÇ seçilmedi
                    </Badge>
                  )}
                </div>
                <div className="space-y-1 min-w-0">
                  <Label className="text-xs sm:text-sm">Öğrenme Çıktıları (ÖÇ) <span className="text-red-500">*</span></Label>
                  {selectedCodes.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 p-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800/50 mb-2">
                      {selectedCodes.map((code) => (
                        <Badge
                          key={code}
                          variant="secondary"
                          className="text-xs px-2 py-0.5 bg-[#0a294e]/10 text-[#0a294e] dark:bg-[#0a294e]/20 dark:text-slate-200"
                        >
                          {code}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleQuestionLoToggle(idx, code);
                            }}
                            className="ml-1 hover:text-red-600 rounded"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                  <div
                    className="relative min-w-0"
                    ref={(el) => {
                      dropdownRefs.current[idx] = el;
                    }}
                  >
                    <button
                      type="button"
                      disabled={isSubmitting || learningOutcomeOptions.length === 0 || !courseId}
                      onClick={() => setOpenDropdownIndex(openDropdownIndex === idx ? null : idx)}
                      className={cn(
                        "flex items-center justify-between w-full min-h-[2.75rem] h-auto py-2 px-3 rounded-md border text-left text-sm font-medium transition-colors",
                        "border-input bg-background hover:bg-accent hover:text-accent-foreground",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                        "disabled:pointer-events-none disabled:opacity-50",
                        !hasSelection
                          ? "border-amber-400 bg-amber-50/50 text-amber-800 dark:border-amber-600 dark:bg-amber-950/30 dark:text-amber-200"
                          : "border-slate-300 dark:border-slate-600"
                      )}
                    >
                      <span className="truncate">
                        {hasSelection
                          ? `${selectedCodes.length} ÖÇ seçildi — tıklayarak ekleyin/çıkarın`
                          : "ÖÇ seçin (birden fazla seçebilirsiniz)"}
                      </span>
                      <ChevronDown
                        className={cn("h-4 w-4 shrink-0 ml-2 text-slate-600 dark:text-slate-400 transition-transform", openDropdownIndex === idx && "rotate-180")}
                        aria-hidden
                      />
                    </button>
                    {openDropdownIndex === idx && learningOutcomeOptions.length > 0 && (
                      <div
                        className="absolute left-0 right-0 top-full z-50 mt-1 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-lg max-h-60 overflow-auto"
                        role="listbox"
                      >
                        {learningOutcomeOptions.map((opt) => {
                          const isChecked = selectedCodes.includes(opt.code);
                          return (
                            <div
                              key={opt.code}
                              role="option"
                              aria-selected={isChecked}
                              className={cn(
                                "flex items-center gap-2 p-2 cursor-pointer select-none border-b border-slate-100 dark:border-slate-700 last:border-b-0",
                                "hover:bg-slate-100 dark:hover:bg-slate-700",
                                isChecked && "bg-brand-navy/5 dark:bg-brand-navy/10"
                              )}
                              onClick={() => handleQuestionLoToggle(idx, opt.code)}
                            >
                              <Checkbox
                                checked={isChecked}
                                className="pointer-events-none shrink-0"
                              />
                              <span className="text-sm font-medium flex-1">{opt.label}</span>
                              {isChecked && (
                                <span className="text-xs text-green-600 dark:text-green-400 font-medium">✓</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  {!courseId && (
                    <p className="text-xs text-amber-600 mt-1">Ders seçilmediği için ÖÇ seçilemiyor</p>
                  )}
                  {courseId && learningOutcomeOptions.length === 0 && (
                    <p className="text-xs text-amber-600 mt-1">Bu ders için ÖÇ tanımlanmamış</p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">Her soru için birden fazla ÖÇ seçebilirsiniz.</p>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2 sm:gap-4">
        <Button type="submit" disabled={isSubmitting} className="h-10 sm:h-12 px-4 sm:px-6 flex-1 sm:flex-none min-w-0">
          {isSubmitting
            ? "Kaydediliyor..."
            : mode === "create"
            ? "Sınav Oluştur"
            : "Sınavı Güncelle"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={isSubmitting}
          className="h-10 sm:h-12 px-4 sm:px-6 flex-1 sm:flex-none min-w-0"
        >
          İptal
        </Button>
      </div>
    </form>
  );
}

