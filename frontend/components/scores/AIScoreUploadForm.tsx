"use client";

import { useState, useRef } from "react";
import { Upload, FileText, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AIScorePreviewDialog, type AIScoreRow } from "./AIScorePreviewDialog";

export function AIScoreUploadForm() {
  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<AIScoreRow[]>([]);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (selectedFile: File) => {
    setFile(selectedFile);
    parseFile(selectedFile);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      handleFileSelect(droppedFile);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const parseFile = async (fileToParse: File) => {
    setIsProcessing(true);
    try {
      const text = await fileToParse.text();
      let data: any[] = [];

      if (fileToParse.name.endsWith(".json")) {
        data = JSON.parse(text);
        if (!Array.isArray(data)) {
          data = [data];
        }
      } else if (fileToParse.name.endsWith(".csv")) {
        data = parseCSV(text);
      } else {
        throw new Error("Unsupported file format. Please use JSON or CSV.");
      }

      // Validate and transform data
      const rows: AIScoreRow[] = data.map((row, index) => {
        // Support both camelCase and snake_case
        const studentNumber = row.studentNumber || row.student_number || "";
        const examId = row.examId || row.exam_id || "";
        const questionId = row.questionId || row.question_id || "";
        const scoreValue = parseFloat(row.scoreValue || row.score_value || 0);

        if (!studentNumber || !examId || !questionId || isNaN(scoreValue)) {
          throw new Error(
            `Row ${index + 1} is missing required fields: studentNumber, examId, questionId, scoreValue`
          );
        }

        return {
          studentNumber,
          examId,
          questionId,
          scoreValue,
        };
      });

      setParsedRows(rows);
      setPreviewOpen(true);
    } catch (error: any) {
      alert(`Error parsing file: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const parseCSV = (text: string): any[] => {
    const lines = text.split("\n").filter((line) => line.trim());
    if (lines.length === 0) return [];

    const headers = lines[0].split(",").map((h) => h.trim());
    const rows: any[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(",").map((v) => v.trim());
      const row: any = {};
      headers.forEach((header, index) => {
        row[header] = values[index] || "";
      });
      rows.push(row);
    }

    return rows;
  };

  const handlePreviewSuccess = () => {
    setFile(null);
    setParsedRows([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <>
      <Card className="rounded-xl shadow-sm">
        <CardHeader>
          <CardTitle>Toplu Puan Yükleme</CardTitle>
          <CardDescription>
            JSON veya CSV formatında puan dosyası yükleyin
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary transition-colors"
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,.csv"
              className="hidden"
              onChange={(e) => {
                const selectedFile = e.target.files?.[0];
                if (selectedFile) {
                  handleFileSelect(selectedFile);
                }
              }}
            />

            {!file ? (
              <div className="space-y-4">
                <Upload className="h-12 w-12 mx-auto text-muted-foreground" />
                <div>
                  <p className="text-lg font-medium">Drop file here or click to upload</p>
                  <p className="text-sm text-muted-foreground mt-2">
                    Supports JSON and CSV formats
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-3">
                <FileText className="h-8 w-8 text-primary" />
                <div className="text-left">
                  <p className="font-medium">{file.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {(file.size / 1024).toFixed(2)} KB
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={(e) => {
                    e.stopPropagation();
                    setFile(null);
                    setParsedRows([]);
                    if (fileInputRef.current) {
                      fileInputRef.current.value = "";
                    }
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>

          {isProcessing && (
            <div className="mt-4 text-center text-muted-foreground">
              Processing file...
            </div>
          )}

          {parsedRows.length > 0 && (
            <div className="mt-4 p-4 bg-muted/50 rounded-lg">
              <p className="text-sm font-medium">
                {parsedRows.length} rows parsed successfully
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Click "Preview" to review before saving
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <AIScorePreviewDialog
        rows={parsedRows}
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        onSuccess={handlePreviewSuccess}
      />
    </>
  );
}

