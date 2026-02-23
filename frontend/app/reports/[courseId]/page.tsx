"use client";

export const dynamic = 'force-dynamic';

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  BookOpen,
  Users,
  FileText,
  Target,
  TrendingUp,
  BarChart3,
  GraduationCap,
  Loader2,
  ArrowLeft,
  Download,
  Printer,
  Home,
  ChevronRight,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { LOAchievementTable } from "@/components/reports/LOAchievementTable";
import { POAchievementTable } from "@/components/reports/POAchievementTable";
import { LOProgressCard } from "@/components/reports/LOProgressCard";
import { POProgressCard } from "@/components/reports/POProgressCard";
import { StudentComparisonChart } from "@/components/reports/StudentComparisonChart";
import { HeatmapChart } from "@/components/reports/HeatmapChart";
import { LOAchievementBarChart } from "@/components/reports/LOAchievementBarChart";
import { POAchievementBarChart } from "@/components/reports/POAchievementBarChart";
// import { CourseSummaryCard } from "@/components/reports/CourseSummaryCard";
import { CombinedAchievementChart } from "@/components/reports/CombinedAchievementChart";
import { courseApi, type Course } from "@/lib/api/courseApi";
import { examApi, type Exam } from "@/lib/api/examApi";
import { studentApi, type Student } from "@/lib/api/studentApi";
import {
  getLOAchievement,
  getPOAchievement,
  getStudentAchievements,
  type LOAchievement,
  type POAchievement,
} from "@/lib/api/assessmentApi";
import { type LOAchievement as ScoreLOAchievement } from "@/lib/api/scoreApi";
import { exportToPDF } from "@/lib/utils/pdfExport";

