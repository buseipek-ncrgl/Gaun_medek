"use client";

export const dynamic = 'force-dynamic';

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2, Loader2, ChevronDown, ChevronUp, Upload, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { StudentImporter } from "@/components/courses/StudentImporter";
import { OutcomeEditor } from "@/components/courses/OutcomeEditor";
import { ExamSettingsComponent, type ExamSettings } from "@/components/courses/ExamSettings";
import { courseApi, type Course } from "@/lib/api/courseApi";
import { departmentApi, type Department } from "@/lib/api/departmentApi";
import { programApi, type Program } from "@/lib/api/programApi";

interface LearningOutcomeInput {
  code: string;
  description: string;
  programOutcomes?: string[];
}

export default function EditCoursePage() {
  const router = useRouter();
  const params = useParams();
  const courseId = params.id as string;

  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingCourse, setIsLoadingCourse] = useState(true);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loadingDepartments, setLoadingDepartments] = useState(false);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loadingPrograms, setLoadingPrograms] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    courseInfo: true,
    learningOutcomes: false,
    examSettings: false,
    studentImport: false,
  });

  // Form state
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [programId, setProgramId] = useState("");
  const [semester, setSemester] = useState("");
  const [learningOutcomes, setLearningOutcomes] = useState<LearningOutcomeInput[]>([
    { code: "", description: "", programOutcomes: [] },
  ]);
  const [midtermExam, setMidtermExam] = useState<ExamSettings>({
    examCode: "",
    questionCount: 0,
    maxScorePerQuestion: 0,
  });
  const [finalExam, setFinalExam] = useState<ExamSettings>({
    examCode: "",
    questionCount: 0,
    maxScorePerQuestion: 0,
  });
  const [students, setStudents] = useState<Array<{ studentNumber: string; fullName: string }>>([]);
  const [reportPassingThreshold, setReportPassingThreshold] = useState<number | "">("");

  // Validation errors
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (courseId) {
      const initialize = async () => {
        await loadDepartments();
        await loadCourseData();
      };
      initialize();
    }
  }, [courseId]);

  useEffect(() => {
    if (departmentId) {
      loadPrograms(departmentId);
    } else {
      setPrograms([]);
      setProgramId("");
    }
  }, [departmentId]);

  const loadDepartments = async () => {
    try {
      setLoadingDepartments(true);
      const data = await departmentApi.getAll();
      if (data && data.length > 0) {
        setDepartments(data);
      } else {
        setDepartments([]);
      }
    } catch (error: any) {
      console.error("Bölümler yüklenirken hata:", error);
      setDepartments([]);
    } finally {
      setLoadingDepartments(false);
    }
  };

  const loadPrograms = async (deptId: string) => {
    try {
      setLoadingPrograms(true);
      const data = await programApi.getAll(deptId);
      if (data && data.length > 0) {
        setPrograms(data);
      } else {
        setPrograms([]);
      }
    } catch (error: any) {
      console.error("Programlar yüklenirken hata:", error);
      setPrograms([]);
    } finally {
      setLoadingPrograms(false);
    }
  };

  const loadCourseData = async () => {
    try {
      setIsLoadingCourse(true);
      const course = await courseApi.getById(courseId);
      
      // Populate form with course data
      setName(course.name);
      setCode(course.code);
      setDescription(course.description || "");
      // Handle department: can be ObjectId (new) or string (old)
      const dept = (course as any).department;
      if (dept && typeof dept === "object" && dept._id) {
        setDepartmentId(dept._id);
      } else if (dept && typeof dept === "string") {
        // Old format - try to find matching department by name
        const matchingDept = departments.find((d) => d.name === dept);
        if (matchingDept) {
          setDepartmentId(matchingDept._id);
        } else {
          setDepartmentId("");
        }
      } else {
        setDepartmentId("");
      }
      // Handle program
      const prog = (course as any).program;
      if (prog && typeof prog === "object" && prog._id) {
        setProgramId(prog._id);
      } else if (prog && typeof prog === "string") {
        setProgramId(prog);
      } else {
        setProgramId("");
      }
      setSemester((course as any).semester || "");

      // Load learning outcomes - use directly from course (embedded, not IDs)
      setLearningOutcomes(
        course.learningOutcomes && Array.isArray(course.learningOutcomes) && course.learningOutcomes.length > 0
          ? course.learningOutcomes.map((lo: any) => ({
              code: lo.code || "",
              description: lo.description || "",
              programOutcomes: lo.programOutcomes || lo.relatedProgramOutcomes || [],
            }))
          : [{ code: "", description: "", programOutcomes: [] }]
      );

      // Load exam settings
      if ((course as any).midtermExam) {
        setMidtermExam({
          examCode: (course as any).midtermExam.examCode || "",
          questionCount: (course as any).midtermExam.questionCount || 0,
          maxScorePerQuestion: (course as any).midtermExam.maxScorePerQuestion || 0,
        });
      }
      if ((course as any).finalExam) {
        setFinalExam({
          examCode: (course as any).finalExam.examCode || "",
          questionCount: (course as any).finalExam.questionCount || 0,
          maxScorePerQuestion: (course as any).finalExam.maxScorePerQuestion || 0,
        });
      }
      const rpt = (course as any).reportPassingThreshold;
      setReportPassingThreshold(rpt != null && rpt !== "" ? Number(rpt) : "");

      // Load students
      if ((course as any).students && Array.isArray((course as any).students)) {
        setStudents((course as any).students);
      }
    } catch (error: any) {
      toast.error("Ders bilgileri yüklenemedi");
      console.error(error);
      router.push("/dashboard/courses");
    } finally {
      setIsLoadingCourse(false);
    }
  };

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };




  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!name.trim()) {
      newErrors.name = "Ders adı gereklidir";
    } else if (name.trim().length < 3) {
      newErrors.name = "Ders adı en az 3 karakter olmalıdır";
    }

    if (!code.trim()) {
      newErrors.code = "Ders kodu gereklidir";
    } else if (code.trim().length < 2) {
      newErrors.code = "Ders kodu en az 2 karakter olmalıdır";
    } else if (!/^[A-Z0-9]+$/.test(code.trim().toUpperCase())) {
      newErrors.code = "Ders kodu sadece büyük harf ve rakam içermelidir";
    }

    if (!departmentId.trim()) {
      newErrors.department = "Lütfen bir bölüm seçin.";
    }

    const validOutcomes = learningOutcomes.filter(
      (lo) => lo.code.trim() && lo.description.trim()
    );

    if (validOutcomes.length === 0) {
      newErrors.learningOutcomes = "En az bir öğrenme çıktısı (ÖÇ) eklemelisiniz";
    }

    learningOutcomes.forEach((lo, index) => {
      if (lo.code.trim() && !lo.description.trim()) {
        newErrors[`lo_${index}_description`] = "Açıklama gereklidir";
      }
      if (!lo.code.trim() && lo.description.trim()) {
        newErrors[`lo_${index}_code`] = "Kod gereklidir";
      }
    });

    // Exam Settings Validation
    if (!midtermExam.examCode.trim()) {
      newErrors.midtermExamCode = "Vize sınav kodu gereklidir";
    } else if (!/^\d{2}$/.test(midtermExam.examCode.trim())) {
      newErrors.midtermExamCode = "Vize sınav kodu 2 haneli sayı olmalıdır";
    }
    if (!midtermExam.questionCount || midtermExam.questionCount < 1) {
      newErrors.midtermQuestionCount = "Vize soru sayısı en az 1 olmalıdır";
    }
    if (!midtermExam.maxScorePerQuestion || midtermExam.maxScorePerQuestion <= 0) {
      newErrors.midtermMaxScore = "Vize soru başına maksimum puan gereklidir";
    }

    if (!finalExam.examCode.trim()) {
      newErrors.finalExamCode = "Final sınav kodu gereklidir";
    } else if (!/^\d{2}$/.test(finalExam.examCode.trim())) {
      newErrors.finalExamCode = "Final sınav kodu 2 haneli sayı olmalıdır";
    }
    if (!finalExam.questionCount || finalExam.questionCount < 1) {
      newErrors.finalQuestionCount = "Final soru sayısı en az 1 olmalıdır";
    }
    if (!finalExam.maxScorePerQuestion || finalExam.maxScorePerQuestion <= 0) {
      newErrors.finalMaxScore = "Final soru başına maksimum puan gereklidir";
    }

    if (midtermExam.examCode === finalExam.examCode && midtermExam.examCode) {
      newErrors.examCodeMatch = "Vize ve Final sınav kodları farklı olmalıdır";
      newErrors.midtermExamCode = "Vize ve Final sınav kodları farklı olmalıdır";
      newErrors.finalExamCode = "Vize ve Final sınav kodları farklı olmalıdır";
    }

    // Students Validation
    if (students.length === 0) {
      newErrors.students = "En az bir öğrenci eklemelisiniz";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      toast.error("Lütfen formdaki hataları düzeltin");
      return;
    }

    setIsLoading(true);

    try {
      const validOutcomes = learningOutcomes.filter(
        (lo) => lo.code.trim() && lo.description.trim()
      );

      const payload = {
        name: name.trim(),
        code: code.trim().toUpperCase(),
        semester: semester.trim(),
        departmentId: departmentId.trim(),
        programId: programId.trim() || null,
        description: description.trim() || undefined,
        learningOutcomes: validOutcomes.map((lo) => ({
          code: lo.code.trim(),
          description: lo.description.trim(),
          programOutcomes: lo.programOutcomes || [],
        })),
        midtermExam: {
          examCode: midtermExam.examCode.trim(),
          questionCount: midtermExam.questionCount,
          maxScorePerQuestion: midtermExam.maxScorePerQuestion,
        },
        finalExam: {
          examCode: finalExam.examCode.trim(),
          questionCount: finalExam.questionCount,
          maxScorePerQuestion: finalExam.maxScorePerQuestion,
        },
        reportPassingThreshold: reportPassingThreshold === "" ? null : Math.min(100, Math.max(0, Number(reportPassingThreshold))),
        students: students.map((s) => ({
          studentNumber: s.studentNumber.trim(),
          fullName: s.fullName.trim(),
        })),
      };

      await courseApi.updateCourse(courseId, payload);

      toast.success("Ders başarıyla güncellendi");
      router.push("/dashboard/courses");
    } catch (error: any) {
      console.error("Course update error:", error);
      const errorMessage =
        error.response?.data?.message ||
        error.message ||
        "Ders güncellenemedi. Bir hata oluştu.";
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoadingCourse) {
    return (
      <div className="min-h-screen bg-background p-6 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-lg text-muted-foreground">Ders bilgileri yükleniyor...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6">
      <div className="w-full max-w-7xl mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/dashboard/courses")}
            className="px-2"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Geri
          </Button>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Ders Düzenle</h1>
            <p className="text-muted-foreground text-sm sm:text-base mt-1">
              Ders bilgilerini güncelleyin
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Section 1: Course Information */}
          <Card className="rounded-lg shadow-sm">
            <CardHeader
              className="cursor-pointer py-3"
              onClick={() => toggleSection("courseInfo")}
            >
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base sm:text-lg">1. Ders Bilgileri</CardTitle>
                  <CardDescription className="text-xs sm:text-sm mt-1">
                    Temel ders bilgilerini güncelleyin
                  </CardDescription>
                </div>
                {expandedSections.courseInfo ? (
                  <ChevronUp className="h-5 w-5" />
                ) : (
                  <ChevronDown className="h-5 w-5" />
                )}
              </div>
            </CardHeader>
            {expandedSections.courseInfo && (
              <CardContent className="space-y-4 p-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="name" className="text-sm">
                      Ders Adı <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Örn: Veri Yapıları"
                      disabled={isLoading}
                      className={cn(
                        "h-10 text-sm",
                        errors.name ? "border-destructive" : ""
                      )}
                    />
                    {errors.name && (
                      <p className="text-xs text-destructive">{errors.name}</p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="code" className="text-sm">
                      Ders Kodu <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="code"
                      value={code}
                      onChange={(e) =>
                        setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))
                      }
                      placeholder="Örn: CS201"
                      disabled={isLoading}
                      className={cn(
                        "h-10 text-sm",
                        errors.code ? "border-destructive" : ""
                      )}
                    />
                    {errors.code && (
                      <p className="text-xs text-destructive">{errors.code}</p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="department" className="text-sm">
                      Bölüm <span className="text-red-500">*</span>
                    </Label>
                    <Select
                      id="department"
                      value={departmentId}
                      onChange={(e) => setDepartmentId(e.target.value)}
                      disabled={isLoading || loadingDepartments}
                      className="h-10 text-sm"
                    >
                      <option value="">Bölüm Seçin</option>
                      {departments.map((dept) => (
                        <option key={dept._id} value={dept._id}>
                          {dept.name}
                        </option>
                      ))}
                    </Select>
                    {loadingDepartments && (
                      <p className="text-xs text-slate-500">Bölümler yükleniyor...</p>
                    )}
                    {errors.department && (
                      <p className="text-xs font-medium text-red-600 bg-red-50 p-2 rounded">{errors.department}</p>
                    )}
                  </div>

                  {departmentId && (
                    <div className="space-y-1.5">
                      <Label htmlFor="program" className="text-sm">
                        Program <span className="text-slate-400">(İsteğe Bağlı)</span>
                      </Label>
                      <Select
                        id="program"
                        value={programId}
                        onChange={(e) => setProgramId(e.target.value)}
                        disabled={isLoading || loadingPrograms}
                        className="h-10 text-sm"
                      >
                        <option value="">Program Seçin (Opsiyonel)</option>
                        {programs.map((prog: Program) => (
                          <option key={prog._id} value={prog._id}>
                            {prog.name}
                          </option>
                        ))}
                      </Select>
                      {loadingPrograms && (
                        <p className="text-xs text-slate-500">Programlar yükleniyor...</p>
                      )}
                      {programs.length === 0 && !loadingPrograms && departmentId && (
                        <p className="text-xs text-slate-500 bg-slate-50 p-2 rounded">
                          Bu bölüm için program bulunamadı.
                        </p>
                      )}
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <Label htmlFor="semester" className="text-sm">
                      Dönem
                    </Label>
                    <Input
                      id="semester"
                      value={semester}
                      onChange={(e) => setSemester(e.target.value)}
                      placeholder="Örn: Güz 2024"
                      disabled={isLoading}
                      className="h-10 text-sm"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="description" className="text-sm">
                    Açıklama
                  </Label>
                  <Textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Ders hakkında açıklama..."
                    rows={3}
                    disabled={isLoading}
                    className="text-sm"
                  />
                </div>
              </CardContent>
            )}
          </Card>

          {/* Section 2: Learning Outcomes */}
          <Card className="rounded-lg shadow-sm">
            <CardHeader
              className="cursor-pointer py-3"
              onClick={() => toggleSection("learningOutcomes")}
            >
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base sm:text-lg">2. Öğrenme Çıktıları (ÖÇ)</CardTitle>
                  <CardDescription className="text-xs sm:text-sm mt-1">
                    Dersin öğrenme çıktılarını güncelleyin
                  </CardDescription>
                </div>
                {expandedSections.learningOutcomes ? (
                  <ChevronUp className="h-5 w-5" />
                ) : (
                  <ChevronDown className="h-5 w-5" />
                )}
              </div>
            </CardHeader>
            {expandedSections.learningOutcomes && (
              <CardContent className="space-y-4 p-4">
                <OutcomeEditor
                  outcomes={learningOutcomes}
                  onChange={setLearningOutcomes}
                  departmentId={departmentId}
                  programId={programId}
                  errors={errors}
                  disabled={isLoading}
                />
              </CardContent>
            )}
          </Card>

          {/* Section 3: Exam Settings */}
          <Card className="rounded-lg shadow-sm">
            <CardHeader
              className="cursor-pointer py-3"
              onClick={() => toggleSection("examSettings")}
            >
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base sm:text-lg">3. Sınav Ayarları</CardTitle>
                  <CardDescription className="text-xs sm:text-sm mt-1">
                    Vize ve Final sınav kodlarını güncelleyin
                  </CardDescription>
                </div>
                {expandedSections.examSettings ? (
                  <ChevronUp className="h-5 w-5" />
                ) : (
                  <ChevronDown className="h-5 w-5" />
                )}
              </div>
            </CardHeader>
            {expandedSections.examSettings && (
              <CardContent className="space-y-4 p-4">
                <ExamSettingsComponent
                  midterm={midtermExam}
                  final={finalExam}
                  onMidtermChange={setMidtermExam}
                  onFinalChange={setFinalExam}
                  errors={errors}
                  disabled={isLoading}
                />
                <div className="pt-2 border-t">
                  <Label className="text-sm">Rapor geçme yüzdesi (opsiyonel)</Label>
                  <p className="text-xs text-muted-foreground mb-1">
                    Raporlarda yeşil/kırmızı eşiği. Boş bırakılırsa sınavların geçme puanları kullanılır (0–100).
                  </p>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    placeholder="Örn. 50"
                    value={reportPassingThreshold === "" ? "" : reportPassingThreshold}
                    onChange={(e) => setReportPassingThreshold(e.target.value === "" ? "" : Number(e.target.value))}
                    className="max-w-[120px]"
                  />
                </div>
              </CardContent>
            )}
          </Card>

          {/* Section 4: Student Import */}
          <Card className="rounded-lg shadow-sm">
            <CardHeader
              className="cursor-pointer py-3"
              onClick={() => toggleSection("studentImport")}
            >
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base sm:text-lg">4. Öğrenci Listesi</CardTitle>
                  <CardDescription className="text-xs sm:text-sm mt-1">
                    Öğrenci listesini güncelleyin (opsiyonel)
                  </CardDescription>
                </div>
                {expandedSections.studentImport ? (
                  <ChevronUp className="h-5 w-5" />
                ) : (
                  <ChevronDown className="h-5 w-5" />
                )}
              </div>
            </CardHeader>
            {expandedSections.studentImport && (
              <CardContent className="space-y-4 p-4">
                <StudentImporter
                  students={students}
                  onChange={setStudents}
                  errors={errors}
                  disabled={isLoading}
                />
              </CardContent>
            )}
          </Card>

          {/* Fixed Submit Button */}
          <div className="sticky bottom-0 bg-background border-t border-border p-4 -mx-4 -mb-4 shadow-lg">
            <div className="w-full max-w-7xl mx-auto flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                size="default"
                onClick={() => router.push("/dashboard/courses")}
                disabled={isLoading}
                className="h-10 text-sm px-6"
              >
                İptal
              </Button>
              <Button type="submit" disabled={isLoading} className="h-10 text-sm px-6">
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Güncelleniyor...
                  </>
                ) : (
                  "Değişiklikleri Kaydet"
                )}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(" ");
}

