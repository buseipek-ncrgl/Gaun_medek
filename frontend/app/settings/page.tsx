"use client";

import { useEffect, useState } from "react";
import { Settings } from "lucide-react";
import { toast } from "sonner";
import { SystemStatusCard } from "@/components/settings/SystemStatusCard";
import { BackupTools } from "@/components/settings/BackupTools";
import { DataIntegrityCheck } from "@/components/settings/DataIntegrityCheck";
import { settingsApi, type SystemStatus } from "@/lib/api/settingsApi";
import { courseApi } from "@/lib/api/courseApi";
import { studentApi } from "@/lib/api/studentApi";
import { examApi } from "@/lib/api/examApi";
import { learningOutcomeApi } from "@/lib/api/learningOutcomeApi";

export default function SettingsPage() {
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchSystemStatus();
  }, []);

  const fetchSystemStatus = async () => {
    try {
      setIsLoading(true);
      
      // Try to get status from API, fallback to manual calculation
      try {
        const status = await settingsApi.getSystemStatus();
        setSystemStatus(status);
      } catch (error) {
        // Fallback: Calculate counts manually
        const [courses, students, exams] = await Promise.all([
          courseApi.getAll().catch(() => []),
          studentApi.getAll().catch(() => []),
          examApi.getAll().catch(() => []),
        ]);

        // Get learning outcomes count
        let learningOutcomes = 0;
        for (const course of courses) {
          try {
            const los = await learningOutcomeApi.getByCourse(course._id);
            learningOutcomes += los.length;
          } catch {
            // Skip
          }
        }

        setSystemStatus({
          apiConnected: true,
          mongodbConnected: true,
          aiServiceAvailable: false,
          counts: {
            courses: courses.length,
            students: students.length,
            exams: exams.length,
            learningOutcomes,
            programOutcomes: 0,
          },
        });
      }
    } catch (error: any) {
      toast.error("Failed to load system status");
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Settings className="h-8 w-8" />
            Admin Settings
          </h2>
          <p className="text-muted-foreground">
            System configuration and management tools
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* System Status */}
        <div className="lg:col-span-2">
          {systemStatus && (
            <SystemStatusCard status={systemStatus} isLoading={isLoading} />
          )}
        </div>

        {/* Backup Tools */}
        <BackupTools />

        {/* Data Integrity Check */}
        <div className="lg:col-span-2">
          <DataIntegrityCheck />
        </div>
      </div>
    </div>
  );
}

