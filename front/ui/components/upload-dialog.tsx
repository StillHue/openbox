"use client";

import { useState } from "react";
import { FileText, CircleNotch } from "@phosphor-icons/react";
import { useUploadDocument, useBoxes } from "@/hooks/useApi";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface UploadDialogProps {
  open: boolean;
  onClose: () => void;
  /** When set, upload is scoped to this box and the selector is hidden */
  fixedBoxId?: string;
  onUploaded?: () => void;
}

export function UploadDialog({ open, onClose, fixedBoxId, onUploaded }: UploadDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [boxId, setBoxId] = useState<string>("none");
  const uploadMutation = useUploadDocument();
  const { data: boxes } = useBoxes();

  const effectiveBoxId = fixedBoxId ?? (boxId === "none" ? undefined : boxId);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    try {
      await uploadMutation.mutateAsync({ file, boxId: effectiveBoxId });
      onClose();
      setFile(null);
      onUploaded?.();
    } catch (error) {
      console.error("Upload failed:", error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Upload Document</DialogTitle>
          <DialogDescription>
            Drag and drop a file or click to select. Supports PDF, DOCX, TXT, MD, and more.
          </DialogDescription>
        </DialogHeader>

        <div
          className={cn(
            "border-2 border-dashed rounded-lg p-8 text-center transition-colors",
            dragActive ? "border-primary bg-primary/5" : "border-muted"
          )}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
        >
          <input
            type="file"
            id="file-upload"
            className="hidden"
            onChange={handleFileChange}
            accept=".pdf,.docx,.txt,.md,.csv,.json,.xml,.html,.htm"
          />
          <label
            htmlFor="file-upload"
            className={cn(
              "cursor-pointer flex flex-col items-center gap-4",
              file && "opacity-50"
            )}
          >
            <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center">
              <FileText className="w-6 h-6 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium">
                {file ? file.name : "Click to upload or drag and drop"}
              </p>
              <p className="text-xs text-muted-foreground">
                PDF, DOCX, TXT, MD, CSV, JSON, XML, HTML (max 50MB)
              </p>
            </div>
          </label>
        </div>

        {file && (
          <div className="mt-4 p-4 bg-muted rounded-lg">
            <div className="flex items-center justify-between text-sm">
              <span>{file.name}</span>
              <span>{(file.size / 1024 / 1024).toFixed(2)} MB</span>
            </div>
            {uploadMutation.isPending && (
              <Progress value={50} className="mt-2 h-2" />
            )}
          </div>
        )}

        {!fixedBoxId && (
          <div className="space-y-2 mt-4">
            <Label>Box (context)</Label>
            <Select value={boxId} onValueChange={setBoxId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a box" />
              </SelectTrigger>
              <SelectContent>
                {(boxes ?? []).map((box) => (
                  <SelectItem key={box.id} value={box.id}>
                    {box.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="flex justify-end gap-2 mt-6">
          <Button variant="outline" onClick={onClose} disabled={uploadMutation.isPending}>
            Cancel
          </Button>
          <Button onClick={handleUpload} disabled={!file || !effectiveBoxId || uploadMutation.isPending}>
            {uploadMutation.isPending ? (
              <>
                <CircleNotch className="w-4 h-4 mr-2 animate-spin" />
                Uploading...
              </>
            ) : (
              "Upload"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
