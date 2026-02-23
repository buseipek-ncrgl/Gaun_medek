"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import {
  FormItem,
  FormLabel,
} from "@/components/ui/form";
import {
  studentApi,
  type Student,
  type CreateStudentDto,
  type UpdateStudentDto,
} from "@/lib/api/studentApi";
import { departmentApi, type Department } from "@/lib/api/departmentApi";
import { programApi, type Program } from "@/lib/api/programApi";
import { courseApi, type Course } from "@/lib/api/courseApi";

const studentSchema = z.object({
  studentNumber: z.string().min(1, "Öğrenci numarası gereklidir"),
  name: z.string().min(1, "İsim gereklidir").min(2, "İsim en az 2 karakter olmalıdır"),
  department: z.string().optional(),
  program: z.string().optional(),
  course: z.string().optional(),
  classLevel: z.number().int().positive().max(4, "Sınıf seviyesi 1-4 arasında olmalıdır").optional().or(z.literal("")),
});

type StudentFormData = z.infer<typeof studentSchema>;

interface StudentFormProps {
  mode: "create" | "edit";
  studentId?: string;
  initialData?: Student;
  /** Edit modunda çağrılır; güncel öğrenci verisi ile ekranın yansıması için kullanılır. */
  onSuccess?: (updatedStudent?: Student) => void;
}

