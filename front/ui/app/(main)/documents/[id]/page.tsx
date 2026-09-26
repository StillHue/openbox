"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  FileText,
  CheckCircle,
  XCircle,
  Clock,
  CircleNotch,
  ArrowSquareOut,
  Graph,
  ChatCircle,
  Trash,
} from "@phosphor-icons/react";
import { useDocument, useDeleteDocument } from "@/hooks/useApi";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

export default function DocumentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const documentId = params?.id as string;
  const { data: document, isLoading, error } = useDocument(documentId);
  const deleteMutation = useDeleteDocument();

  const handleDelete = async () => {
    if (!document) return;
    if (
      confirm(
        `Delete "${document.originalName}"? This removes its chunks, graph and embeddings.`,
      )
    ) {
      try {
        await deleteMutation.mutateAsync(document.id);
        router.push(document.boxId ? `/boxes/${document.boxId}` : "/boxes");
      } catch (e) {
        console.error("Delete failed:", e);
      }
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-8 w-8 rounded-lg" />
          <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-24" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-4 w-full mb-2" />
            <Skeleton className="h-4 w-3/4" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Error loading document</AlertTitle>
        <AlertDescription>{error.message}</AlertDescription>
      </Alert>
    );
  }

  if (!document) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Document not found</AlertTitle>
        <AlertDescription>
          The requested document does not exist.
        </AlertDescription>
      </Alert>
    );
  }

  const getStatusBadge = () => {
    switch (document.status) {
      case "completed":
        return (
          <Badge variant="default" className="gap-1">
            <CheckCircle className="w-4 h-4" />
            Completed
          </Badge>
        );
      case "failed":
        return (
          <Badge variant="destructive" className="gap-1">
            <XCircle className="w-4 h-4" />
            Failed
          </Badge>
        );
      case "processing":
        return (
          <Badge variant="secondary" className="gap-1">
            <CircleNotch className="w-4 h-4 animate-spin" />
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary" className="gap-1">
            <Clock className="w-4 h-4" />
            Pending
          </Badge>
        );
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" asChild>
          <Link href={document.boxId ? `/boxes/${document.boxId}` : "/boxes"}>
            <ArrowLeft className="w-4 h-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl flex items-center gap-2">
            <FileText className="w-8 h-8" />
            {document.originalName}
          </h1>
          <div className="flex items-center gap-2 mt-1">
            {getStatusBadge()}
            <span className="text-sm text-muted-foreground">
              {document.mimeType}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Document Info</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">ID</p>
              <p className="text-sm font-mono">{document.id}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Uploaded</p>
              <p className="text-sm">
                {new Date(document.createdAt).toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Last Updated</p>
              <p className="text-sm">
                {new Date(document.updatedAt).toLocaleString()}
              </p>
            </div>
          </CardContent>
        </Card>

        {document.judgeScore !== null && document.judgeMetadata && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Judge Evaluation</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Score</p>
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "text-2xl",
                      document.judgeScore >= 0.7
                        ? "text-green-600"
                        : document.judgeScore >= 0.4
                          ? "text-yellow-600"
                          : "text-red-600",
                    )}
                  >
                    {Math.round(document.judgeScore * 100)}%
                  </span>
                </div>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Category</p>
                <p className="text-sm">{document.judgeMetadata.category}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Quality</p>
                <p className="text-sm">{document.judgeMetadata.quality}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Topics</p>
                <div className="flex flex-wrap gap-1">
                  {document.judgeMetadata.topics.map((topic, index) => (
                    <Badge key={index} variant="secondary" className="text-xs">
                      {topic}
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button asChild className="w-full" variant="outline">
              <Link href={`/graph/${document.id}`}>
                <Graph className="w-4 h-4 mr-2" />
                View Graph
              </Link>
            </Button>
            {document.status === "completed" && (
              <Button asChild className="w-full" variant="outline">
                <Link href={`/chat?document=${document.id}`}>
                  <ChatCircle className="w-4 h-4 mr-2" />
                  Chat with Document
                </Link>
              </Button>
            )}
            <Button asChild className="w-full" variant="outline">
              <a href={document.filename} download>
                <ArrowSquareOut className="w-4 h-4 mr-2" />
                Download
              </a>
            </Button>
            <Button
              className="w-full text-destructive hover:text-destructive"
              variant="outline"
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
            >
              <Trash className="w-4 h-4 mr-2" />
              Delete
            </Button>
          </CardContent>
        </Card>
      </div>

      {document.chunks && document.chunks.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              Chunks ({document.chunks.length})
            </CardTitle>
            <CardDescription>
              Semantic segments extracted from the document
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="chunks" className="w-full">
              <TabsList>
                <TabsTrigger value="chunks">Chunks</TabsTrigger>
                <TabsTrigger value="metadata">Metadata</TabsTrigger>
              </TabsList>
              <TabsContent value="chunks" className="mt-4">
                <div className="space-y-4">
                  {document.chunks.map((chunk, index) => (
                    <div key={chunk.id} className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">
                          Chunk {index + 1}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          Tokens: {chunk.metadata.tokens}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-3">
                        {chunk.content}
                      </p>
                      {chunk.metadata.headings.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {chunk.metadata.headings.map((heading, hIndex) => (
                            <Badge
                              key={hIndex}
                              variant="outline"
                              className="text-xs"
                            >
                              {heading}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </TabsContent>
              <TabsContent value="metadata" className="mt-4">
                <pre className="text-xs bg-muted p-4 rounded-lg overflow-auto">
                  {JSON.stringify(
                    document.chunks.map((c) => c.metadata),
                    null,
                    2,
                  )}
                </pre>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
