"use client";

import { useState } from "react";
import { Upload, Plus, Trash2, FileText, Download, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";

export interface Student {
  studentNumber: string;
  fullName: string;
}

interface StudentImporterProps {
  students: Student[];
  onChange: (students: Student[]) => void;
  errors?: Record<string, string>;
  disabled?: boolean;
}

export function StudentImporter({
  students,
  onChange,
  errors = {},
  disabled = false,
}: StudentImporterProps) {
  const [manualStudentNumber, setManualStudentNumber] = useState("");
  const [manualFullName, setManualFullName] = useState("");

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isExcel = /\.(xlsx?|xls)$/i.test(file.name);

    try {
      let parsedStudents: Student[] = [];

      if (isExcel) {
        // XLS / XLSX: xlsx kütüphanesi ile oku – 1. sütun öğrenci no, 2. sütun ad soyad
        try {
          const XLSX = await import("xlsx");
          const arrayBuffer = await file.arrayBuffer();
          const workbook = XLSX.read(arrayBuffer, { type: "array" });
          const firstSheetName = workbook.SheetNames[0];
          const sheet = workbook.Sheets[firstSheetName];
          const rows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, defval: "" }) as (string | number)[][];
          const seenNumbers = new Set<string>();
          for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            if (!row || row.length < 1) continue;
            const rawFirst = row[0];
            const rawSecond = row[1];
            const studentNumber = String(rawFirst ?? "").trim();
            const fullName = rawSecond != null ? String(rawSecond).trim() : "";
            if (!studentNumber) continue;
            if (seenNumbers.has(studentNumber)) continue;
            seenNumbers.add(studentNumber);
            parsedStudents.push({
              studentNumber,
              fullName: fullName || `Öğrenci ${studentNumber}`,
            });
          }
        } catch (excelError) {
          console.error("Excel parsing error:", excelError);
          toast.error("Excel dosyası okunamadı. Lütfen xlsx paketinin yüklü olduğundan emin olun: npm install xlsx");
          return;
        }
      } else {
        // TXT, CSV, DOCX
        let text = "";
        if (file.name.endsWith(".docx") || file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
          try {
            const mammoth = await import("mammoth");
            const arrayBuffer = await file.arrayBuffer();
            const result = await mammoth.extractRawText({ arrayBuffer });
            text = result.value;
          } catch (docxError) {
            console.error("DOCX parsing error:", docxError);
            toast.error("DOCX dosyası okunamadı. Lütfen mammoth paketinin yüklü olduğundan emin olun: npm install mammoth");
            return;
          }
        } else {
          text = await file.text();
        }
        const lines = text.split(/\r?\n/).filter((line) => line.trim());
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          const parts = trimmed.split(/\s+/);
          if (parts.length >= 2) {
            const studentNumber = parts[0];
            const fullName = parts.slice(1).join(" ");
            if (studentNumber && fullName) {
              parsedStudents.push({ studentNumber, fullName });
            }
          }
        }
      }

      if (parsedStudents.length > 0) {
        const existingNumbers = new Set(students.map((s) => s.studentNumber));
        const newStudents = parsedStudents.filter(
          (s) => !existingNumbers.has(s.studentNumber)
        );
        onChange([...students, ...newStudents]);
        if (newStudents.length > 0) {
          toast.success(`${newStudents.length} öğrenci eklendi`);
        } else {
          toast.info("Tüm öğrenciler zaten listede.");
        }
      } else {
        toast.error("Dosyadan öğrenci bulunamadı");
      }
    } catch (error) {
      console.error("File parsing error:", error);
      toast.error("Dosya okunamadı. Lütfen dosya formatını kontrol edin.");
    }
    e.target.value = "";
  };

  const addManualStudent = () => {
    if (!manualStudentNumber.trim() || !manualFullName.trim()) {
      toast.error("Öğrenci numarası ve ad soyad gereklidir");
      return;
    }

    // Check for duplicates
    if (students.some((s) => s.studentNumber === manualStudentNumber.trim())) {
      toast.error("Bu öğrenci numarası zaten eklenmiş");
      return;
    }

    onChange([
      ...students,
      {
        studentNumber: manualStudentNumber.trim(),
        fullName: manualFullName.trim(),
      },
    ]);

    setManualStudentNumber("");
    setManualFullName("");
    toast.success("Öğrenci eklendi");
  };

  const removeStudent = (index: number) => {
    onChange(students.filter((_, i) => i !== index));
  };

  const downloadTemplate = () => {
    const templateContent = `20231021 Ahmet Yılmaz
20231022 Ayşe Demir
20231023 Mehmet Kaya
20231024 Zeynep Şahin
20231025 Ali Öz`;

    const blob = new Blob([templateContent], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "ogrenci_listesi_template.txt";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success("Şablon dosyası indirildi");
  };

  return (
    <div className="space-y-4">
      {errors.students && (
        <p className="text-sm text-destructive font-medium">{errors.students}</p>
      )}

      {/* File Upload */}
      <Card className="rounded-lg shadow-sm border">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Dosyadan Yükle</CardTitle>
              <CardDescription className="text-xs">
                Öğrenci listesini içeren dosyayı yükleyin (.xls, .xlsx, .docx, .txt, .csv)
              </CardDescription>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={downloadTemplate}
              disabled={disabled}
              className="h-9 px-3 text-xs"
            >
              <Download className="h-3 w-3 mr-1" />
              Şablon
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-4">
          <div className="border-2 border-dashed rounded-lg p-4 text-center hover:border-primary/50 transition-colors">
            <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
            <Label
              htmlFor="student-file"
              className="cursor-pointer text-sm font-semibold text-primary hover:underline"
            >
              Öğrenci Listesini Yükle (.xls, .xlsx, .docx, .txt, .csv)
            </Label>
            <Input
              id="student-file"
              type="file"
              accept=".xls,.xlsx,.docx,.txt,.csv"
              onChange={handleFileUpload}
              disabled={disabled}
              className="hidden"
            />
            <div className="mt-3 p-2 bg-[#0a294e]/5 rounded border border-[#0a294e]/10">
              <div className="flex items-start gap-2 text-xs text-[#0a294e]">
                <Info className="h-3 w-3 mt-0.5 flex-shrink-0" />
                <div className="text-left">
                  <p className="font-semibold mb-0.5">Format:</p>
                  <p><strong>Excel (.xls, .xlsx):</strong> İlk sütun öğrenci no, ikinci sütun ad soyad.</p>
                  <p><strong>TXT/CSV/DOCX:</strong> Her satırda &quot;ÖğrenciNo Ad Soyad&quot; (örn: 20231021 Ahmet Yılmaz).</p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Manual Add */}
      <Card className="rounded-lg shadow-sm border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Manuel Ekle</CardTitle>
          <CardDescription className="text-xs">
            Öğrenci bilgilerini manuel olarak girin
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="manual-student-number" className="text-sm">
                Öğrenci No <span className="text-destructive">*</span>
              </Label>
              <Input
                id="manual-student-number"
                value={manualStudentNumber}
                onChange={(e) => setManualStudentNumber(e.target.value)}
                placeholder="20231021"
                disabled={disabled}
                className="h-10 text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="manual-full-name" className="text-sm">
                Ad Soyad <span className="text-destructive">*</span>
              </Label>
              <Input
                id="manual-full-name"
                value={manualFullName}
                onChange={(e) => setManualFullName(e.target.value)}
                placeholder="Ahmet Yılmaz"
                disabled={disabled}
                className="h-10 text-sm"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addManualStudent();
                  }
                }}
              />
            </div>

            <div className="flex items-end">
              <Button
                type="button"
                onClick={addManualStudent}
                disabled={disabled}
                className="w-full h-10 text-sm"
              >
                <Plus className="h-4 w-4 mr-1" />
                Ekle
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Students Preview Table */}
      {students.length > 0 && (
        <Card className="rounded-lg shadow-sm border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              Öğrenci Listesi ({students.length} öğrenci)
            </CardTitle>
            <CardDescription className="text-xs">
              Eklenen öğrencilerin listesi
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4">
            <div className="rounded-md border overflow-hidden max-h-[200px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="text-sm font-semibold">Öğrenci No</TableHead>
                    <TableHead className="text-sm font-semibold">Ad Soyad</TableHead>
                    <TableHead className="text-sm font-semibold text-right">İşlem</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {students.map((student, index) => (
                    <TableRow key={index}>
                      <TableCell className="text-sm font-medium">
                        {student.studentNumber}
                      </TableCell>
                      <TableCell className="text-sm">{student.fullName}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeStudent(index)}
                          disabled={disabled}
                          className="h-8 w-8"
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

