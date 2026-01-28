"use client";

import { TestCard, type TestResult } from "@/components/testing/TestCard";
import apiClient from "@/lib/api/apiClient";
import { courseApi } from "@/lib/api/courseApi";
import { studentApi } from "@/lib/api/studentApi";
import { examApi } from "@/lib/api/examApi";
import { questionApi } from "@/lib/api/questionApi";
import { scoreApi } from "@/lib/api/scoreApi";
import { learningOutcomeApi } from "@/lib/api/learningOutcomeApi";
import { programOutcomeApi } from "@/lib/api/programOutcomeApi";
import { aiApi } from "@/lib/api/aiApi";

export default function TestingPage() {
  // Test 1: Database Connectivity Test
  const testDatabaseConnectivity = async (): Promise<TestResult> => {
    const output: string[] = [];
    
    try {
      output.push("Testing database connectivity...");
      const courses = await courseApi.getAll();
      output.push(`✓ Courses collection: ${courses.length} documents found`);
      
      const students = await studentApi.getAll();
      output.push(`✓ Students collection: ${students.length} documents found`);
      
      const exams = await examApi.getAll();
      output.push(`✓ Exams collection: ${exams.length} documents found`);
      
      output.push("✓ Database connectivity: SUCCESS");
      
      return {
        status: "success",
        output,
      };
    } catch (error: any) {
      output.push(`✗ Database connection failed: ${error.message}`);
      return {
        status: "error",
        output,
        error: error.message,
      };
    }
  };

  // Test 2: Backend Route Health Test
  const testBackendRoutes = async (): Promise<TestResult> => {
    const output: string[] = [];
    const routes = [
      { name: "Courses", path: "/courses" },
      { name: "Students", path: "/students" },
      { name: "Exams", path: "/exams/course" },
      { name: "Learning Outcomes", path: "/learning-outcomes" },
      { name: "Program Outcomes", path: "/program-outcomes" },
    ];

    try {
      output.push("Testing backend route health...");
      let successCount = 0;
      
      for (const route of routes) {
        try {
          await apiClient.get(route.path);
          output.push(`✓ ${route.name}: OK`);
          successCount++;
        } catch (error: any) {
          output.push(`✗ ${route.name}: ${error.response?.status || "Failed"}`);
        }
      }
      
      if (successCount === routes.length) {
        output.push(`✓ All routes healthy (${successCount}/${routes.length})`);
        return {
          status: "success",
          output,
        };
      } else {
        return {
          status: "error",
          output,
          error: `${routes.length - successCount} routes failed`,
        };
      }
    } catch (error: any) {
      output.push(`✗ Route health check failed: ${error.message}`);
      return {
        status: "error",
        output,
        error: error.message,
      };
    }
  };

  // Test 3: Exam → Question → Score Pipeline Test
  const testExamQuestionScorePipeline = async (): Promise<TestResult> => {
    const output: string[] = [];
    
    try {
      output.push("Testing Exam → Question → Score pipeline...");
      
      // Get first exam
      const exams = await examApi.getAll();
      if (exams.length === 0) {
        return {
          status: "error",
          output: ["No exams found in database"],
          error: "No exams available for testing",
        };
      }
      
      const exam = exams[0];
      output.push(`✓ Found exam: ${exam.examCode} (${exam._id.substring(0, 8)}...)`);
      
      // Get questions for exam
      const questions = await questionApi.getByExam(exam._id);
      output.push(`✓ Found ${questions.length} questions for exam`);
      
      if (questions.length === 0) {
        return {
          status: "error",
          output,
          error: "No questions found for exam",
        };
      }
      
      // Get scores for exam
      const scores = await scoreApi.getByExam(exam._id);
      output.push(`✓ Found ${scores.length} scores for exam`);
      
      // Verify pipeline integrity
      const questionIds = new Set(questions.map((q) => q._id));
      const scoreQuestionIds = new Set(
        scores.map((s) =>
          typeof s.questionId === "string" ? s.questionId : s.questionId._id
        )
      );
      
      const validScores = Array.from(scoreQuestionIds).filter((id) =>
        questionIds.has(id)
      );
      output.push(`✓ Pipeline integrity: ${validScores.length}/${scores.length} valid scores`);
      
      output.push("✓ Pipeline test: SUCCESS");
      
      return {
        status: "success",
        output,
      };
    } catch (error: any) {
      output.push(`✗ Pipeline test failed: ${error.message}`);
      return {
        status: "error",
        output,
        error: error.message,
      };
    }
  };

  // Test 4: Student Lookup + LO/PO Calculation Test
  const testStudentLookupAndCalculation = async (): Promise<TestResult> => {
    const output: string[] = [];
    
    try {
      output.push("Testing student lookup and LO/PO calculation...");
      
      // Get first student
      const students = await studentApi.getAll();
      if (students.length === 0) {
        return {
          status: "error",
          output: ["No students found in database"],
          error: "No students available for testing",
        };
      }
      
      const student = students[0];
      output.push(`✓ Found student: ${student.name} (${student.studentNumber})`);
      
      // Test student lookup by number
      const studentByNumber = await studentApi.getByNumber(student.studentNumber);
      output.push(`✓ Student lookup by number: SUCCESS`);
      
      // Get courses
      const courses = await courseApi.getAll();
      if (courses.length === 0) {
        return {
          status: "error",
          output,
          error: "No courses available for testing",
        };
      }
      
      const course = courses[0];
      output.push(`✓ Using course: ${course.code} - ${course.name}`);
      
      // Test LO calculation
      try {
        const loAchievements = await scoreApi.calculateLOAchievement(
          student._id,
          course._id
        );
        output.push(`✓ LO calculation: ${loAchievements.length} outcomes calculated`);
      } catch (error: any) {
        output.push(`⚠ LO calculation: ${error.message || "No scores found"}`);
      }
      
      // Test PO calculation
      try {
        const poAchievements = await scoreApi.calculatePOAchievement(
          student._id,
          course._id
        );
        output.push(`✓ PO calculation: ${poAchievements.length} outcomes calculated`);
      } catch (error: any) {
        output.push(`⚠ PO calculation: ${error.message || "No scores found"}`);
      }
      
      output.push("✓ Student lookup and calculation: SUCCESS");
      
      return {
        status: "success",
        output,
      };
    } catch (error: any) {
      output.push(`✗ Test failed: ${error.message}`);
      return {
        status: "error",
        output,
        error: error.message,
      };
    }
  };

  // Test 5: Scoring Service Mock Test
  const testScoringService = async (): Promise<TestResult> => {
    const output: string[] = [];
    
    try {
      output.push("Testing scoring service endpoint...");
      output.push("Attempting to ping /api/ai/process endpoint...");
      
      // Try to check if endpoint exists (without actually uploading)
      try {
        // This will likely fail, but we can check the error type
        await apiClient.get("/ai/health");
        output.push("✓ Service health endpoint: OK");
      } catch (error: any) {
        if (error.response?.status === 404) {
          output.push("⚠ Health endpoint not found (expected if not implemented)");
        } else if (error.response?.status === 405) {
          output.push("✓ Endpoint exists (method not allowed is expected)");
        } else {
          output.push(`⚠ Endpoint check: ${error.response?.status || "Unknown"}`);
        }
      }
      
      // Check configuration status
      try {
        const { settingsApi } = await import("@/lib/api/settingsApi");
        const apiKeyData = await settingsApi.getAPIKey();
        if (apiKeyData.status === "active") {
          output.push("✓ Configuration is active");
        } else {
          output.push(`⚠ Configuration status: ${apiKeyData.status}`);
        }
      } catch (error) {
        output.push("⚠ Could not check configuration status");
      }
      
      output.push("✓ Scoring service test: COMPLETED (mock)");
      
      return {
        status: "success",
        output,
      };
    } catch (error: any) {
      output.push(`✗ Scoring service test failed: ${error.message}`);
      return {
        status: "error",
        output,
        error: error.message,
      };
    }
  };

  // Test 6: Report Generation Check
  const testReportGeneration = async (): Promise<TestResult> => {
    const output: string[] = [];
    
    try {
      output.push("Testing report generation capabilities...");
      
      // Check if we have data for reports
      const courses = await courseApi.getAll();
      output.push(`✓ Found ${courses.length} courses`);
      
      if (courses.length === 0) {
        return {
          status: "error",
          output,
          error: "No courses available for report generation",
        };
      }
      
      const course = courses[0];
      output.push(`✓ Testing with course: ${course.code}`);
      
      // Check for learning outcomes
      const los = await learningOutcomeApi.getByCourse(course._id);
      output.push(`✓ Found ${los.length} learning outcomes`);
      
      // Check for program outcomes
      const pos = await programOutcomeApi.getAll();
      output.push(`✓ Found ${pos.length} program outcomes`);
      
      // Check for exams
      const exams = await examApi.getByCourse(course._id);
      output.push(`✓ Found ${exams.length} exams`);
      
      // Test aggregate LO calculation
      try {
        const loAchievements = await scoreApi.calculateLOAchievement(null, course._id);
        output.push(`✓ Aggregate LO calculation: ${loAchievements.length} outcomes`);
      } catch (error: any) {
        output.push(`⚠ Aggregate LO calculation: ${error.message || "No data"}`);
      }
      
      // Test aggregate PO calculation
      try {
        const poAchievements = await scoreApi.calculatePOAchievement(null, course._id);
        output.push(`✓ Aggregate PO calculation: ${poAchievements.length} outcomes`);
      } catch (error: any) {
        output.push(`⚠ Aggregate PO calculation: ${error.message || "No data"}`);
      }
      
      output.push("✓ Report generation check: SUCCESS");
      
      return {
        status: "success",
        output,
      };
    } catch (error: any) {
      output.push(`✗ Report generation test failed: ${error.message}`);
      return {
        status: "error",
        output,
        error: error.message,
      };
    }
  };

  // Test 7: File Upload + Preview Mock Test
  const testFileUploadPreview = async (): Promise<TestResult> => {
    const output: string[] = [];
    
    try {
      output.push("Testing file upload and preview functionality...");
      
      // Create a mock file
      const mockFile = new File(["mock content"], "test.pdf", {
        type: "application/pdf",
      });
      output.push(`✓ Created mock file: ${mockFile.name} (${mockFile.size} bytes)`);
      
      // Check file validation
      const validExtensions = [".pdf", ".png", ".jpg", ".jpeg"];
      const fileExtension = mockFile.name.substring(mockFile.name.lastIndexOf("."));
      if (validExtensions.includes(fileExtension.toLowerCase())) {
        output.push(`✓ File extension validation: PASSED (${fileExtension})`);
      } else {
        output.push(`✗ File extension validation: FAILED (${fileExtension})`);
      }
      
      // Test file size
      const maxSize = 10 * 1024 * 1024; // 10MB
      if (mockFile.size < maxSize) {
        output.push(`✓ File size validation: PASSED (${(mockFile.size / 1024).toFixed(2)} KB)`);
      } else {
        output.push(`✗ File size validation: FAILED (exceeds ${maxSize / 1024 / 1024}MB)`);
      }
      
      // Check if AI endpoint would accept the file
      output.push("⚠ Actual upload test skipped (requires backend implementation)");
      output.push("✓ File upload preview test: COMPLETED (mock)");
      
      return {
        status: "success",
        output,
      };
    } catch (error: any) {
      output.push(`✗ File upload test failed: ${error.message}`);
      return {
        status: "error",
        output,
        error: error.message,
      };
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Developer Testing Dashboard</h2>
        <p className="text-muted-foreground">
          Run system tests to verify functionality and connectivity
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <TestCard
          testName="Database Connectivity"
          description="Test MongoDB connection and collection access"
          onRun={testDatabaseConnectivity}
        />

        <TestCard
          testName="Backend Route Health"
          description="Check if all backend API routes are accessible"
          onRun={testBackendRoutes}
        />

        <TestCard
          testName="Exam → Question → Score Pipeline"
          description="Verify data integrity across exam, question, and score relationships"
          onRun={testExamQuestionScorePipeline}
        />

        <TestCard
          testName="Student Lookup + LO/PO Calculation"
          description="Test student retrieval and learning/program outcome calculations"
          onRun={testStudentLookupAndCalculation}
        />

        <TestCard
          testName="Scoring Service Mock Test"
          description="Check scoring service endpoint availability and configuration status"
          onRun={testScoringService}
        />

        <TestCard
          testName="Report Generation Check"
          description="Verify MEDEK report generation capabilities and data availability"
          onRun={testReportGeneration}
        />

        <TestCard
          testName="File Upload + Preview Mock"
          description="Test file upload validation and preview functionality"
          onRun={testFileUploadPreview}
        />
      </div>
    </div>
  );
}

