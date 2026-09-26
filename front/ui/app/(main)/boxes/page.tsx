"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Package,
  Plus,
  Trash,
  CircleNotch,
  FileText,
} from "@phosphor-icons/react";
import {
  useBoxes,
  useCreateBox,
  useDeleteBox,
  useModelCatalog,
  useUnassignedDocuments,
  useDeleteDocument,
} from "@/hooks/useApi";
import { loadOrchestrationSettings } from "@/lib/orchestration";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

function CreateBoxDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const { data: catalog } = useModelCatalog();
  const [embeddingModel, setEmbeddingModel] = useState("");
  const [answerModel, setAnswerModel] = useState("");
  const [judgeModel, setJudgeModel] = useState("");
  const providerLabel = (id: string) =>
    catalog?.providers.find((p) => p.id === id)?.label ?? id;
  const createMutation = useCreateBox();

  // Pre-select the account-level orchestration defaults (Settings → Orchestration)
  useEffect(() => {
    if (!open) return;
    const settings = loadOrchestrationSettings();
    setEmbeddingModel(settings.defaultEmbeddingModel || "");
    setAnswerModel(settings.defaultAnswerModel || "");
    setJudgeModel(settings.defaultJudgeModel || "");
  }, [open]);

  const handleCreate = async () => {
    if (!name.trim()) return;
    try {
      await createMutation.mutateAsync({
        name: name.trim(),
        description: description.trim() || undefined,
        embeddingModel: embeddingModel || undefined,
        answerModel: answerModel || undefined,
        judgeModel: judgeModel || undefined,
      });
      onClose();
      setName("");
      setDescription("");
      setEmbeddingModel("");
      setAnswerModel("");
      setJudgeModel("");
    } catch (error) {
      console.error("Create box failed:", error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>New Box</DialogTitle>
          <DialogDescription>
            A box is an isolated context: its own documents, embedding model and
            answer model.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div className="space-y-2">
            <Label htmlFor="box-name">Name</Label>
            <Input
              id="box-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Contracts Q3"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="box-desc">Description</Label>
            <Textarea
              id="box-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this box for?"
            />
          </div>
          <div className="space-y-2">
            <Label>Embedding model</Label>
            <Select value={embeddingModel || undefined} onValueChange={setEmbeddingModel}>
              <SelectTrigger>
                <SelectValue
                  placeholder={catalog?.defaults.embeddingModel ?? "Default"}
                />
              </SelectTrigger>
              <SelectContent>
                {[
                  ...(catalog?.embeddingModels ?? []),
                  ...(embeddingModel &&
                  !(catalog?.embeddingModels ?? []).some((m) => m.id === embeddingModel)
                    ? [{ id: embeddingModel, label: embeddingModel }]
                    : []),
                ].map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Answer model</Label>
            <Select value={answerModel || undefined} onValueChange={setAnswerModel}>
              <SelectTrigger>
                <SelectValue
                  placeholder={catalog?.defaults.answerModel ?? "Default"}
                />
              </SelectTrigger>
              <SelectContent>
                {[
                  ...(catalog?.answerModels ?? []),
                  ...(answerModel &&
                  !(catalog?.answerModels ?? []).some((m) => m.id === answerModel)
                    ? [{ id: answerModel, label: answerModel }]
                    : []),
                ].map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Judge model</Label>
            <Select value={judgeModel || undefined} onValueChange={setJudgeModel}>
              <SelectTrigger>
                <SelectValue
                  placeholder={catalog?.defaults.judgeModel ?? "Default"}
                />
              </SelectTrigger>
              <SelectContent>
                {[
                  ...(catalog?.judgeModels ?? []),
                  ...(judgeModel &&
                  !(catalog?.judgeModels ?? []).some((m) => m.id === judgeModel)
                    ? [{ id: judgeModel, label: judgeModel }]
                    : []),
                ].map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={createMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            disabled={!name.trim() || createMutation.isPending}
          >
            {createMutation.isPending && (
              <CircleNotch className="w-4 h-4 mr-2 animate-spin" />
            )}
            Create
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function BoxesPage() {
  return (
    <Suspense>
      <BoxesContent />
    </Suspense>
  );
}

function BoxesContent() {
  const searchParams = useSearchParams();
  const search = (searchParams.get("search") ?? "").toLowerCase();
  const [createOpen, setCreateOpen] = useState(false);
  const { data: boxes, isLoading, refetch } = useBoxes();
  const { data: unassigned, refetch: refetchUnassigned } =
    useUnassignedDocuments();
  const deleteMutation = useDeleteBox();
  const deleteDocMutation = useDeleteDocument();

  const filteredBoxes = (boxes ?? []).filter((box) =>
    box.name.toLowerCase().includes(search),
  );

  const handleDeleteDoc = async (id: string, name: string) => {
    if (confirm(`Delete unassigned document "${name}"?`)) {
      try {
        await deleteDocMutation.mutateAsync(id);
        refetchUnassigned();
      } catch (error) {
        console.error("Delete failed:", error);
      }
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (
      confirm(`Delete box "${name}"? Documents stay but become unassigned.`)
    ) {
      try {
        await deleteMutation.mutateAsync(id);
        refetch();
      } catch (error) {
        console.error("Delete failed:", error);
      }
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-9 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl">Boxes</h1>
          <p className="text-muted-foreground">
            Isolated contexts with their own models
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          New Box
        </Button>
      </div>

      {(filteredBoxes ?? []).length === 0 && (unassigned ?? []).length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Package className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>
              No boxes yet. Create your first box to scope documents and models.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {(filteredBoxes ?? []).map((box) => (
            <Card key={box.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <Link href={`/boxes/${box.id}`} className="hover:underline">
                    <CardTitle className="flex items-center gap-2">
                      <Package className="w-5 h-5" />
                      {box.name}
                    </CardTitle>
                  </Link>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive"
                    onClick={() => handleDelete(box.id, box.name)}
                  >
                    <Trash className="w-4 h-4" />
                  </Button>
                </div>
                {box.description && (
                  <CardDescription>{box.description}</CardDescription>
                )}
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                <Badge variant="secondary">{box.embeddingModel}</Badge>
                <Badge variant="outline">{box.answerModel}</Badge>
                <Badge variant="outline">judge: {box.judgeModel}</Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {(unassigned ?? []).length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              Sem box ({(unassigned ?? []).length})
            </CardTitle>
            <CardDescription>
              Legacy documents with no box. Upload new documents inside a box
              instead.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {(unassigned ?? []).map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center gap-2 p-2 rounded-lg hover:bg-accent text-sm"
                >
                  <FileText className="w-4 h-4 text-muted-foreground" />
                  <Link
                    href={`/documents/${doc.id}`}
                    className="truncate flex-1 hover:underline"
                  >
                    {doc.originalName}
                  </Link>
                  <Badge variant="secondary">{doc.status}</Badge>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive"
                    onClick={() => handleDeleteDoc(doc.id, doc.originalName)}
                  >
                    <Trash className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <CreateBoxDialog open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}
