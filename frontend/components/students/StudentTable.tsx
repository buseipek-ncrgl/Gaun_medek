"use client";

import Link from "next/link";
import { Edit, Trash2, Eye, CheckSquare, Square } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { type Student } from "@/lib/api/studentApi";
import { type Course } from "@/lib/api/courseApi";
import { DeleteStudentDialog } from "./DeleteStudentDialog";
import { useState } from "react";

interface StudentTableProps {
  students: Student[];
  courses?: Course[];
  onDelete?: () => void;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  onToggleSelectAll?: () => void;
}

export function StudentTable({ students, courses = [], onDelete, selectedIds = new Set(), onToggleSelect, onToggleSelectAll }: StudentTableProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const allSelected = students.length > 0 && selectedIds.size === students.length;

  const handleDeleteClick = (student: Student) => {
    setSelectedStudent(student);
    setDeleteDialogOpen(true);
  };

  const handleDeleteSuccess = () => {
    setDeleteDialogOpen(false);
    setSelectedStudent(null);
    onDelete?.();
  };

  // Get program name for a student from their courses
  const getStudentProgram = (student: Student): string | null => {
    if (!courses || courses.length === 0) return null;
    if (!student?.studentNumber) return null;
    
    // Normalize student number for comparison (trim and case-insensitive)
    const normalizedStudentNumber = String(student.studentNumber).trim().toUpperCase();
    
    // Find courses where this student is enrolled
    const studentCourses = courses.filter((course: any) => {
      const courseStudents = course.students || [];
      return courseStudents.some((cs: any) => {
        if (!cs?.studentNumber) return false;
        // Normalize course student number for comparison
        const normalizedCourseStudentNumber = String(cs.studentNumber).trim().toUpperCase();
        return normalizedCourseStudentNumber === normalizedStudentNumber;
      });
    });
    
    if (studentCourses.length === 0) return null;
    
    // Get program from first course (or find most common program)
    const firstCourse = studentCourses[0];
    const program = (firstCourse as any).program;
    
    if (!program) return null;
    
    // Handle both object and string formats
    if (typeof program === "object" && program !== null) {
      // Program object with populated data
      return program.name || program.nameEn || program.code || null;
    }
    
    // If program is just an ID string, we can't get the name without additional lookup
    // But this shouldn't happen if backend populates correctly
    if (typeof program === "string") {
      return null; // Can't determine name from just ID
    }
    
    return null;
  };

  // Get color for class level
  const getClassLevelColor = (classLevel?: number) => {
    if (!classLevel) return "bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200";
    if (classLevel === 1) return "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-blue-500/30";
    if (classLevel === 2) return "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border-green-500/30";
    if (classLevel === 3) return "bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 border-amber-500/30";
    if (classLevel === 4) return "bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 border-purple-500/30";
    return "bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200";
  };

  if (students.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg">
        <p className="text-lg font-medium">Öğrenci bulunamadı</p>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-md border border-brand-navy/20 dark:border-slate-700/50 overflow-x-auto overflow-y-visible min-w-0">
        <Table className="min-w-[640px]">
          <TableHeader>
            <TableRow className="bg-gradient-to-r from-brand-navy to-[#0f3a6b] hover:from-brand-navy hover:to-[#0f3a6b]">
              {onToggleSelectAll != null && (
                <TableHead className="text-white font-semibold w-12">
                  <button
                    type="button"
                    onClick={onToggleSelectAll}
                    className="p-1 rounded hover:bg-white/20"
                  >
                    {allSelected ? (
                      <CheckSquare className="h-5 w-5 text-white" />
                    ) : (
                      <Square className="h-5 w-5 text-white" />
                    )}
                  </button>
                </TableHead>
              )}
              <TableHead className="text-white font-semibold">Öğrenci Numarası</TableHead>
              <TableHead className="text-white font-semibold">İsim</TableHead>
              <TableHead className="text-white font-semibold">Bölüm</TableHead>
              <TableHead className="text-white font-semibold">Program</TableHead>
              <TableHead className="text-white font-semibold">Sınıf Seviyesi</TableHead>
              <TableHead className="text-right text-white font-semibold">İşlemler</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {students.map((student) => (
              <TableRow
                key={student._id}
                className="hover:bg-brand-navy/5 dark:hover:bg-slate-800/50 transition-colors"
              >
                {onToggleSelect != null && (
                  <TableCell className="w-12">
                    <button
                      type="button"
                      onClick={() => onToggleSelect(student._id)}
                      className="p-1 rounded hover:bg-brand-navy/10"
                    >
                      {selectedIds.has(student._id) ? (
                        <CheckSquare className="h-5 w-5 text-brand-navy dark:text-slate-200" />
                      ) : (
                        <Square className="h-5 w-5 text-brand-navy/50 dark:text-slate-400" />
                      )}
                    </button>
                  </TableCell>
                )}
                <TableCell className="font-medium">
                  <Badge variant="outline" className="font-mono bg-brand-navy/10 text-brand-navy border-brand-navy/30">
                    {student.studentNumber}
                  </Badge>
                </TableCell>
                <TableCell className="font-medium text-brand-navy dark:text-slate-100">
                  {student.name}
                </TableCell>
                <TableCell>
                  {student.department ? (
                    <Badge variant="outline" className="bg-brand-navy/10 text-brand-navy border-brand-navy/30 text-xs">
                      {student.department}
                    </Badge>
                  ) : (
                    <span className="text-slate-400">-</span>
                  )}
                </TableCell>
                <TableCell>
                  {getStudentProgram(student) ? (
                    <Badge variant="outline" className="bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-600 text-xs">
                      {getStudentProgram(student)}
                    </Badge>
                  ) : (
                    <span className="text-slate-400">-</span>
                  )}
                </TableCell>
                <TableCell>
                  {student.classLevel ? (
                    <Badge 
                      variant="outline" 
                      className={cn("text-xs", getClassLevelColor(student.classLevel))}
                    >
                      {student.classLevel}. Sınıf
                    </Badge>
                  ) : (
                    <span className="text-slate-400">-</span>
                  )}
                </TableCell>
                <TableCell className="text-right whitespace-nowrap">
                  <div className="flex justify-end gap-1 sm:gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      asChild
                      className="h-8 w-8 min-w-[2rem] hover:bg-brand-navy/10 hover:text-brand-navy"
                    >
                      <Link href={`/students/${student._id}`}>
                        <Eye className="h-4 w-4" />
                      </Link>
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      asChild
                      className="h-8 w-8 min-w-[2rem] hover:bg-brand-navy/10 hover:text-brand-navy"
                    >
                      <Link href={`/students/${student._id}?edit=true`}>
                        <Edit className="h-4 w-4" />
                      </Link>
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteClick(student)}
                      className="h-8 w-8 min-w-[2rem] hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {selectedStudent && (
        <DeleteStudentDialog
          studentId={selectedStudent._id}
          studentName={selectedStudent.name}
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          onSuccess={handleDeleteSuccess}
        />
      )}
    </>
  );
}
