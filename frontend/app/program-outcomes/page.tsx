"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ProgramOutcomeTable } from "@/components/programOutcomes/ProgramOutcomeTable";
import { programOutcomeApi, type ProgramOutcome } from "@/lib/api/programOutcomeApi";
import { learningOutcomeApi, type LearningOutcome } from "@/lib/api/learningOutcomeApi";
import { courseApi } from "@/lib/api/courseApi";

export default function ProgramOutcomesPage() {
  const router = useRouter();
  const [programOutcomes, setProgramOutcomes] = useState<ProgramOutcome[]>([]);
  const [filteredProgramOutcomes, setFilteredProgramOutcomes] = useState<ProgramOutcome[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [learningOutcomeCounts, setLearningOutcomeCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    fetchAllProgramOutcomes();
  }, []);

  useEffect(() => {
    if (searchQuery.trim() === "") {
      setFilteredProgramOutcomes(programOutcomes);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = programOutcomes.filter(
        (po) =>
          po.code.toLowerCase().includes(query) ||
          po.description.toLowerCase().includes(query)
      );
      setFilteredProgramOutcomes(filtered);
    }
  }, [searchQuery, programOutcomes]);

  const fetchAllProgramOutcomes = async () => {
    try {
      setIsLoading(true);
      const data = await programOutcomeApi.getAll();
      setProgramOutcomes(data);
      setFilteredProgramOutcomes(data);
      
      // Calculate learning outcome counts for each program outcome
      await calculateLearningOutcomeCounts(data);
    } catch (error: any) {
      toast.error("Failed to load program outcomes");
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const calculateLearningOutcomeCounts = async (programOutcomes: ProgramOutcome[]) => {
    try {
      // Fetch all courses
      const courses = await courseApi.getAll();
      const allLearningOutcomes: LearningOutcome[] = [];

      // Fetch all learning outcomes
      for (const course of courses) {
        try {
          const courseOutcomes = await learningOutcomeApi.getByCourse(course._id);
          allLearningOutcomes.push(...courseOutcomes);
        } catch (error) {
          console.error(`Failed to fetch outcomes for course ${course._id}`);
        }
      }

      // Count learning outcomes mapped to each program outcome
      const counts: Record<string, number> = {};
      programOutcomes.forEach((po) => {
        const poId = po._id || po.code; // Use _id if available, fallback to code
        counts[poId] = allLearningOutcomes.filter((lo) =>
          lo.mappedProgramOutcomes?.includes(po._id || po.code)
        ).length;
      });

      setLearningOutcomeCounts(counts);
    } catch (error) {
      console.error("Failed to calculate learning outcome counts", error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Program Outcomes (PÇ)</h2>
          <p className="text-muted-foreground">
            Manage program outcomes and their mappings to learning outcomes
          </p>
        </div>
        <Button onClick={() => router.push("/program-outcomes/new")}>
          <Plus className="mr-2 h-4 w-4" />
          New Program Outcome
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Program Outcomes List</CardTitle>
          <CardDescription>
            All program outcomes in the system. Click edit to modify or delete to remove.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by code or description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading program outcomes...
            </div>
          ) : (
            <ProgramOutcomeTable
              programOutcomes={filteredProgramOutcomes}
              learningOutcomeCounts={learningOutcomeCounts}
              onDelete={fetchAllProgramOutcomes}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

