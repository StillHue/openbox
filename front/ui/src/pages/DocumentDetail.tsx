import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, FileText, Loader2, AlertCircle, CheckCircle, Clock, GitGraph, MessageSquare, Settings, Copy } from 'lucide-react';
import { useDocument, useDeleteDocument } from '@/hooks/useApi';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import type { Document, Chunk } from '@/types';

const statusConfig = {
  pending: { label: 'Pending', variant: 'secondary' as const, icon: Clock },
  processing: { label: 'Processing', variant: 'default' as const, icon: Loader2 },
  completed: { label: 'Completed', variant: 'default' as const, icon: CheckCircle },
  failed: { label: 'Failed', variant: 'destructive' as const, icon: AlertCircle },
} as const;

function StatusBadge({ status }: { status: Document['status'] }) {
  const config = statusConfig[status];
  const Icon = config.icon;
  return (
    <Badge variant={config.variant} className="gap-1">
      <Icon className="w-3 h-3" />
      {config.label}
    </Badge>
  );
}

function MetadataRow({ label, value }: { label: string; value: string | number | undefined }) {
  return (
    <div className="flex justify-between py-2 border-b last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right max-w-[60%] truncate">
        {value ?? '—'}
      </span>
    </div>
  );
}

function JudgeInfo({ document }: { document: Document }) {
  if (!document.judgeMetadata) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <AlertCircle className="w-12 h-12 mx-auto mb-2 opacity-50" />
        <p>No judge evaluation available</p>
      </div>
    );
  }

  const { category, quality, topics, shouldIndex, confidence, reasoning } = document.judgeMetadata;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Category</p>
            <p className="text-lg font-medium capitalize">{category}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Quality</p>
            <p className="text-lg font-medium capitalize">{quality}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Should Index</p>
            <Badge variant={shouldIndex ? 'default' : 'destructive'} className="text-base">
              {shouldIndex ? 'Yes' : 'No'}
            </Badge>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Confidence</p>
            <p className="text-lg font-medium">{Math.round(confidence * 100)}%</p>
          </CardContent>
        </Card>
      </div>

      <div>
        <h4 className="font-medium mb-2">Topics</h4>
        <div className="flex flex-wrap gap-2">
          {topics.map((topic) => (
            <Badge key={topic} variant="outline">{topic}</Badge>
          ))}
        </div>
      </div>

      <div>
        <h4 className="font-medium mb-2">Reasoning</h4>
        <p className="text-sm text-muted-foreground bg-muted p-4 rounded-lg">{reasoning}</p>
      </div>
    </div>
  );
}

function ChunksList({ chunks }: { chunks: Chunk[] }) {
  if (chunks.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
        <p>No chunks available</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-[400px]">
      <div className="space-y-3">
        {chunks.map((chunk) => (
          <Card key={chunk.id} className="overflow-hidden">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-4 mb-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span className="font-mono bg-muted px-2 py-0.5 rounded">#{chunk.chunkIndex}</span>
                  <span>{chunk.metadata.tokens} tokens</span>
                  {chunk.metadata.headings.length > 0 && (
                    <span className="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded">
                      {chunk.metadata.headings.slice(-1)[0]}
                    </span>
                  )}
                </div>
                <Button variant="ghost" size="icon" className="h-6 w-6">
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
              <pre className="text-sm whitespace-pre-wrap font-mono bg-muted p-3 rounded max-h-40 overflow-y-auto">
                {chunk.content}
              </pre>
            </CardContent>
          </Card>
        ))}
      </div>
    </ScrollArea>
  );
}

export default function DocumentDetail() {
  const { id } = useParams<{ id: string }>();
  const { data: document, isLoading, error } = useDocument(id!);
  const deleteMutation = useDeleteDocument();

  const handleDelete = async () => {
    if (confirm('Are you sure you want to delete this document? This cannot be undone.')) {
      try {
        await deleteMutation.mutateAsync(id!);
        window.location.href = '/documents';
      } catch (error) {
        console.error('Delete failed:', error);
      }
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="w-48 h-8 mb-2" />
            <Skeleton className="w-64 h-4" />
          </div>
          <Button variant="outline" disabled><Skeleton className="w-20 h-8" /></Button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <Card key={i}><CardContent className="p-6"><Skeleton className="h-32" /></CardContent></Card>
          ))}
        </div>
        <Card><CardContent className="p-6"><Skeleton className="h-64" /></CardContent></Card>
      </div>
    );
  }

  if (error || !document) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="w-12 h-12 text-neutral-800 mx-auto mb-4" />
        <h2 className="text-xl font-semibold">Document not found</h2>
        <p className="text-muted-foreground mt-2">{error?.message ?? 'Unknown error'}</p>
        <Button onClick={() => window.location.href = '/documents'} className="mt-4">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Documents
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link to="/documents" className="p-2 hover:bg-accent rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-3xl font-bold">{document.originalName}</h1>
            <p className="text-muted-foreground">{document.mimeType} • {document.filename}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={document.status} />
          <Button variant="outline" asChild>
            <Link to={`/graph/${document.id}`}>
              <GitGraph className="w-4 h-4 mr-2" />
              View Graph
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to={`/chat?doc=${document.id}`}>
              <MessageSquare className="w-4 h-4 mr-2" />
              Chat
            </Link>
          </Button>
          <Button variant="outline" onClick={handleDelete} className="text-neutral-900 hover:bg-neutral-100">
            <Settings className="w-4 h-4 mr-2" />
            Delete
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Overview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <MetadataRow label="Document ID" value={document.id} />
            <MetadataRow label="Status" value={document.status} />
            <MetadataRow label="Judge Score" value={document.judgeScore !== null ? `${Math.round(document.judgeScore * 100)}%` : undefined} />
            <MetadataRow label="File Type" value={document.mimeType} />
            <MetadataRow label="File Name" value={document.filename} />
            <MetadataRow label="Uploaded" value={new Date(document.createdAt).toLocaleString()} />
            <MetadataRow label="Updated" value={new Date(document.updatedAt).toLocaleString()} />
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">Judge Evaluation</CardTitle>
          </CardHeader>
          <CardContent>
            <JudgeInfo document={document} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Chunks ({document.chunks?.length ?? 0})</CardTitle>
        </CardHeader>
        <CardContent>
          <ChunksList chunks={document.chunks ?? []} />
        </CardContent>
      </Card>
    </div>
  );
}