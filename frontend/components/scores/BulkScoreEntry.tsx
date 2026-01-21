"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Save, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { examApi, type Exam } from "@/lib/api/examApi";
import { courseApi, type Course } from "@/lib/api/courseApi";
import { studentApi, type Student } from "@/lib/api/studentApi";
import { studentExamResultApi } from "@/lib/api/studentExamResultApi";

interface BulkScoreEntryProps {
  examId: string;
  onUpdate?: () => void;
}

type StudentScores = Record<string, number | "">; // studentId -> totalScore

export function BulkScoreEntry({ examId, onUpdate }: BulkScoreEntryProps) {
  const [exam, setExam] = useState<Exam | null>(null);
  const [course, setCourse] = useState<Course | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [scores, setScores] = useState<StudentScores>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (examId) {
      loadData();
    }
  }, [examId]);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const examData = await examApi.getById(examId);
      setExam(examData);

      // Load course and students
      const courseId = typeof examData.courseId === 'string' 
        ? examData.courseId 
        : (examData.courseId as any)?._id || String(examData.courseId);
      const courseData = await courseApi.getById(courseId);
      setCourse(courseData);

      // Get students from course
      const courseStudents = courseData.students || [];
      const studentNumbers = courseStudents.map((s) => s.studentNumber);
      const allStudents = await studentApi.getAll();
      const relevantStudents = allStudents
        .filter((s) => studentNumbers.includes(s.studentNumber))
        .sort((a, b) => a.studentNumber.localeCompare(b.studentNumber));
      setStudents(relevantStudents);

      // Load existing scores from StudentExamResult
      const existingResults = await studentExamResultApi.getByExam(examId);
      const scoreMap: StudentScores = {};
      
      relevantStudents.forEach((student) => {
        const existingResult = existingResults.find(
          (r) => r.studentNumber === student.studentNumber
        );
        scoreMap[student._id] = existingResult?.totalScore ?? "";
      });

      setScores(scoreMap);
    } catch (error: any) {
      toast.error("Veriler yüklenirken hata oluştu");
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleScoreChange = (studentId: string, value: string) => {
    setHasChanges(true);
    setScores((prev) => {
      const newScores = { ...prev };
      const numValue = value === "" ? "" : parseFloat(value);
      newScores[studentId] =
        numValue === "" ? "" : isNaN(numValue as number) ? "" : numValue;
      return newScores;
    });
  };

  const getMaxScore = (): number => {
    if (!exam) return 0;
    return exam.maxScore || 0; // Genel maksimum puan (soru bazlı değil)
  };

  const validateScores = (): boolean => {
    const maxScore = getMaxScore();
    for (const studentId of Object.keys(scores)) {
      const score = scores[studentId];
      if (score !== "") {
        const numScore = score as number;
        if (numScore < 0 || numScore > maxScore) {
          toast.error(
            `Geçersiz puan: Maksimum ${maxScore} olabilir`
          );
          return false;
        }
      }
    }
    return true;
  };

  const handleSave = async () => {
    if (!validateScores() || !exam) return;

    setIsSaving(true);
    let successCount = 0;
    let errorCount = 0;

    try {
      const maxScore = getMaxScore();
      const savePromises: Promise<void>[] = [];

      for (const studentId of Object.keys(scores)) {
        const score = scores[studentId];
        if (score !== "") {
          const student = students.find((s) => s._id === studentId);
          if (!student) continue;

          const totalScore = score as number;
          const percentage = maxScore > 0 ? (totalScore / maxScore) * 100 : 0;

          const savePromise = studentExamResultApi
            .createOrUpdate({
              studentNumber: student.studentNumber,
              examId,
              courseId: typeof exam.courseId === 'string' 
                ? exam.courseId 
                : (exam.courseId as any)?._id || String(exam.courseId),
              totalScore,
              maxScore,
              percentage: Math.round(percentage * 100) / 100,
              outcomePerformance: {},
              programOutcomePerformance: {},
            })
            .then(() => {
              successCount++;
            })
            .catch((error) => {
              errorCount++;
              console.error("Puan kaydedilemedi:", error);
            });
          savePromises.push(savePromise);
        }
      }

      await Promise.all(savePromises);

      if (errorCount === 0) {
        toast.success(`${successCount} öğrenci puanı başarıyla kaydedildi`);
        setHasChanges(false);
        onUpdate?.();
      } else {
        toast.warning(
          `${successCount} puan kaydedildi, ${errorCount} puan kaydedilemedi`
        );
      }
    } catch (error: any) {
      toast.error("Puanlar kaydedilirken hata oluştu");
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-[#0a294e] mx-auto mb-4" />
          <p className="text-lg text-muted-foreground">Veriler yükleniyor...</p>
        </CardContent>
      </Card>
    );
  }

  if (!exam || students.length === 0) {
    return (
      <Card className="border-yellow-200">
        <CardContent className="p-8 text-center">
          <p className="text-lg text-muted-foreground">
            Bu sınav için öğrenci bulunamadı.
          </p>
        </CardContent>
      </Card>
    );
  }

  const maxScore = getMaxScore();

  return (
    <Card className="border-2 border-[#0a294e]/20">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-2xl">Genel Puan Girişi</CardTitle>
            <CardDescription className="text-base mt-1">
              {students.length} öğrenci için genel puan girişi (Maksimum: {maxScore} puan)
            </CardDescription>
          </div>
          <Button
            onClick={handleSave}
            disabled={!hasChanges || isSaving}
            className="h-11 px-5 bg-green-600 hover:bg-green-700"
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Kaydediliyor...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Tümünü Kaydet
              </>
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table className="border-2 border-gray-200">
            <TableHeader>
              <TableRow className="bg-[#0a294e] text-white">
                <TableHead className="text-white font-semibold min-w-[200px]">
                  Öğrenci
                </TableHead>
                <TableHead className="text-center font-semibold min-w-[150px]">
                  Genel Puan
                </TableHead>
                <TableHead className="text-center font-semibold min-w-[120px]">
                  Yüzde
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {students.map((student) => {
                const score = scores[student._id] || "";
                const numScore = typeof score === "number" ? score : 0;
                const percentage = maxScore > 0 ? (numScore / maxScore) * 100 : 0;
                const isValid =
                  score === "" ||
                  (typeof score === "number" &&
                    score >= 0 &&
                    score <= maxScore);

                return (
                  <TableRow key={student._id} className="hover:bg-gray-50">
                    <TableCell className="font-semibold">
                      <div>
                        <p className="font-semibold">{student.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {student.studentNumber}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="p-2">
                      <Input
                        type="number"
                        step="0.1"
                        min="0"
                        max={maxScore}
                        value={score}
                        onChange={(e) =>
                          handleScoreChange(student._id, e.target.value)
                        }
                        className={`h-10 text-center text-sm ${
                          isValid
                            ? "border-gray-300"
                            : "border-red-500 bg-red-50"
                        }`}
                        placeholder="0"
                      />
                    </TableCell>
                    <TableCell className="text-center font-semibold">
                      <div>
                        <p
                          className={`text-lg ${
                            percentage > 0 ? "text-green-600" : "text-gray-400"
                          }`}
                        >
                          {percentage > 0 ? `${percentage.toFixed(1)}%` : "-"}
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
        <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <p className="text-sm text-blue-800">
            <strong>Kullanım:</strong> Her öğrenci için sınavdan aldığı genel toplam puanı girin.
            Maksimum puan: {maxScore}. Değişiklikleri kaydetmek için "Tümünü Kaydet" butonuna tıklayın.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