export default function CourseReportPage() {
  const params = useParams();
  const router = useRouter();
  const courseId = params.courseId as string;

  const [course, setCourse] = useState<Course | null>(null);
  const [exams, setExams] = useState<Exam[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loAchievements, setLOAchievements] = useState<LOAchievement[]>([]);
  const [poAchievements, setPOAchievements] = useState<POAchievement[]>([]);
  const [studentAchievements, setStudentAchievements] = useState<Record<string, Record<string, number>>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");

  useEffect(() => {
    if (courseId) {
      fetchReportData();
    }
  }, [courseId]);

  const fetchReportData = async () => {
    try {
      setIsLoading(true);

      // Fetch basic course data
      const [courseData, examsData] = await Promise.all([
        courseApi.getById(courseId),
        examApi.getByCourse(courseId),
      ]);

      setCourse(courseData);
      setExams(examsData);

      // Get students from course (embedded in course model)
      const courseStudents = courseData.students || [];
      const studentNumbers = courseStudents.map((s) => s.studentNumber);
      const allStudents = await studentApi.getAll();
      const relevantStudents = allStudents.filter((s) =>
        studentNumbers.includes(s.studentNumber)
      );
      setStudents(relevantStudents);

      // Fetch aggregated achievements using new assessment API
      const [loData, poData, studentAchievementsData] = await Promise.all([
        getLOAchievement(courseId),
        getPOAchievement(courseId),
        getStudentAchievements(courseId),
      ]);

      console.log('📊 ÖÇ Başarı Verileri:', loData);
      console.log('📈 PÇ Başarı Verileri:', poData);
      console.log('📚 Course Learning Outcomes (Raw):', courseData.learningOutcomes);
      console.log('📚 Course Learning Outcomes (with PÇ mappings):', courseData.learningOutcomes?.map(lo => ({
        code: lo.code,
        description: lo.description,
        programOutcomes: lo.programOutcomes || lo.relatedProgramOutcomes || [],
        hasProgramOutcomes: !!(lo.programOutcomes || lo.relatedProgramOutcomes)
      })));
      
      // ÖÇ başarı verilerindeki PÇ eşleştirmelerini kontrol et
      loData.forEach(lo => {
        const relatedPOs = (lo as any).relatedProgramOutcomes || [];
        console.log(`🔍 ÖÇ ${lo.code} -> PÇ'ler:`, relatedPOs, relatedPOs.length > 0 ? '✅' : '❌ BOŞ');
      });

      setLOAchievements(loData);
      setPOAchievements(poData);
      setStudentAchievements(studentAchievementsData);
      
      console.log('📊 Öğrenci Başarı Matrisi:', studentAchievementsData);
      console.log('📊 Öğrenci Başarı Matrisi - Öğrenci sayısı:', Object.keys(studentAchievementsData).length);
      if (Object.keys(studentAchievementsData).length > 0) {
        const firstStudent = Object.keys(studentAchievementsData)[0];
        console.log(`📊 Öğrenci Başarı Matrisi - İlk öğrenci (${firstStudent}):`, studentAchievementsData[firstStudent]);
      }
    } catch (error: any) {
      toast.error("Rapor verileri yüklenemedi");
      console.error(error);
      router.push("/reports");
    } finally {
      setIsLoading(false);
    }
  };

  // Convert student achievements from studentNumber-based to studentId-based format
  const convertStudentAchievements = (
    achievements: Record<string, Record<string, number>>,
    students: Student[],
    learningOutcomes: any[]
  ): Record<string, ScoreLOAchievement[]> => {
    const result: Record<string, ScoreLOAchievement[]> = {};
    
    students.forEach((student) => {
      const studentAchievements = achievements[student.studentNumber] || {};
      result[student._id] = learningOutcomes.map((lo) => ({
        learningOutcome: {
          _id: lo.code || lo._id || "",
          code: lo.code || "",
          description: lo.description || "",
        },
        achievedPercentage: studentAchievements[lo.code] || 0,
        totalScoreEarned: 0, // Not needed for display
        totalMaxScore: 0, // Not needed for display
      }));
    });
    
    return result;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 px-3 py-4 sm:px-4 sm:py-6 md:px-6 overflow-x-hidden">
        <div className="max-w-7xl mx-auto min-w-0">
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="text-center">
              <div className="p-4 rounded-full bg-gradient-to-br from-brand-navy/10 to-brand-navy/5 dark:from-brand-navy/20 dark:to-brand-navy/10 w-fit mx-auto mb-4">
                <Loader2 className="h-8 w-8 animate-spin text-brand-navy dark:text-slate-200" />
              </div>
              <p className="text-sm text-brand-navy/70 dark:text-slate-400">Rapor verileri yükleniyor...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!course) {
    return null;
  }

  const department = typeof course.department === 'object' && course.department !== null
    ? course.department.name
    : course.department || "Bilinmiyor";

  // Geçme puanı: ders ayarı "Rapor geçme yüzdesi" (reportPassingThreshold) varsa onu kullan, yoksa sınavların en düşük geçme puanı (yoksa 60)
  const passingThreshold =
    (typeof course.reportPassingThreshold === "number" || (course.reportPassingThreshold != null && course.reportPassingThreshold !== ""))
      ? Number(course.reportPassingThreshold)
      : exams.length > 0
        ? Math.min(...exams.map((e) => (e.passingScore != null ? Number(e.passingScore) : 60)))
        : 60;

  // Calculate statistics
  const avgLOAchievement = loAchievements.length > 0
    ? loAchievements.reduce((sum, lo) => sum + lo.achievedPercentage, 0) / loAchievements.length
    : 0;
  const avgPOAchievement = poAchievements.length > 0
    ? poAchievements.reduce((sum, po) => sum + po.achievedPercentage, 0) / poAchievements.length
    : 0;
  const loAboveThreshold = loAchievements.filter((lo) => lo.achievedPercentage >= passingThreshold).length;
  const poAboveThreshold = poAchievements.filter((po) => po.achievedPercentage >= passingThreshold).length;

  // Başarılı öğrenci: ortalaması geçme yüzdesinin üstünde olan öğrenci sayısı
  const successfulStudentCount = students.filter((s) => {
    const achievements = studentAchievements[s.studentNumber] || {};
    const values = Object.values(achievements);
    if (values.length === 0) return false;
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    return avg >= passingThreshold;
  }).length;

  const handlePrint = () => {
    window.print();
  };

  const handleExportPDF = async () => {
    try {
      toast.info('PDF oluşturuluyor, lütfen bekleyin...');
      
      // Import PDF utilities dynamically
      const { exportToPDF } = await import('@/lib/utils/pdfExport');
      
      // Create a single container with all content
      const pdfContainer = document.createElement('div');
      pdfContainer.id = 'pdf-export-all-content';
      pdfContainer.style.position = 'fixed';
      pdfContainer.style.left = '-9999px';
      pdfContainer.style.top = '0';
      pdfContainer.style.width = '210mm';
      pdfContainer.style.backgroundColor = '#ffffff';
      pdfContainer.style.padding = '20px';
      pdfContainer.style.fontFamily = 'Arial, sans-serif';
      pdfContainer.style.color = '#000000';
      document.body.appendChild(pdfContainer);
      
      // Helper function to create section title
      const createSectionTitle = (text: string) => {
        const title = document.createElement('h2');
        title.textContent = text;
        title.style.fontSize = '22px';
        title.style.fontWeight = 'bold';
        title.style.marginTop = '30px';
        title.style.marginBottom = '20px';
        title.style.color = '#0a294e';
        title.style.borderBottom = '2px solid #0a294e';
        title.style.paddingBottom = '10px';
        title.style.pageBreakBefore = 'always';
        return title;
      };
      
      // Helper function to create table
      const createTable = (headers: string[], rows: string[][]) => {
        const table = document.createElement('table');
        table.style.width = '100%';
        table.style.borderCollapse = 'collapse';
        table.style.marginBottom = '20px';
        table.style.fontSize = '12px';
        
        // Header
        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');
        headerRow.style.backgroundColor = '#0a294e';
        headerRow.style.color = '#ffffff';
        headers.forEach(header => {
          const th = document.createElement('th');
          th.textContent = header;
          th.style.padding = '10px';
          th.style.border = '1px solid #ddd';
          th.style.textAlign = 'left';
          headerRow.appendChild(th);
        });
        thead.appendChild(headerRow);
        table.appendChild(thead);
        
        // Body
        const tbody = document.createElement('tbody');
        rows.forEach((row, index) => {
          const tr = document.createElement('tr');
          tr.style.backgroundColor = index % 2 === 0 ? '#ffffff' : '#f9f9f9';
          row.forEach(cell => {
            const td = document.createElement('td');
            td.innerHTML = cell;
            td.style.padding = '10px';
            td.style.border = '1px solid #ddd';
            tr.appendChild(td);
          });
          tbody.appendChild(tr);
        });
        table.appendChild(tbody);
        
        return table;
      };
      
      // Header section
      const headerHTML = `
        <div style="margin-bottom: 30px; border-bottom: 3px solid #0a294e; padding-bottom: 15px;">
          <h1 style="font-size: 28px; font-weight: bold; color: #0a294e; margin: 0 0 5px 0;">
            ${course.code} - ${course.name}
          </h1>
          <p style="font-size: 16px; color: #666; margin: 0;">NTMYO Akreditasyon Raporu</p>
          <p style="font-size: 12px; color: #999; margin: 5px 0 0 0;">${new Date().toLocaleDateString('tr-TR')}</p>
        </div>
        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin-bottom: 30px;">
          <div style="padding: 15px; border: 1px solid #ddd; border-radius: 8px; text-align: center;">
            <p style="font-size: 12px; color: #666; margin: 0 0 5px 0;">Öğrenciler</p>
            <p style="font-size: 24px; font-weight: bold; color: #0a294e; margin: 0;">${students.length}</p>
          </div>
          <div style="padding: 15px; border: 1px solid #ddd; border-radius: 8px; text-align: center;">
            <p style="font-size: 12px; color: #666; margin: 0 0 5px 0;">Sınavlar</p>
            <p style="font-size: 24px; font-weight: bold; color: #0a294e; margin: 0;">${exams.length}</p>
          </div>
          <div style="padding: 15px; border: 1px solid #ddd; border-radius: 8px; text-align: center;">
            <p style="font-size: 12px; color: #666; margin: 0 0 5px 0;">Öğrenme Çıktıları</p>
            <p style="font-size: 24px; font-weight: bold; color: #0a294e; margin: 0;">${course.learningOutcomes?.length || 0}</p>
          </div>
          <div style="padding: 15px; border: 1px solid #ddd; border-radius: 8px; text-align: center;">
            <p style="font-size: 12px; color: #666; margin: 0 0 5px 0;">Ortalama Başarı</p>
            <p style="font-size: 24px; font-weight: bold; color: #0a294e; margin: 0;">${avgLOAchievement.toFixed(1)}%</p>
          </div>
        </div>
      `;
      pdfContainer.innerHTML = headerHTML;
      
      // 1. Genel Bakış Section
      pdfContainer.appendChild(createSectionTitle('Genel Bakış'));
      const overviewHTML = `
        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin-bottom: 20px;">
          <div style="padding: 15px; border: 1px solid #ddd; border-radius: 8px;">
            <p style="font-size: 11px; color: #666; margin: 0 0 5px 0; text-transform: uppercase;">Ders Kodu</p>
            <p style="font-size: 16px; font-weight: bold; color: #0a294e; margin: 0;">${course.code}</p>
            <p style="font-size: 10px; color: #999; margin: 5px 0 0 0;">${course.name}</p>
          </div>
          <div style="padding: 15px; border: 1px solid #ddd; border-radius: 8px;">
            <p style="font-size: 11px; color: #666; margin: 0 0 5px 0; text-transform: uppercase;">Başarılı ÖÇ</p>
            <p style="font-size: 16px; font-weight: bold; color: #0a294e; margin: 0;">${loAboveThreshold} / ${loAchievements.length}</p>
            <p style="font-size: 10px; color: #999; margin: 5px 0 0 0;">≥${passingThreshold}% eşiği</p>
          </div>
          <div style="padding: 15px; border: 1px solid #ddd; border-radius: 8px;">
            <p style="font-size: 11px; color: #666; margin: 0 0 5px 0; text-transform: uppercase;">Başarılı PÇ</p>
            <p style="font-size: 16px; font-weight: bold; color: #0a294e; margin: 0;">${poAboveThreshold} / ${poAchievements.length}</p>
            <p style="font-size: 10px; color: #999; margin: 5px 0 0 0;">≥${passingThreshold}% eşiği</p>
          </div>
          <div style="padding: 15px; border: 1px solid #ddd; border-radius: 8px;">
            <p style="font-size: 11px; color: #666; margin: 0 0 5px 0; text-transform: uppercase;">PÇ Ortalama</p>
            <p style="font-size: 16px; font-weight: bold; color: #0a294e; margin: 0;">${avgPOAchievement.toFixed(1)}%</p>
            <p style="font-size: 10px; color: #999; margin: 5px 0 0 0;">Ortalama başarı</p>
          </div>
        </div>
      `;
      pdfContainer.insertAdjacentHTML('beforeend', overviewHTML);
      
      // 2. ÖÇ Analizi Section - Yorum satırına alındı
      /* if (loAchievements.length > 0) {
        pdfContainer.appendChild(createSectionTitle('ÖÇ Analizi'));
        
        const loTableHeaders = ['ÖÇ Kodu', 'Açıklama', 'Öğrenci Sayısı', 'Toplam Max Puan', 'Ortalama Başarı %'];
        const loTableRows = loAchievements.map(lo => {
          const percentage = Math.round(lo.achievedPercentage * 100) / 100;
          const color = percentage >= passingThreshold ? '#22c55e' : '#ef4444';
          return [
            `<strong>${lo.code}</strong>`,
            lo.description || '-',
            lo.studentCount?.toString() || '0',
            lo.totalMaxScore?.toFixed(1) || '0.0',
            `<span style="color: ${color}; font-weight: bold;">${percentage.toFixed(1)}%</span>`
          ];
        });
        pdfContainer.appendChild(createTable(loTableHeaders, loTableRows));
      } */
      
      // 3. PÇ Analizi Section - Yorum satırına alındı
      /* if (poAchievements.length > 0) {
        pdfContainer.appendChild(createSectionTitle('PÇ Analizi'));
        
        const poTableHeaders = ['PÇ Kodu', 'Açıklama', 'Katkıda Bulunan ÖÇ', 'Ortalama Başarı %'];
        const poTableRows = poAchievements.map(po => {
          const percentage = Math.round(po.achievedPercentage * 100) / 100;
          const color = percentage >= passingThreshold ? '#22c55e' : '#ef4444';
          return [
            `<strong>${po.code}</strong>`,
            `Program Çıktısı ${po.code}`,
            po.contributingLOCount?.toString() || '0',
            `<span style="color: ${color}; font-weight: bold;">${percentage.toFixed(1)}%</span>`
          ];
        });
        pdfContainer.appendChild(createTable(poTableHeaders, poTableRows));
      } */
      
      // 4. Öğrenci Karşılaştırması Section
      if (students.length > 0 && course.learningOutcomes && course.learningOutcomes.length > 0) {
        pdfContainer.appendChild(createSectionTitle('Öğrenci Karşılaştırması'));
        
        const learningOutcomes = course.learningOutcomes;
        const studentTableHeaders = ['Öğrenci No', 'Öğrenci Adı', ...(learningOutcomes.map(lo => lo.code))];
        const studentTableRows = students.map(student => {
          const achievements = studentAchievements[student.studentNumber] || {};
          const row = [
            student.studentNumber,
            student.name
          ];
          learningOutcomes.forEach(lo => {
            const percentage = achievements[lo.code] || 0;
            const color = percentage >= passingThreshold ? '#22c55e' : '#ef4444';
            row.push(`<span style="color: ${color};">${percentage.toFixed(1)}%</span>`);
          });
          return row;
        });
        pdfContainer.appendChild(createTable(studentTableHeaders, studentTableRows));
      }
      
      // 5. Heatmap Section - Yorum satırına alındı
      /* if (students.length > 0 && course.learningOutcomes && course.learningOutcomes.length > 0) {
        pdfContainer.appendChild(createSectionTitle('Öğrenci-ÖÇ Başarı Heatmap'));
        
        const learningOutcomes = course.learningOutcomes;
        const heatmapTableHeaders = ['Öğrenci', ...(learningOutcomes.map(lo => lo.code))];
        const heatmapTableRows = students.map(student => {
          const achievements = studentAchievements[student.studentNumber] || {};
          const row = [student.studentNumber];
          learningOutcomes.forEach(lo => {
            const percentage = achievements[lo.code] || 0;
            const intensity = Math.min(100, Math.max(0, percentage));
            const red = intensity < passingThreshold ? 255 : Math.round(255 - ((intensity - passingThreshold) * (255 / (100 - passingThreshold))));
            const green = intensity >= passingThreshold ? 255 : Math.round(intensity * (255 / passingThreshold));
            const bgColor = `rgb(${red}, ${green}, 0)`;
            const textColor = intensity > passingThreshold ? '#ffffff' : '#000000';
            row.push(`<div style="background-color: ${bgColor}; color: ${textColor}; padding: 5px; text-align: center; border-radius: 4px; font-weight: bold;">${percentage.toFixed(1)}%</div>`);
          });
          return row;
        });
        pdfContainer.appendChild(createTable(heatmapTableHeaders, heatmapTableRows));
      } */
      
      // Wait for rendering
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Export
      const filename = `NTMYO_Raporu_${course.code}_${new Date().toISOString().split('T')[0]}`;
      await exportToPDF('pdf-export-all-content', filename, {
        format: 'a4',
        orientation: 'portrait',
        margin: 15,
        quality: 1.0,
      });
      
      // Cleanup
      document.body.removeChild(pdfContainer);
      
      toast.success('PDF başarıyla oluşturuldu');
    } catch (error: any) {
      console.error('PDF export error:', error);
      toast.error(error?.message || 'PDF oluşturulurken hata oluştu');
      
      // Cleanup on error
      const container = document.getElementById('pdf-export-all-content');
      if (container) {
        document.body.removeChild(container);
      }
    }
  };

  return (
    <div id="report-content" className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 px-3 py-4 sm:px-4 sm:py-6 md:px-6 overflow-x-hidden">
      <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6 min-w-0">
        {/* Breadcrumb */}
        <div className="flex flex-wrap items-center gap-1 sm:gap-2 text-xs sm:text-sm text-slate-600 dark:text-slate-400 min-w-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/reports")}
            className="h-7 px-2 text-xs hover:text-brand-navy flex-shrink-0"
          >
            <Home className="h-3 w-3 mr-1" />
            Raporlar
          </Button>
          <ChevronRight className="h-4 w-4 flex-shrink-0" />
          <span className="text-brand-navy dark:text-slate-200 font-medium truncate">{course.code}</span>
        </div>

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
          <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
            <div className="w-1 h-7 sm:h-8 bg-gradient-to-b from-brand-navy to-brand-navy/60 rounded-full flex-shrink-0"></div>
            <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
              <div className="p-2 rounded-lg bg-gradient-to-br from-brand-navy/10 to-brand-navy/5 dark:from-brand-navy/20 dark:to-brand-navy/10 flex-shrink-0">
                <BarChart3 className="h-5 w-5 text-brand-navy dark:text-slate-200" />
              </div>
              <div className="flex-1 min-w-0">
                <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-brand-navy dark:text-slate-100 truncate">
                  {course.code} - {course.name}
                </h1>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-0.5 sm:mt-1">
                  NTMYO Akreditasyon Raporu
                </p>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 flex-shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportPDF}
              className="h-9 px-3 text-sm border-brand-navy/20 hover:border-brand-navy/50"
            >
              <Download className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">PDF</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrint}
              className="h-9 px-3 text-sm border-brand-navy/20 hover:border-brand-navy/50"
            >
              <Printer className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Yazdır</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push("/reports")}
              className="h-9 px-3 text-sm"
            >
              <ArrowLeft className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Geri</span>
            </Button>
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
          <Card className="group relative overflow-hidden border border-brand-navy/20 dark:border-slate-700/50 rounded-xl p-3 sm:p-5 bg-gradient-to-br from-white to-slate-50/50 dark:from-slate-800 dark:to-slate-800/50 hover:border-brand-navy/50 hover:shadow-lg transition-all duration-300 sm:hover:-translate-y-1">
            <div className="absolute inset-0 bg-gradient-to-b from-[#0a294e] via-[#0f3a6b] to-[#051d35] opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            <div className="relative flex items-center gap-2 sm:gap-4">
              <div className="p-2 sm:p-3 bg-gradient-to-br from-brand-navy/15 to-brand-navy/5 dark:from-brand-navy/25 dark:to-brand-navy/15 group-hover:from-white/20 group-hover:to-white/10 rounded-xl transition-all duration-300 flex-shrink-0">
                <Users className="h-5 w-5 sm:h-6 sm:w-6 text-brand-navy dark:text-slate-200 group-hover:text-white transition-colors" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] sm:text-xs font-semibold text-brand-navy/70 dark:text-slate-400 group-hover:text-white/80 uppercase tracking-wide transition-colors mb-0.5 sm:mb-1">Öğrenciler</p>
                <p className="text-xl sm:text-3xl font-bold text-brand-navy dark:text-slate-100 group-hover:text-white transition-colors">
                  {students.length}
                </p>
              </div>
            </div>
          </Card>

          <Card className="group relative overflow-hidden border border-brand-navy/20 dark:border-slate-700/50 rounded-xl p-3 sm:p-5 bg-gradient-to-br from-white to-slate-50/50 dark:from-slate-800 dark:to-slate-800/50 hover:border-brand-navy/50 hover:shadow-lg transition-all duration-300 sm:hover:-translate-y-1">
            <div className="absolute inset-0 bg-gradient-to-b from-[#0a294e] via-[#0f3a6b] to-[#051d35] opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            <div className="relative flex items-center gap-2 sm:gap-4">
              <div className="p-2 sm:p-3 bg-gradient-to-br from-brand-navy/15 to-brand-navy/5 dark:from-brand-navy/25 dark:to-brand-navy/15 group-hover:from-white/20 group-hover:to-white/10 rounded-xl transition-all duration-300 flex-shrink-0">
                <CheckCircle2 className="h-5 w-5 sm:h-6 sm:w-6 text-green-600 dark:text-green-400 group-hover:text-white transition-colors" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] sm:text-xs font-semibold text-brand-navy/70 dark:text-slate-400 group-hover:text-white/80 uppercase tracking-wide transition-colors mb-0.5 sm:mb-1">Başarılı Öğrenci</p>
                <p className="text-xl sm:text-3xl font-bold text-brand-navy dark:text-slate-100 group-hover:text-white transition-colors">
                  {successfulStudentCount}
                  {students.length > 0 && (
                    <span className="text-sm font-normal text-muted-foreground ml-1">
                      ({((successfulStudentCount / students.length) * 100).toFixed(0)}%)
                    </span>
                  )}
                </p>
              </div>
            </div>
          </Card>

          <Card className="group relative overflow-hidden border border-brand-navy/20 dark:border-slate-700/50 rounded-xl p-3 sm:p-5 bg-gradient-to-br from-white to-slate-50/50 dark:from-slate-800 dark:to-slate-800/50 hover:border-brand-navy/50 hover:shadow-lg transition-all duration-300 sm:hover:-translate-y-1">
            <div className="absolute inset-0 bg-gradient-to-b from-[#0a294e] via-[#0f3a6b] to-[#051d35] opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            <div className="relative flex items-center gap-2 sm:gap-4">
              <div className="p-2 sm:p-3 bg-gradient-to-br from-brand-navy/15 to-brand-navy/5 dark:from-brand-navy/25 dark:to-brand-navy/15 group-hover:from-white/20 group-hover:to-white/10 rounded-xl transition-all duration-300 flex-shrink-0">
                <FileText className="h-5 w-5 sm:h-6 sm:w-6 text-brand-navy dark:text-slate-200 group-hover:text-white transition-colors" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] sm:text-xs font-semibold text-brand-navy/70 dark:text-slate-400 group-hover:text-white/80 uppercase tracking-wide transition-colors mb-0.5 sm:mb-1">Sınavlar</p>
                <p className="text-xl sm:text-3xl font-bold text-brand-navy dark:text-slate-100 group-hover:text-white transition-colors">
                  {exams.length}
                </p>
              </div>
            </div>
          </Card>

          <Card className="group relative overflow-hidden border border-brand-navy/20 dark:border-slate-700/50 rounded-xl p-3 sm:p-5 bg-gradient-to-br from-white to-slate-50/50 dark:from-slate-800 dark:to-slate-800/50 hover:border-brand-navy/50 hover:shadow-lg transition-all duration-300 sm:hover:-translate-y-1">
            <div className="absolute inset-0 bg-gradient-to-b from-[#0a294e] via-[#0f3a6b] to-[#051d35] opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            <div className="relative flex items-center gap-2 sm:gap-4">
              <div className="p-2 sm:p-3 bg-gradient-to-br from-brand-navy/15 to-brand-navy/5 dark:from-brand-navy/25 dark:to-brand-navy/15 group-hover:from-white/20 group-hover:to-white/10 rounded-xl transition-all duration-300 flex-shrink-0">
                <Target className="h-5 w-5 sm:h-6 sm:w-6 text-brand-navy dark:text-slate-200 group-hover:text-white transition-colors" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] sm:text-xs font-semibold text-brand-navy/70 dark:text-slate-400 group-hover:text-white/80 uppercase tracking-wide transition-colors mb-0.5 sm:mb-1">ÖÇ</p>
                <p className="text-xl sm:text-3xl font-bold text-brand-navy dark:text-slate-100 group-hover:text-white transition-colors">
                  {course.learningOutcomes?.length || 0}
                </p>
              </div>
            </div>
          </Card>

          <Card className="group relative overflow-hidden border border-brand-navy/20 dark:border-slate-700/50 rounded-xl p-3 sm:p-5 bg-gradient-to-br from-white to-slate-50/50 dark:from-slate-800 dark:to-slate-800/50 hover:border-brand-navy/50 hover:shadow-lg transition-all duration-300 sm:hover:-translate-y-1 col-span-2 lg:col-span-1">
            <div className="absolute inset-0 bg-gradient-to-b from-[#0a294e] via-[#0f3a6b] to-[#051d35] opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            <div className="relative flex items-center gap-2 sm:gap-4">
              <div className="p-2 sm:p-3 bg-gradient-to-br from-brand-navy/15 to-brand-navy/5 dark:from-brand-navy/25 dark:to-brand-navy/15 group-hover:from-white/20 group-hover:to-white/10 rounded-xl transition-all duration-300 flex-shrink-0">
                <TrendingUp className="h-5 w-5 sm:h-6 sm:w-6 text-brand-navy dark:text-slate-200 group-hover:text-white transition-colors" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] sm:text-xs font-semibold text-brand-navy/70 dark:text-slate-400 group-hover:text-white/80 uppercase tracking-wide transition-colors mb-0.5 sm:mb-1">Ort. Başarı</p>
                <p className="text-xl sm:text-3xl font-bold text-brand-navy dark:text-slate-100 group-hover:text-white transition-colors">
                  {avgLOAchievement.toFixed(1)}%
                </p>
              </div>
            </div>
          </Card>
        </div>

        {/* Course Summary Card - Yorum satırına alındı */}
        {/* <CourseSummaryCard
          loAchievements={loAchievements}
          poAchievements={poAchievements}
          course={course}
        /> */}

        {/* Genel Başarı Özeti - ÖÇ ve PÇ Grafiği */}
        {(loAchievements.length > 0 || poAchievements.length > 0) && (
          <div className="min-w-0 overflow-x-auto">
            <CombinedAchievementChart
              loAchievements={loAchievements}
              poAchievements={poAchievements}
              passingThreshold={passingThreshold}
            />
          </div>
        )}

        {/* Tabs Navigation */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full min-w-0">
          <TabsList className="grid w-full grid-cols-2 h-auto bg-slate-100/50 dark:bg-slate-800/50 p-1 rounded-lg gap-1">
            <TabsTrigger
              value="overview"
              className={`${
                activeTab === "overview"
                  ? "!bg-gradient-to-r !from-brand-navy !to-[#0f3a6b] !text-white !shadow-lg"
                  : "text-brand-navy dark:text-slate-300 hover:bg-brand-navy/10 !bg-transparent"
              } transition-all`}
            >
              <BarChart3 className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Genel Bakış</span>
              <span className="sm:hidden">Genel</span>
            </TabsTrigger>
            {/* ÖÇ Analizi Tab - Yorum satırına alındı */}
            {/* <TabsTrigger
              value="lo"
              className={`${
                activeTab === "lo"
                  ? "!bg-gradient-to-r !from-brand-navy !to-[#0f3a6b] !text-white !shadow-lg"
                  : "text-brand-navy dark:text-slate-300 hover:bg-brand-navy/10 !bg-transparent"
              } transition-all`}
            >
              <Target className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">ÖÇ Analizi</span>
              <span className="sm:hidden">ÖÇ</span>
            </TabsTrigger> */}
            {/* PÇ Analizi Tab - Yorum satırına alındı */}
            {/* <TabsTrigger
              value="po"
              className={`${
                activeTab === "po"
                  ? "!bg-gradient-to-r !from-brand-navy !to-[#0f3a6b] !text-white !shadow-lg"
                  : "text-brand-navy dark:text-slate-300 hover:bg-brand-navy/10 !bg-transparent"
              } transition-all`}
            >
              <GraduationCap className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">PÇ Analizi</span>
              <span className="sm:hidden">PÇ</span>
            </TabsTrigger> */}
            <TabsTrigger
              value="students"
              className={`${
                activeTab === "students"
                  ? "!bg-gradient-to-r !from-brand-navy !to-[#0f3a6b] !text-white !shadow-lg"
                  : "text-brand-navy dark:text-slate-300 hover:bg-brand-navy/10 !bg-transparent"
              } transition-all`}
            >
              <Users className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Öğrenci Karşılaştırması</span>
              <span className="sm:hidden">Öğrenci</span>
            </TabsTrigger>
            {/* Heatmap Tab - Yorum satırına alındı */}
            {/* <TabsTrigger
              value="heatmap"
              className={`${
                activeTab === "heatmap"
                  ? "!bg-gradient-to-r !from-brand-navy !to-[#0f3a6b] !text-white !shadow-lg"
                  : "text-brand-navy dark:text-slate-300 hover:bg-brand-navy/10 !bg-transparent"
              } transition-all`}
            >
              <BarChart3 className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Heatmap</span>
              <span className="sm:hidden">Map</span>
            </TabsTrigger> */}
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-4 sm:space-y-6 mt-4 min-w-0">
            {/* Course Info Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <Card className="group relative overflow-hidden border border-brand-navy/20 dark:border-slate-700/50 rounded-xl p-4 sm:p-5 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm shadow-modern hover:border-brand-navy/50 hover:shadow-lg transition-all duration-300">
                <div className="flex items-center gap-2 sm:gap-4">
                  <div className="p-2 sm:p-3 bg-gradient-to-br from-brand-navy/10 to-brand-navy/5 dark:from-brand-navy/20 dark:to-brand-navy/10 rounded-xl flex-shrink-0">
                    <BookOpen className="h-5 w-5 sm:h-6 sm:w-6 text-brand-navy dark:text-slate-200" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] sm:text-xs font-semibold text-brand-navy/70 dark:text-slate-400 uppercase tracking-wide mb-0.5 sm:mb-1">Ders Kodu</p>
                    <p className="text-base sm:text-lg font-bold text-brand-navy dark:text-slate-100 truncate">{course.code}</p>
                    <p className="text-xs text-slate-600 dark:text-slate-400 truncate mt-1">{course.name}</p>
                  </div>
                </div>
              </Card>

              <Card className="group relative overflow-hidden border border-brand-navy/20 dark:border-slate-700/50 rounded-xl p-4 sm:p-5 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm shadow-modern hover:border-brand-navy/50 hover:shadow-lg transition-all duration-300">
                <div className="flex items-center gap-2 sm:gap-4">
                  <div className="p-2 sm:p-3 bg-gradient-to-br from-brand-navy/10 to-brand-navy/5 dark:from-brand-navy/20 dark:to-brand-navy/10 rounded-xl flex-shrink-0">
                    <Users className="h-5 w-5 sm:h-6 sm:w-6 text-brand-navy dark:text-slate-200" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] sm:text-xs font-semibold text-brand-navy/70 dark:text-slate-400 uppercase tracking-wide mb-0.5 sm:mb-1">Öğrenci Sayısı</p>
                    <p className="text-base sm:text-lg font-bold text-brand-navy dark:text-slate-100">
                      {students.length}
                    </p>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">Toplam öğrenci</p>
                  </div>
                </div>
              </Card>

              <Card className="group relative overflow-hidden border border-brand-navy/20 dark:border-slate-700/50 rounded-xl p-4 sm:p-5 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm shadow-modern hover:border-brand-navy/50 hover:shadow-lg transition-all duration-300">
                <div className="flex items-center gap-2 sm:gap-4">
                  <div className="p-2 sm:p-3 bg-gradient-to-br from-brand-navy/10 to-brand-navy/5 dark:from-brand-navy/20 dark:to-brand-navy/10 rounded-xl flex-shrink-0">
                    <FileText className="h-5 w-5 sm:h-6 sm:w-6 text-brand-navy dark:text-slate-200" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] sm:text-xs font-semibold text-brand-navy/70 dark:text-slate-400 uppercase tracking-wide mb-0.5 sm:mb-1">Sınav Sayısı</p>
                    <p className="text-base sm:text-lg font-bold text-brand-navy dark:text-slate-100">
                      {exams.length}
                    </p>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">Toplam sınav</p>
                  </div>
                </div>
              </Card>

              <Card className="group relative overflow-hidden border border-brand-navy/20 dark:border-slate-700/50 rounded-xl p-4 sm:p-5 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm shadow-modern hover:border-brand-navy/50 hover:shadow-lg transition-all duration-300">
                <div className="flex items-center gap-2 sm:gap-4">
                  <div className="p-2 sm:p-3 bg-gradient-to-br from-brand-navy/10 to-brand-navy/5 dark:from-brand-navy/20 dark:to-brand-navy/10 rounded-xl flex-shrink-0">
                    <TrendingUp className="h-5 w-5 sm:h-6 sm:w-6 text-brand-navy dark:text-slate-200" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] sm:text-xs font-semibold text-brand-navy/70 dark:text-slate-400 uppercase tracking-wide mb-0.5 sm:mb-1">Genel Ortalama</p>
                    <p className="text-base sm:text-lg font-bold text-brand-navy dark:text-slate-100">
                      {((avgLOAchievement + avgPOAchievement) / 2).toFixed(1)}%
                    </p>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">Ortalama başarı</p>
                  </div>
                </div>
              </Card>
            </div>
          </TabsContent>

          {/* LO Analysis Tab - Yorum satırına alındı */}
          {/* 
          <TabsContent value="lo" className="space-y-4 sm:space-y-6 mt-4">
            {loAchievements.length > 0 && (
              <LOAchievementBarChart achievements={loAchievements} passingThreshold={passingThreshold} />
            )}
            <Card className="border border-brand-navy/20 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm shadow-modern rounded-xl">
              <CardHeader className="bg-gradient-to-r from-brand-navy to-[#0f3a6b] text-white rounded-t-xl">
                <CardTitle className="flex items-center gap-2 text-xl">
                  <TrendingUp className="h-5 w-5" />
                  Öğrenme Çıktıları (ÖÇ) Başarı Detayları
                </CardTitle>
                <CardDescription className="text-white/80 text-sm">
                  Her öğrenme çıktısı için tüm öğrenciler üzerinden ortalama başarı yüzdeleri
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6">
                {loAchievements.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="p-4 rounded-full bg-gradient-to-br from-brand-navy/10 to-brand-navy/5 dark:from-brand-navy/20 dark:to-brand-navy/10 w-fit mx-auto mb-4">
                      <Target className="h-8 w-8 text-brand-navy/60 dark:text-slate-400" />
                    </div>
                    <p className="text-lg font-semibold text-brand-navy dark:text-slate-100">Henüz öğrenme çıktısı başarı verisi yok</p>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">Sınav puanları eklendikten sonra burada görünecektir</p>
                  </div>
                ) : (
                  <LOAchievementTable achievements={loAchievements} passingThreshold={passingThreshold} />
                )}
              </CardContent>
            </Card>
            {loAchievements.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-1 h-8 bg-gradient-to-b from-brand-navy to-brand-navy/60 rounded-full"></div>
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-gradient-to-br from-brand-navy/10 to-brand-navy/5 dark:from-brand-navy/20 dark:to-brand-navy/10">
                      <Target className="h-5 w-5 text-brand-navy dark:text-slate-200" />
                    </div>
                    <div>
                      <h2 className="text-xl sm:text-2xl font-bold text-brand-navy dark:text-slate-100">ÖÇ Başarı Özeti</h2>
                      <p className="text-sm text-slate-600 dark:text-slate-400">Öğrenme çıktıları başarılarının görsel gösterimi</p>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {loAchievements.map((achievement) => (
                    <LOProgressCard key={achievement.code} achievement={achievement} passingThreshold={passingThreshold} />
                  ))}
                </div>
              </div>
            )}
          </TabsContent>
          */}

          {/* PO Analysis Tab - Yorum satırına alındı */}
          {/* 
          <TabsContent value="po" className="space-y-4 sm:space-y-6 mt-4">
            {poAchievements.length > 0 && (
              <POAchievementBarChart achievements={poAchievements} passingThreshold={passingThreshold} />
            )}
            <Card className="border border-brand-navy/20 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm shadow-modern rounded-xl">
              <CardHeader className="bg-gradient-to-r from-brand-navy to-[#0f3a6b] text-white rounded-t-xl">
                <CardTitle className="flex items-center gap-2 text-xl">
                  <BarChart3 className="h-5 w-5" />
                  Program Çıktıları (PÇ) Başarı Detayları
                </CardTitle>
                <CardDescription className="text-white/80 text-sm">
                  Her program çıktısı için ortalama başarı yüzdeleri
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6">
                {poAchievements.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="p-4 rounded-full bg-gradient-to-br from-brand-navy/10 to-brand-navy/5 dark:from-brand-navy/20 dark:to-brand-navy/10 w-fit mx-auto mb-4">
                      <GraduationCap className="h-8 w-8 text-brand-navy/60 dark:text-slate-400" />
                    </div>
                    <p className="text-lg font-semibold text-brand-navy dark:text-slate-100">Henüz program çıktısı başarı verisi yok</p>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">Öğrenme çıktıları ve sınav puanları eklendikten sonra burada görünecektir</p>
                  </div>
                ) : (
                  <POAchievementTable achievements={poAchievements} passingThreshold={passingThreshold} />
                )}
              </CardContent>
            </Card>
            {poAchievements.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-1 h-8 bg-gradient-to-b from-brand-navy to-brand-navy/60 rounded-full"></div>
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-gradient-to-br from-brand-navy/10 to-brand-navy/5 dark:from-brand-navy/20 dark:to-brand-navy/10">
                      <GraduationCap className="h-5 w-5 text-brand-navy dark:text-slate-200" />
                    </div>
                    <div>
                      <h2 className="text-xl sm:text-2xl font-bold text-brand-navy dark:text-slate-100">PÇ Başarı Özeti</h2>
                      <p className="text-sm text-slate-600 dark:text-slate-400">Program çıktıları başarılarının görsel gösterimi</p>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {poAchievements.map((achievement) => (
                    <POProgressCard key={achievement.code} achievement={achievement} passingThreshold={passingThreshold} />
                  ))}
                </div>
              </div>
            )}
          </TabsContent>
          */}

          {/* Student Comparison Tab */}
          <TabsContent value="students" className="space-y-4 sm:space-y-6 mt-4 min-w-0">
            {students.length > 0 && loAchievements.length > 0 && course.learningOutcomes ? (
              <div className="space-y-4 min-w-0 overflow-x-auto">
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className="w-1 h-7 sm:h-8 bg-gradient-to-b from-brand-navy to-brand-navy/60 rounded-full flex-shrink-0"></div>
                  <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                    <div className="p-2 rounded-lg bg-gradient-to-br from-brand-navy/10 to-brand-navy/5 dark:from-brand-navy/20 dark:to-brand-navy/10 flex-shrink-0">
                      <Users className="h-5 w-5 text-brand-navy dark:text-slate-200" />
                    </div>
                    <div className="min-w-0">
                      <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-brand-navy dark:text-slate-100">Öğrenci Karşılaştırması</h2>
                      <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">Öğrencilerin ÖÇ başarılarının karşılaştırmalı analizi</p>
                    </div>
                  </div>
                </div>
                <StudentComparisonChart
                  students={students}
                  studentAchievements={convertStudentAchievements(studentAchievements, students, course.learningOutcomes)}
                  passingThreshold={passingThreshold}
                />
              </div>
            ) : (
              <Card className="border border-brand-navy/20 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm shadow-modern rounded-xl">
                <CardContent className="p-6 sm:p-12 text-center">
                  <div className="p-3 sm:p-4 rounded-full bg-gradient-to-br from-brand-navy/10 to-brand-navy/5 dark:from-brand-navy/20 dark:to-brand-navy/10 w-fit mx-auto mb-4">
                    <Users className="h-6 w-6 sm:h-8 sm:w-8 text-brand-navy/60 dark:text-slate-400" />
                  </div>
                  <p className="text-base sm:text-lg font-semibold text-brand-navy dark:text-slate-100">Öğrenci karşılaştırma verisi yok</p>
                  <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-2">Öğrenci ve sınav verileri eklendikten sonra burada görünecektir</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Heatmap Tab - Yorum satırına alındı */}
          {/* 
          <TabsContent value="heatmap" className="space-y-4 sm:space-y-6 mt-4">
            {students.length > 0 && course.learningOutcomes && course.learningOutcomes.length > 0 ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-1 h-8 bg-gradient-to-b from-brand-navy to-brand-navy/60 rounded-full"></div>
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-gradient-to-br from-brand-navy/10 to-brand-navy/5 dark:from-brand-navy/20 dark:to-brand-navy/10">
                      <BarChart3 className="h-5 w-5 text-brand-navy dark:text-slate-200" />
                    </div>
                    <div>
                      <h2 className="text-xl sm:text-2xl font-bold text-brand-navy dark:text-slate-100">Öğrenci-ÖÇ Başarı Heatmap</h2>
                      <p className="text-sm text-slate-600 dark:text-slate-400">Öğrencilerin ÖÇ başarılarının görsel haritası</p>
                    </div>
                  </div>
                </div>
                <HeatmapChart
                  students={students}
                  learningOutcomes={course.learningOutcomes.map((lo) => ({
                    _id: lo.code,
                    code: lo.code,
                  }))}
                  studentAchievements={convertStudentAchievements(studentAchievements, students, course.learningOutcomes)}
                  passingThreshold={passingThreshold}
                />
              </div>
            ) : (
              <Card className="border border-brand-navy/20 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm shadow-modern rounded-xl">
                <CardContent className="p-12 text-center">
                  <div className="p-4 rounded-full bg-gradient-to-br from-brand-navy/10 to-brand-navy/5 dark:from-brand-navy/20 dark:to-brand-navy/10 w-fit mx-auto mb-4">
                    <BarChart3 className="h-8 w-8 text-brand-navy/60 dark:text-slate-400" />
                  </div>
                  <p className="text-lg font-semibold text-brand-navy dark:text-slate-100">Heatmap verisi yok</p>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">Öğrenci ve ÖÇ verileri eklendikten sonra burada görünecektir</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
          */}
        </Tabs>

      </div>
    </div>
  );
}

