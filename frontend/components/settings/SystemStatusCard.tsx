"use client";

import { CheckCircle2, XCircle, Loader2, Database, Zap, Brain, BookOpen, Users, FileText, Target, Award } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { type SystemStatus } from "@/lib/api/settingsApi";

interface SystemStatusCardProps {
  status: SystemStatus;
  isLoading?: boolean;
}

export function SystemStatusCard({ status, isLoading }: SystemStatusCardProps) {
  if (isLoading) {
    return (
      <Card className="rounded-xl shadow-sm">
        <CardHeader>
          <CardTitle>System Status</CardTitle>
          <CardDescription>Checking system health...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="rounded-xl shadow-sm">
      <CardHeader>
        <CardTitle>System Status</CardTitle>
        <CardDescription>Current system health and connectivity</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Connectivity Status */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Connectivity
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="flex items-center gap-3 p-3 rounded-lg border">
              <Zap className={`h-5 w-5 ${status.apiConnected ? "text-green-500" : "text-red-500"}`} />
              <div className="flex-1">
                <p className="text-sm font-medium">API</p>
                <Badge
                  variant={status.apiConnected ? "default" : "destructive"}
                  className="mt-1"
                >
                  {status.apiConnected ? "Connected" : "Disconnected"}
                </Badge>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 rounded-lg border">
              <Database className={`h-5 w-5 ${status.mongodbConnected ? "text-green-500" : "text-red-500"}`} />
              <div className="flex-1">
                <p className="text-sm font-medium">MongoDB</p>
                <Badge
                  variant={status.mongodbConnected ? "default" : "destructive"}
                  className="mt-1"
                >
                  {status.mongodbConnected ? "Connected" : "Disconnected"}
                </Badge>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 rounded-lg border">
              <Brain className={`h-5 w-5 ${status.aiServiceAvailable ? "text-green-500" : "text-yellow-500"}`} />
              <div className="flex-1">
                <p className="text-sm font-medium">Puanlama Servisi</p>
                <Badge
                  variant={status.aiServiceAvailable ? "default" : "secondary"}
                  className="mt-1"
                >
                  {status.aiServiceAvailable ? "Mevcut" : "Mevcut Değil"}
                </Badge>
              </div>
            </div>
          </div>
        </div>

        {/* Data Counts */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Data Overview
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="flex flex-col items-center p-4 rounded-lg border bg-muted/50">
              <BookOpen className="h-6 w-6 text-primary mb-2" />
              <p className="text-2xl font-bold">{status.counts.courses}</p>
              <p className="text-xs text-muted-foreground">Courses</p>
            </div>

            <div className="flex flex-col items-center p-4 rounded-lg border bg-muted/50">
              <Users className="h-6 w-6 text-primary mb-2" />
              <p className="text-2xl font-bold">{status.counts.students}</p>
              <p className="text-xs text-muted-foreground">Students</p>
            </div>

            <div className="flex flex-col items-center p-4 rounded-lg border bg-muted/50">
              <FileText className="h-6 w-6 text-primary mb-2" />
              <p className="text-2xl font-bold">{status.counts.exams}</p>
              <p className="text-xs text-muted-foreground">Exams</p>
            </div>

            <div className="flex flex-col items-center p-4 rounded-lg border bg-muted/50">
              <Target className="h-6 w-6 text-primary mb-2" />
              <p className="text-2xl font-bold">{status.counts.learningOutcomes}</p>
              <p className="text-xs text-muted-foreground">LOs</p>
            </div>

            <div className="flex flex-col items-center p-4 rounded-lg border bg-muted/50">
              <Award className="h-6 w-6 text-primary mb-2" />
              <p className="text-2xl font-bold">{status.counts.programOutcomes}</p>
              <p className="text-xs text-muted-foreground">POs</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