export function StudentForm({
  mode,
  studentId,
  initialData,
  onSuccess,
}: StudentFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState("");
  const [selectedProgramId, setSelectedProgramId] = useState("");
  const [loadingDepartments, setLoadingDepartments] = useState(false);
  const [loadingPrograms, setLoadingPrograms] = useState(false);

  const loadDepartments = async () => {
    try {
      setLoadingDepartments(true);
      const data = await departmentApi.getAll();
      setDepartments(data);
    } catch (error: any) {
      console.error("Bölümler yüklenemedi:", error);
    } finally {
      setLoadingDepartments(false);
    }
  };

  const loadPrograms = async (deptId: string) => {
    try {
      setLoadingPrograms(true);
      const data = await programApi.getAll(deptId);
      setPrograms(data || []);
    } catch (error: any) {
      console.error("Programlar yüklenemedi:", error);
      setPrograms([]);
    } finally {
      setLoadingPrograms(false);
    }
  };

  useEffect(() => {
    loadDepartments();
  }, []);

  const form = useForm<StudentFormData>({
    resolver: zodResolver(studentSchema),
    defaultValues: initialData
      ? {
          studentNumber: initialData.studentNumber,
          name: initialData.name,
          department: initialData.department || "",
          program: "",
          course: "",
          classLevel: initialData.classLevel || "",
        }
      : {
          studentNumber: "",
          name: "",
          department: "",
          program: "",
          course: "",
          classLevel: "",
        },
  });

  const selectedDepartment = form.watch("department");
  const selectedProgram = form.watch("program");

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
      const currentCourseId = form.getValues("course");
      if (currentCourseId && !programCourses.find((c: any) => c._id === currentCourseId)) {
        form.setValue("course", "");
      }
    } catch (error: any) {
      console.error("Dersler yüklenemedi:", error);
    }
  };

  useEffect(() => {
    if (selectedDepartment) {
      // Find department ID from name
      const department = departments.find(d => d.name === selectedDepartment);
      if (department) {
        setSelectedDepartmentId(department._id);
        loadPrograms(department._id);
      }
    } else {
      setSelectedDepartmentId("");
      setPrograms([]);
      setSelectedProgramId("");
      form.setValue("program", "");
      form.setValue("course", "");
    }
  }, [selectedDepartment, departments]);

  useEffect(() => {
    if (selectedProgram && selectedDepartmentId) {
      setSelectedProgramId(selectedProgram);
      loadCoursesByProgram(selectedProgram);
    } else {
      setSelectedProgramId("");
      setCourses([]);
      form.setValue("course", "");
    }
  }, [selectedProgram, selectedDepartmentId]);

  const onSubmit = async (data: StudentFormData) => {
    setIsSubmitting(true);
    try {
      const submitData: CreateStudentDto | UpdateStudentDto = {
        name: data.name,
        department: data.department || undefined,
        classLevel: typeof data.classLevel === "number" ? data.classLevel : undefined,
      };

      if (mode === "create") {
        await studentApi.create({
          ...submitData,
          studentNumber: data.studentNumber,
        } as CreateStudentDto);
        toast.success("Öğrenci başarıyla eklendi");
        router.push("/students");
      } else if (mode === "edit" && studentId) {
        const updated = await studentApi.update(studentId, submitData as UpdateStudentDto);
        toast.success("Öğrenci başarıyla güncellendi");
        if (onSuccess) {
          onSuccess(updated);
        } else {
          router.push("/students");
        }
      } else {
        onSuccess?.();
      }
    } catch (error: any) {
      const msg = error.response?.data?.message || "";
      const errorMessage =
        msg && /already exists|zaten var/i.test(msg)
          ? "Bu öğrenci numarası zaten kayıtlı. Farklı bir numara girin."
          : msg || "Öğrenci kaydedilemedi. Bir hata oluştu.";
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Öğrenci Numarası */}
        <FormItem>
          <FormLabel htmlFor="studentNumber" className="text-sm font-semibold text-slate-700">
            Öğrenci Numarası <span className="text-red-500">*</span>
          </FormLabel>
          <Input
            id="studentNumber"
            {...form.register("studentNumber")}
            placeholder="Örn: 2021001234"
            disabled={isSubmitting || mode === "edit"}
            className="h-10 text-sm border-2 focus:border-[#0a294e]"
          />
          {form.formState.errors.studentNumber && (
            <p className="text-sm font-medium text-destructive mt-1">
              {form.formState.errors.studentNumber.message}
            </p>
          )}
        </FormItem>

        {/* İsim */}
        <FormItem>
          <FormLabel htmlFor="name" className="text-sm font-semibold text-slate-700">
            Ad Soyad <span className="text-red-500">*</span>
          </FormLabel>
          <Input
            id="name"
            {...form.register("name")}
            placeholder="Örn: Ahmet Yılmaz"
            disabled={isSubmitting}
            className="h-10 text-sm border-2 focus:border-[#0a294e]"
          />
          {form.formState.errors.name && (
            <p className="text-sm font-medium text-destructive mt-1">
              {form.formState.errors.name.message}
            </p>
          )}
        </FormItem>

        {/* Bölüm */}
        <FormItem>
          <FormLabel htmlFor="department" className="text-sm font-semibold text-slate-700">
            Bölüm
          </FormLabel>
          {loadingDepartments ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground h-10">
              <Loader2 className="h-4 w-4 animate-spin" />
              Bölümler yükleniyor...
            </div>
          ) : (
            <>
              <Select
                id="department"
                value={form.watch("department") || ""}
                onChange={(e) => {
                  form.setValue("department", e.target.value);
                  form.setValue("program", "");
                  form.setValue("course", "");
                }}
                disabled={isSubmitting}
                className="h-10 text-sm border-2 focus:border-[#0a294e]"
              >
                <option value="">Bölüm seçin (isteğe bağlı)</option>
                {departments.map((dept) => (
                  <option key={dept._id} value={dept.name}>
                    {dept.name}
                  </option>
                ))}
              </Select>
              {form.formState.errors.department && (
                <p className="text-sm font-medium text-destructive mt-1">
                  {form.formState.errors.department.message}
                </p>
              )}
            </>
          )}
        </FormItem>

        {/* Program */}
        <FormItem>
          <FormLabel htmlFor="program" className="text-sm font-semibold text-slate-700">
            Program
          </FormLabel>
          <Select
            id="program"
            value={form.watch("program") || ""}
            onChange={(e) => {
              form.setValue("program", e.target.value);
              form.setValue("course", "");
            }}
            disabled={isSubmitting || !selectedDepartment || loadingPrograms}
            className="h-10 text-sm border-2 focus:border-[#0a294e]"
          >
            <option value="">
              {!selectedDepartment 
                ? "Önce bölüm seçin" 
                : loadingPrograms
                ? "Yükleniyor..."
                : "Program seçin (isteğe bağlı)"}
            </option>
            {programs.map((prog) => (
              <option key={prog._id} value={prog._id}>
                {prog.name} {prog.code ? `(${prog.code})` : ""}
              </option>
            ))}
          </Select>
          {form.formState.errors.program && (
            <p className="text-sm font-medium text-destructive mt-1">
              {form.formState.errors.program.message}
            </p>
          )}
        </FormItem>

        {/* Ders */}
        <FormItem>
          <FormLabel htmlFor="course" className="text-sm font-semibold text-slate-700">
            Ders
          </FormLabel>
          <Select
            id="course"
            value={form.watch("course") || ""}
            onChange={(e) => form.setValue("course", e.target.value)}
            disabled={isSubmitting || !selectedProgram || courses.length === 0}
            className="h-10 text-sm border-2 focus:border-[#0a294e]"
          >
            <option value="">
              {!selectedProgram 
                ? "Önce program seçin" 
                : courses.length === 0
                ? "Bu program için ders bulunamadı"
                : "Ders seçin (isteğe bağlı)"}
            </option>
            {courses.map((course) => (
              <option key={course._id} value={course._id}>
                {course.code} - {course.name}
              </option>
            ))}
          </Select>
          {form.formState.errors.course && (
            <p className="text-sm font-medium text-destructive mt-1">
              {form.formState.errors.course.message}
            </p>
          )}
        </FormItem>

        {/* Sınıf Seviyesi */}
        <FormItem>
          <FormLabel htmlFor="classLevel" className="text-sm font-semibold text-slate-700">
            Sınıf Seviyesi
          </FormLabel>
          <Select
            id="classLevel"
            value={form.watch("classLevel")?.toString() || ""}
            onChange={(e) => {
              const value = e.target.value === "" ? "" : Number(e.target.value);
              form.setValue("classLevel", value as any);
            }}
            disabled={isSubmitting}
            className="h-10 text-sm border-2 focus:border-[#0a294e]"
          >
            <option value="">Sınıf seviyesi seçin (isteğe bağlı)</option>
            <option value="1">1. Sınıf</option>
            <option value="2">2. Sınıf</option>
            <option value="3">3. Sınıf</option>
            <option value="4">4. Sınıf</option>
          </Select>
          {form.formState.errors.classLevel && (
            <p className="text-sm font-medium text-destructive mt-1">
              {form.formState.errors.classLevel.message}
            </p>
          )}
        </FormItem>
      </div>

      {/* Butonlar */}
      <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 pt-4 border-t border-slate-200">
        <Button 
          type="submit" 
          disabled={isSubmitting}
          className="w-full sm:w-auto h-11 px-6 font-semibold bg-[#0a294e] hover:bg-[#0a294e]/90 text-white"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Kaydediliyor...
            </>
          ) : mode === "create" ? (
            "Öğrenci Ekle"
          ) : (
            "Öğrenciyi Güncelle"
          )}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={isSubmitting}
          className="w-full sm:w-auto h-11 px-6"
        >
          İptal
        </Button>
      </div>
    </form>
  );
}

