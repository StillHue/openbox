"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  Package,
  CircleNotch,
  PaperPlaneTilt,
  FileText,
  Plus,
  Trash,
  Graph,
} from "@phosphor-icons/react";
import {
  useBox,
  useBoxDocuments,
  useUpdateBox,
  useModelCatalog,
  useAskBox,
  useDeleteDocument,
} from "@/hooks/useApi";
import { UploadDialog } from "@/components/upload-dialog";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { AskResponse } from "@/types";

export default function BoxDetailPage() {
  const params = useParams();
  const boxId = params?.id as string;
  const { data: box, isLoading, error } = useBox(boxId);
  const { data: documents, refetch: refetchDocuments } = useBoxDocuments(boxId);
  const { data: catalog } = useModelCatalog();
  const updateMutation = useUpdateBox();
  const askMutation = useAskBox();
  const deleteDocMutation = useDeleteDocument();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [embeddingModel, setEmbeddingModel] = useState("");
  const [answerModel, setAnswerModel] = useState("");
  const [judgeModel, setJudgeModel] = useState("");
  const [question, setQuestion] = useState("");
  const [lastAsk, setLastAsk] = useState<AskResponse | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);

  const providerLabel = (id: string) =>
    catalog?.providers.find((p) => p.id === id)?.label ?? id;

  /** Keep a dynamic `provider:model` selection visible even if it is not in the static catalog. */
  const embeddingOptions = [
    ...(catalog?.embeddingModels ?? []),
    ...(embeddingModel && !(catalog?.embeddingModels ?? []).some((m) => m.id === embeddingModel)
      ? [{ id: embeddingModel, label: embeddingModel, dimensions: 1024, provider: "" }]
      : []),
  ];
  const answerOptions = [
    ...(catalog?.answerModels ?? []),
    ...(answerModel && !(catalog?.answerModels ?? []).some((m) => m.id === answerModel)
      ? [{ id: answerModel, label: answerModel, description: "", provider: "" }]
      : []),
  ];
  const judgeOptions = [
    ...(catalog?.judgeModels ?? []),
    ...(judgeModel && !(catalog?.judgeModels ?? []).some((m) => m.id === judgeModel)
      ? [{ id: judgeModel, label: judgeModel, description: "", provider: "" }]
      : []),
  ];

  useEffect(() => {
    if (box) {
      setName(box.name);
      setDescription(box.description ?? "");
      setEmbeddingModel(box.embeddingModel);
      setAnswerModel(box.answerModel);
      setJudgeModel(box.judgeModel);
    }
  }, [box]);

  const handleSave = async () => {
    try {
      await updateMutation.mutateAsync({
        id: boxId,
        data: { name, description, embeddingModel, answerModel, judgeModel },
      });
    } catch (e) {
      console.error("Save failed:", e);
    }
  };

  const handleDeleteDoc = async (id: string, name: string) => {
    if (
      confirm(
        `Delete "${name}" from this box? This removes its chunks, graph and embeddings.`,
      )
    ) {
      try {
        await deleteDocMutation.mutateAsync(id);
        refetchDocuments();
      } catch (e) {
        console.error("Delete failed:", e);
      }
    }
  };

  const handleAsk = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim() || askMutation.isPending) return;
    try {
      const res = await askMutation.mutateAsync({
        boxId,
        query: question,
        topK: 5,
      });
      setLastAsk(res);
    } catch (e) {
      console.error("Ask failed:", e);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Error loading box</AlertTitle>
        <AlertDescription>{error.message}</AlertDescription>
      </Alert>
    );
  }

  if (!box) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Box not found</AlertTitle>
        <AlertDescription>The requested box does not exist.</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" asChild>
          <Link href="/boxes">
            <ArrowLeft className="w-4 h-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl flex items-center gap-2">
            <Package className="w-7 h-7" />
            {box.name}
          </h1>
          <p className="text-muted-foreground">
            Box settings, documents and Q&A
          </p>
        </div>
        <Button variant="outline" asChild className="sm:ml-auto">
          <Link href={`/boxes/${boxId}/graph`}>
            <Graph className="w-4 h-4 mr-2" />
            Graph
          </Link>
        </Button>
      </div>

      <Tabs defaultValue="settings" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="settings">Settings</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="ask">Ask</TabsTrigger>
        </TabsList>

        <TabsContent value="settings" className="space-y-6 mt-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Settings</CardTitle>
              <CardDescription>
                Changing the embedding model only affects new uploads
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="box-name">Name</Label>
                <Input
                  id="box-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="box-desc">Description</Label>
                <Textarea
                  id="box-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Embedding model</Label>
                <Select
                  value={embeddingModel}
                  onValueChange={setEmbeddingModel}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {embeddingOptions.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Answer model</Label>
                <Select value={answerModel} onValueChange={setAnswerModel}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {answerOptions.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Judge model</Label>
                <Select value={judgeModel} onValueChange={setJudgeModel}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {judgeOptions.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleSave} disabled={updateMutation.isPending}>
                {updateMutation.isPending && (
                  <CircleNotch className="w-4 h-4 mr-2 animate-spin" />
                )}
                Save
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documents" className="space-y-6 mt-6">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">
                    Documents ({(documents ?? []).length})
                  </CardTitle>
                  <CardDescription>Scoped to this box</CardDescription>
                </div>
                <Button size="sm" onClick={() => setUploadOpen(true)}>
                  <Plus className="w-4 h-4 mr-1" />
                  Upload
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="max-h-80">
                <div className="space-y-2">
                  {(documents ?? []).length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      No documents in this box yet.
                    </p>
                  )}
                  {(documents ?? []).map((doc) => (
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
                      {(doc.mimeType.includes("markdown") ||
                        doc.originalName.endsWith(".md")) && (
                        <Badge className="bg-amber-500/15 text-amber-400 border-transparent">
                          golden rule
                        </Badge>
                      )}
                      <Badge variant="secondary">
                        {doc.status === "processing" ? (
                          <CircleNotch className="w-3 h-3 animate-spin" />
                        ) : (
                          doc.status
                        )}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={() =>
                          handleDeleteDoc(doc.id, doc.originalName)
                        }
                      >
                        <Trash className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ask" className="space-y-6 mt-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Ask this box</CardTitle>
              <CardDescription>
                Answered by {box.answerModel} using {box.embeddingModel}{" "}
                retrieval
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <form onSubmit={handleAsk} className="flex gap-2">
                <Input
                  placeholder="Ask a question about this box..."
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  disabled={askMutation.isPending}
                  className="flex-1"
                />
                <Button
                  type="submit"
                  disabled={!question.trim() || askMutation.isPending}
                >
                  {askMutation.isPending ? (
                    <CircleNotch className="w-4 h-4 animate-spin" />
                  ) : (
                    <PaperPlaneTilt className="w-4 h-4" />
                  )}
                </Button>
              </form>
              {lastAsk && (
                <div className="space-y-3 p-4 border rounded-lg">
                  <p className="whitespace-pre-wrap text-sm">
                    {lastAsk.answer}
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {lastAsk.sources.map((s, i) => (
                      <Badge key={i} variant="outline" className="text-xs">
                        [{i + 1}] {s.documentName} (
                        {Math.round(s.similarity * 100)}%)
                      </Badge>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {lastAsk.model} · {lastAsk.tookMs}ms
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <UploadDialog
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        fixedBoxId={boxId}
        onUploaded={() => refetchDocuments()}
      />
    </div>
  );
}
