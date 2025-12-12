"use client";

import { useState, useEffect } from "react";
import { Edit, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { type AIAnswer } from "@/lib/api/aiApi";
import { questionApi, type Question } from "@/lib/api/questionApi";

interface AIScorePreviewTableProps {
  answers: AIAnswer[];
  examId: string;
  onAnswersChange: (answers: AIAnswer[]) => void;
}

export function AIScorePreviewTable({
  answers,
  examId,
  onAnswersChange,
}: AIScorePreviewTableProps) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editValue, setEditValue] = useState<string>("");
  const [questions, setQuestions] = useState<Record<string, Question>>({});
  const [loadingQuestions, setLoadingQuestions] = useState(true);

  useEffect(() => {
    fetchQuestions();
  }, [examId]);

  const fetchQuestions = async () => {
    try {
      setLoadingQuestions(true);
      const examQuestions = await questionApi.getByExam(examId);
      const questionsMap: Record<string, Question> = {};
      const questionsByNumber: Record<number, Question> = {};
      
      examQuestions.forEach((q) => {
        questionsMap[q._id] = q;
        questionsByNumber[q.number] = q;
      });
      
      setQuestions(questionsMap);
      
      // Map question numbers to questionIds in answers
      const updatedAnswers = answers.map((answer) => {
        const question = questionsByNumber[answer.number];
        if (question && !answer.questionId) {
          return { ...answer, questionId: question._id };
        }
        return answer;
      });
      
      if (JSON.stringify(updatedAnswers) !== JSON.stringify(answers)) {
        onAnswersChange(updatedAnswers);
      }
    } catch (error) {
      console.error("Failed to fetch questions", error);
    } finally {
      setLoadingQuestions(false);
    }
  };

  const handleEditClick = (index: number) => {
    setEditingIndex(index);
    setEditValue(answers[index].scoreValue.toString());
  };

  const handleSaveEdit = () => {
    if (editingIndex === null) return;

    const newValue = parseFloat(editValue);
    if (isNaN(newValue) || newValue < 0) {
      alert("Please enter a valid score");
      return;
    }

    const questionInfo = getQuestionInfo(answers[editingIndex]);
    if (questionInfo.maxScore > 0 && newValue > questionInfo.maxScore) {
      alert(`Score cannot exceed maximum score of ${questionInfo.maxScore}`);
      return;
    }

    const updatedAnswers = [...answers];
    updatedAnswers[editingIndex] = {
      ...updatedAnswers[editingIndex],
      scoreValue: newValue,
    };
    onAnswersChange(updatedAnswers);
    setEditingIndex(null);
  };

  const getQuestionInfo = (answer: AIAnswer) => {
    // Try to find question by questionId first, then by number
    let question = answer.questionId ? questions[answer.questionId] : null;
    if (!question) {
      // Find by number
      const questionByNumber = Object.values(questions).find(
        (q) => q.number === answer.number
      );
      question = questionByNumber || null;
    }
    
    // Get learning outcome code from question
    let learningOutcomeCode = answer.learningOutcomeCode || "-";
    if (question?.mappedLearningOutcomes && Array.isArray(question.mappedLearningOutcomes) && question.mappedLearningOutcomes.length > 0) {
      learningOutcomeCode = question.mappedLearningOutcomes[0]; // Use first ÖÇ code
    }
    
    return {
      maxScore: question?.maxScore || answer.maxScore || 0,
      learningOutcomeCode,
      hasQuestion: !!question,
      questionId: question?._id || answer.questionId || "",
    };
  };

  if (loadingQuestions) {
    return (
      <div className="text-center py-8 text-muted-foreground">Loading questions...</div>
    );
  }

  return (
    <>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Question Number</TableHead>
              <TableHead>Detected Score</TableHead>
              <TableHead>Max Score</TableHead>
              <TableHead>Learning Outcome</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {answers.map((answer, index) => {
              const questionInfo = getQuestionInfo(answer);
              const hasWarning = questionInfo.maxScore > 0 && answer.scoreValue > questionInfo.maxScore;
              const hasError = !questionInfo.hasQuestion;

              return (
                <TableRow
                  key={index}
                  className={index % 2 === 0 ? "bg-background" : "bg-muted/50"}
                >
                  <TableCell className="font-medium">{answer.number}</TableCell>
                  <TableCell>
                    <span className={`font-semibold ${hasWarning ? "text-red-600" : ""}`}>
                      {answer.scoreValue}
                    </span>
                  </TableCell>
                  <TableCell>{questionInfo.maxScore || "-"}</TableCell>
                  <TableCell>
                    {questionInfo.learningOutcomeCode !== "-" ? (
                      <Badge variant="secondary">{questionInfo.learningOutcomeCode}</Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground">
                        No LO mapping
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {hasError ? (
                      <Badge variant="destructive" className="flex items-center gap-1 w-fit">
                        <AlertTriangle className="h-3 w-3" />
                        Question not found
                      </Badge>
                    ) : hasWarning ? (
                      <Badge variant="destructive" className="flex items-center gap-1 w-fit">
                        <AlertTriangle className="h-3 w-3" />
                        Exceeds max
                      </Badge>
                    ) : (
                      <Badge variant="default" className="bg-green-500">Valid</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => handleEditClick(index)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {editingIndex !== null && (
        <Dialog open={editingIndex !== null} onOpenChange={() => setEditingIndex(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Score</DialogTitle>
              <DialogDescription>
                Question {answers[editingIndex!].number} - Max Score:{" "}
                {getQuestionInfo(answers[editingIndex!]).maxScore}
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Input
                type="number"
                step="0.1"
                min="0"
                max={getQuestionInfo(answers[editingIndex!]).maxScore}
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                placeholder="Enter score"
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingIndex(null)}>
                Cancel
              </Button>
              <Button onClick={handleSaveEdit}>Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

