"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { 
  ChevronRight, 
  ChevronLeft, 
  Check, 
  FileText, 
  Settings, 
  Target, 
  Eye,
  Loader2 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  examApi,
  type CreateExamDto,
  type Exam,
} from "@/lib/api/examApi";
import { courseApi, type Course } from "@/lib/api/courseApi";
import { departmentApi, type Department } from "@/lib/api/departmentApi";
import { programApi, type Program } from "@/lib/api/programApi";

interface ExamCreationWizardProps {
  onSuccess?: () => void;
}

type QuestionRow = {
  questionNumber: number;
  learningOutcomeCode: string;
};

type WizardStep = 1 | 2 | 3 | 4;

export function ExamCreationWizard({ onSuccess }: ExamCreationWizardProps) {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<WizardStep>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form data
  const [courses, setCourses] = useState<Course[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState("");
  const [selectedProgramId, setSelectedProgramId] = useState("");
  const [loadingPrograms, setLoadingPrograms] = useState(false);
  const [courseId, setCourseId] = useState("");
  const [examType, setExamType] = useState<"midterm" | "final">("midterm");
  const [examCode, setExamCode] = useState("");
  const [maxScore, setMaxScore] = useState<number>(100);
  const [selectedLOs, setSelectedLOs] = useState<string[]>([]); // Sınav bazlı ÖÇ seçimi
  const [existingExams, setExistingExams] = useState<Exam[]>([]);
  const [examCodeError, setExamCodeError] = useState("");

  const loadDepartments = async () => {
    try {
      const data = await departmentApi.getAll();
      setDepartments(data);
    } catch (error) {
      console.error("Bölümler yüklenemedi:", error);
    }
  };

  const loadPrograms = async (deptId: string) => {
    try {
      setLoadingPrograms(true);
      console.log("🔍 [Exams Wizard] Loading programs for department:", deptId);
      const data = await programApi.getAll(deptId);
      console.log("📦 [Exams Wizard] Programs received:", data);
      setPrograms(data || []);
      console.log(`✅ [Exams Wizard] ${data?.length || 0} program(s) loaded`);
    } catch (error: any) {
      console.error("❌ [Exams Wizard] Programlar yüklenemedi:", error);
      console.error("Error details:", error.response?.data || error.message);
      setPrograms([]);
    } finally {
      setLoadingPrograms(false);
    }
  };

  const loadCoursesByProgram = async (programId: string) => {
    try {
      const allCourses = await courseApi.getAll();
      const programCourses = allCourses.filter((course: any) => {
        const progId = typeof course.program === "object" && course.program !== null
          ? (course.program as any)._id
          : course.program;
        return progId === programId;
      });
      setCourses(programCourses);
      // Reset course selection if selected course is not in new list
      if (courseId && !programCourses.find((c: any) => c._id === courseId)) {
        setCourseId("");
      }
    } catch (error) {
      toast.error("Dersler yüklenemedi");
    }
  };

  const loadCoursesByDepartment = async (departmentId: string) => {
    try {
      const allCourses = await courseApi.getAll();
      const deptCourses = allCourses.filter((course: any) => {
        const deptId = typeof course.department === "object" && course.department !== null
          ? (course.department as any)._id
          : course.department;
        return deptId === departmentId;
      });
      setCourses(deptCourses);
      // Reset course selection if selected course is not in new list
      if (courseId && !deptCourses.find((c: any) => c._id === courseId)) {
        setCourseId("");
      }
    } catch (error) {
      toast.error("Dersler yüklenemedi");
    }
  };

  const fetchCourses = async () => {
    try {
      const data = await courseApi.getAll();
      setCourses(data);
    } catch (error) {
      toast.error("Dersler yüklenemedi");
    }
  };

  useEffect(() => {
    fetchCourses();
    loadDepartments();
  }, []);

  useEffect(() => {
    if (selectedDepartmentId) {
      loadPrograms(selectedDepartmentId);
    } else {
      setPrograms([]);
      setSelectedProgramId("");
    }
  }, [selectedDepartmentId]);

  useEffect(() => {
    if (selectedProgramId) {
      loadCoursesByProgram(selectedProgramId);
    } else {
      // If no program selected, show all courses or courses filtered by department
      if (selectedDepartmentId) {
        loadCoursesByDepartment(selectedDepartmentId);
      } else {
        fetchCourses();
      }
    }
  }, [selectedProgramId, selectedDepartmentId]);

  useEffect(() => {
    if (courseId) {
      checkExamCode();
    } else {
      setExamCodeError("");
      setExistingExams([]);
    }
  }, [courseId, examCode]);

  const checkExamCode = async () => {
    if (!courseId || !examCode.trim()) {
      setExamCodeError("");
      return;
    }

    try {
      const courseExams = await examApi.getByCourse(courseId);
      setExistingExams(courseExams);
      const duplicate = courseExams.find(
        (exam) => exam.examCode.trim().toLowerCase() === examCode.trim().toLowerCase()
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

  // Soru bazlı işlem kaldırıldı - artık genel puan kullanılıyor

  const selectedCourse = useMemo(
    () => courses.find((c) => c._id === courseId),
    [courses, courseId]
  );

  const learningOutcomeOptions =
    selectedCourse?.learningOutcomes?.map((lo) => ({
      code: lo.code,
      label: `${lo.code} – ${lo.description}`,
      description: lo.description,
    })) || [];

  // Soru bazlı ÖÇ eşleme kaldırıldı - artık genel puan kullanılıyor

  const validateStep = (step: WizardStep): boolean => {
    switch (step) {
      case 1:
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
        return true;
      case 2:
        if (!maxScore || maxScore <= 0) {
          toast.error("Maksimum puan 1 veya daha büyük olmalıdır");
          return false;
        }
        return true;
      case 3:
        // Sınav bazlı ÖÇ seçimi - en az bir ÖÇ seçilmeli
        if (!selectedLOs || selectedLOs.length === 0) {
          toast.error("En az bir öğrenme çıktısı (ÖÇ) seçmelisiniz");
          return false;
        }
        return true;
      default:
        return true;
    }
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      if (currentStep < 4) {
        setCurrentStep((prev) => (prev + 1) as WizardStep);
      }
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => (prev - 1) as WizardStep);
    }
  };

  const handleSubmit = async () => {
    if (!validateStep(4)) return;
    setIsSubmitting(true);
    try {
      const payload: CreateExamDto = {
        courseId,
        examType,
        examCode: examCode.trim(),
        maxScore: Number(maxScore),
        learningOutcomes: selectedLOs, // Sınav bazlı ÖÇ eşleme
      };

      await examApi.create(payload);
      toast.success("Sınav başarıyla oluşturuldu");
      
      // Dispatch event to notify other components (e.g., courses page)
      window.dispatchEvent(new CustomEvent('examCreated', { 
        detail: { courseId, examType: examType } 
      }));
      
      onSuccess?.();
      router.push("/exams");
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

  const progress = (currentStep / 4) * 100; // 4 adım: Ders Seçimi, Puan Ayarları, ÖÇ Eşleme, Özet

  // Özet hesaplamaları
  const totalMaxScore = maxScore;

  return (
    <div className="space-y-6">
      {/* Progress Bar */}
      <Card className="border-2 border-[#0a294e]/20">
        <CardContent className="p-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Sınav Oluşturma Sihirbazı</h3>
              <span className="text-sm text-muted-foreground">
                Adım {currentStep} / 3
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
              <div
                className="bg-[#0a294e] h-3 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className={currentStep >= 1 ? "font-semibold text-[#0a294e]" : "text-muted-foreground"}>
                1. Ders Bilgileri
              </span>
              <span className={currentStep >= 2 ? "font-semibold text-[#0a294e]" : "text-muted-foreground"}>
                2. Soru Ayarları
              </span>
              <span className={currentStep >= 3 ? "font-semibold text-[#0a294e]" : "text-muted-foreground"}>
                3. ÖÇ Eşleme
              </span>
              <span className={currentStep >= 4 ? "font-semibold text-[#0a294e]" : "text-muted-foreground"}>
                4. Özet
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Step 1: Ders ve Sınav Bilgileri */}
      {currentStep === 1 && (
        <Card className="border-2 border-[#0a294e]/20">
          <CardHeader>
            <div className="flex items-center gap-3">
              <FileText className="h-6 w-6 text-[#0a294e]" />
              <div>
                <CardTitle className="text-2xl">Ders ve Sınav Bilgileri</CardTitle>
                <CardDescription className="text-base mt-1">
                  Sınav için ders ve temel bilgileri girin
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Department and Program Filters */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="departmentId" className="text-base">
                  Bölüm
                </Label>
                <Select
                  id="departmentId"
                  value={selectedDepartmentId}
                  onChange={(e) => {
                    setSelectedDepartmentId(e.target.value);
                    setSelectedProgramId("");
                    setCourseId("");
                  }}
                  className="h-12 text-base"
                >
                  <option value="">Tüm Bölümler</option>
                  {departments.map((dept) => (
                    <option key={dept._id} value={dept._id}>
                      {dept.name}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="programId" className="text-base">
                  Program
                </Label>
                <Select
                  id="programId"
                  value={selectedProgramId}
                  onChange={(e) => {
                    setSelectedProgramId(e.target.value);
                    setCourseId("");
                  }}
                  disabled={!selectedDepartmentId || loadingPrograms}
                  className="h-12 text-base"
                >
                  <option value="">
                    {!selectedDepartmentId 
                      ? "Önce bölüm seçin" 
                      : loadingPrograms
                      ? "Yükleniyor..."
                      : "Tüm Programlar"}
                  </option>
                  {programs.map((prog) => (
                    <option key={prog._id} value={prog._id}>
                      {prog.name} {prog.code ? `(${prog.code})` : ""}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="courseId" className="text-base">
                  Ders <span className="text-red-500">*</span>
                </Label>
                <Select
                  id="courseId"
                  value={courseId}
                  onChange={(e) => setCourseId(e.target.value)}
                  disabled={!!(selectedProgramId && courses.length === 0)}
                  className="h-12 text-base"
                >
                  <option value="">
                    {selectedProgramId && courses.length === 0
                      ? "Bu program için ders bulunamadı"
                      : selectedProgramId
                      ? "Ders seçin"
                      : "Önce program seçin veya ders seçin"}
                  </option>
                  {courses.map((course) => (
                    <option key={course._id} value={course._id}>
                      {course.code} - {course.name}
                    </option>
                  ))}
                </Select>
                {selectedCourse && (
                  <p className="text-sm text-muted-foreground mt-2">
                    {selectedCourse.learningOutcomes?.length || 0} öğrenme çıktısı tanımlı
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="examType" className="text-base">
                  Sınav Türü <span className="text-red-500">*</span>
                </Label>
                <Select
                  id="examType"
                  value={examType}
                  onChange={(e) => setExamType(e.target.value as "midterm" | "final")}
                  className="h-12 text-base"
                >
                  <option value="midterm">Vize</option>
                  <option value="final">Final</option>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="examCode" className="text-base">
                Sınav Kodu <span className="text-red-500">*</span>
              </Label>
              <Input
                id="examCode"
                value={examCode}
                onChange={(e) => setExamCode(e.target.value)}
                placeholder="Örn: VIZE-2025-1, FINAL-2025-1"
                className="h-12 text-base"
              />
              <p className="text-sm text-muted-foreground">
                Sınav kodunu benzersiz bir şekilde tanımlayın
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Soru Ayarları */}
      {currentStep === 2 && (
        <Card className="border-2 border-[#0a294e]/20">
          <CardHeader>
            <div className="flex items-center gap-3">
              <Settings className="h-6 w-6 text-[#0a294e]" />
              <div>
                <CardTitle className="text-2xl">Soru Ayarları</CardTitle>
                <CardDescription className="text-base mt-1">
                  Sınav için soru sayısı ve puanlama ayarlarını yapın
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 gap-6">
              <div className="space-y-2">
                <Label htmlFor="maxScore" className="text-base">
                  Maksimum Puan <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="maxScore"
                  type="number"
                  min={1}
                  value={maxScore}
                  onChange={(e) => setMaxScore(Number(e.target.value))}
                  className="h-12 text-base text-lg"
                />
                <p className="text-sm text-muted-foreground">
                  Sınav için maksimum toplam puan
                </p>
              </div>
            </div>

            {maxScore > 0 && (
              <Card className="bg-slate-50 border-slate-200">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">Toplam Maksimum Puan</p>
                      <p className="text-3xl font-bold text-[#0a294e]">{totalMaxScore}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-slate-700">
                        Maksimum Puan
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 3: Sınav Bazlı ÖÇ Eşleme */}
      {currentStep === 3 && (
        <Card className="border-2 border-[#0a294e]/20">
          <CardHeader>
            <div className="flex items-center gap-3">
              <Target className="h-6 w-6 text-[#0a294e]" />
              <div>
                <CardTitle className="text-2xl">Sınav → ÖÇ Eşleme</CardTitle>
                <CardDescription className="text-base mt-1">
                  Bu sınavın hangi öğrenme çıktılarına (ÖÇ) eşleneceğini seçin
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {learningOutcomeOptions.length === 0 ? (
              <Card className="border-yellow-200 bg-yellow-50">
                <CardContent className="p-6 text-center">
                  <p className="text-muted-foreground">
                    Bu ders için henüz öğrenme çıktısı tanımlanmamış. 
                    Lütfen önce dersi düzenleyip öğrenme çıktıları ekleyin.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <>
                <div className="grid gap-3">
                  {learningOutcomeOptions.map((lo) => {
                    const isSelected = selectedLOs.includes(lo.code);
                    return (
                      <Card
                        key={lo.code}
                        className={`border-2 transition-colors cursor-pointer ${
                          isSelected
                            ? "border-green-500 bg-green-50/50"
                            : "border-gray-200 bg-white hover:border-gray-300"
                        }`}
                        onClick={() => {
                          if (isSelected) {
                            setSelectedLOs(selectedLOs.filter((code) => code !== lo.code));
                          } else {
                            setSelectedLOs([...selectedLOs, lo.code]);
                          }
                        }}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-center gap-4">
                            <div className="flex-shrink-0">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => {}}
                                className="w-5 h-5 text-green-600 border-gray-300 rounded focus:ring-green-500"
                              />
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <Badge
                                  variant={isSelected ? "default" : "outline"}
                                  className={isSelected ? "bg-green-600" : ""}
                                >
                                  {lo.code}
                                </Badge>
                                <p className="font-semibold text-slate-900">{lo.description}</p>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>

                {/* Seçilen ÖÇ Özeti */}
                {selectedLOs.length > 0 && (
                  <Card className="bg-slate-50 border-slate-200">
                    <CardHeader>
                      <CardTitle className="text-lg">Seçilen Öğrenme Çıktıları</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-wrap gap-2">
                        {selectedLOs.map((loCode) => {
                          const lo = learningOutcomeOptions.find((opt) => opt.code === loCode);
                          return (
                            <Badge
                              key={loCode}
                              variant="outline"
                              className="bg-white text-slate-700 border-slate-300"
                            >
                              {loCode}
                            </Badge>
                          );
                        })}
                      </div>
                      <p className="text-sm text-muted-foreground mt-2">
                        {selectedLOs.length} öğrenme çıktısı seçildi
                      </p>
                    </CardContent>
                  </Card>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 4: Özet */}
      {currentStep === 4 && (
        <Card className="border-2 border-[#0a294e]/20">
          <CardHeader>
            <div className="flex items-center gap-3">
              <Eye className="h-6 w-6 text-[#0a294e]" />
              <div>
                <CardTitle className="text-2xl">Özet ve Onay</CardTitle>
                <CardDescription className="text-base mt-1">
                  Sınav bilgilerini kontrol edin ve onaylayın
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Ders Bilgileri */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="bg-slate-50 border-slate-200">
                <CardHeader>
                  <CardTitle className="text-lg">Ders Bilgileri</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div>
                    <p className="text-sm text-muted-foreground">Ders</p>
                    <p className="font-semibold">
                      {selectedCourse?.code} - {selectedCourse?.name}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Sınav Türü</p>
                    <Badge variant="outline">
                      {examType === "midterm" ? "Vize" : "Final"}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Sınav Kodu</p>
                    <p className="font-semibold">{examCode}</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-green-50 border-green-200">
                <CardHeader>
                  <CardTitle className="text-lg">Puan Ayarları</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div>
                    <p className="text-sm text-muted-foreground">Maksimum Puan</p>
                    <p className="text-2xl font-bold text-green-600">{maxScore}</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* ÖÇ Eşleme Özeti */}
            {selectedLOs.length > 0 && (
              <Card className="bg-slate-50 border-slate-200">
                <CardHeader>
                  <CardTitle className="text-lg">ÖÇ Eşleme Özeti</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">
                      {selectedLOs.length} öğrenme çıktısı eşlendi
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {selectedLOs.map((loCode) => {
                        const lo = learningOutcomeOptions.find((opt) => opt.code === loCode);
                        return (
                          <Badge
                            key={loCode}
                            variant="outline"
                            className="bg-white text-slate-700 border-slate-300"
                          >
                            {loCode}
                          </Badge>
                        );
                      })}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </CardContent>
        </Card>
      )}

      {/* Navigation Buttons */}
      <div className="flex items-center justify-between">
        <Button
          type="button"
          variant="outline"
          onClick={handleBack}
          disabled={currentStep === 1 || isSubmitting}
          className="h-12 px-6"
        >
          <ChevronLeft className="h-4 w-4 mr-2" />
          Geri
        </Button>

        {currentStep < 4 ? (
          <Button
            type="button"
            onClick={handleNext}
            disabled={isSubmitting}
            className="h-12 px-6 bg-[#0a294e] hover:bg-[#0a294e]/90"
          >
            İleri
            <ChevronRight className="h-4 w-4 ml-2" />
          </Button>
        ) : (
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="h-12 px-6 bg-green-600 hover:bg-green-700"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Oluşturuluyor...
              </>
            ) : (
              <>
                <Check className="h-4 w-4 mr-2" />
                Sınavı Oluştur
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}

