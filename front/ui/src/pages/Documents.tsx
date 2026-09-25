import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, FileText, Loader2, Trash2, Eye, AlertCircle, CheckCircle, Clock, GitGraph } from 'lucide-react';
import { useDocuments, useUploadDocument, useDeleteDocument } from '@/hooks/useApi';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { Document } from '@/types';

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

function DocumentRow({ document, onDelete }: { document: Document; onDelete: (id: string) => void }) {
  return (
    <TableRow className="hover:bg-accent/50 transition-colors">
      <TableCell className="font-medium">
        <Link to={`/documents/${document.id}`} className="text-primary hover:underline">
          {document.originalName}
        </Link>
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {document.mimeType}
      </TableCell>
      <TableCell>
        <StatusBadge status={document.status} />
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {document.judgeScore !== null ? (
          <>
            <span className={cn(
              document.judgeScore >= 0.7 ? 'text-neutral-900' :
              document.judgeScore >= 0.4 ? 'text-neutral-500' : 'text-neutral-400'
            )}>
              {Math.round(document.judgeScore * 100)}%
            </span>
          </>
        ) : (
          '-'
        )}
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {new Date(document.createdAt).toLocaleDateString()}
      </TableCell>
      <TableCell>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <span className="sr-only">Open menu</span>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                    </svg>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem asChild>
                    <Link to={`/documents/${document.id}`}>
                      <Eye className="w-4 h-4 mr-2" />
                      View Details
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to={`/graph/${document.id}`}>
                      <GitGraph className="w-4 h-4 mr-2" />
                      View Graph
                    </Link>
                  </DropdownMenuItem>
                  <Separator />
                  <DropdownMenuItem
                    onClick={() => onDelete(document.id)}
                    className="text-neutral-900 focus:text-neutral-900"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </TooltipTrigger>
            <TooltipContent>
              Actions
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </TableCell>
    </TableRow>
  );
}

function UploadDialog({ onClose }: { onClose: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const uploadMutation = useUploadDocument();

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
      await uploadMutation.mutateAsync(file);
      onClose();
      setFile(null);
    } catch (error) {
      console.error('Upload failed:', error);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Upload Document</DialogTitle>
          <DialogDescription>
            Drag and drop a file or click to select. Supports PDF, DOCX, TXT, MD, and more.
          </DialogDescription>
        </DialogHeader>

        <div
          className={cn(
            'border-2 border-dashed rounded-lg p-8 text-center transition-colors',
            dragActive ? 'border-primary bg-primary/5' : 'border-muted'
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
              'cursor-pointer flex flex-col items-center gap-4',
              file && 'opacity-50'
            )}
          >
            <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center">
              <FileText className="w-6 h-6 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium">
                {file ? file.name : 'Click to upload or drag and drop'}
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

        <div className="flex justify-end gap-2 mt-6">
          <Button variant="outline" onClick={onClose} disabled={uploadMutation.isPending}>
            Cancel
          </Button>
          <Button onClick={handleUpload} disabled={!file || uploadMutation.isPending}>
            {uploadMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Uploading...
              </>
            ) : (
              'Upload'
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function Documents() {
  const [search, setSearch] = useState('');
  const { data, isLoading, error, refetch } = useDocuments(50, 0);
  const deleteMutation = useDeleteDocument();

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this document?')) {
      try {
        await deleteMutation.mutateAsync(id);
        refetch();
      } catch (error) {
        console.error('Delete failed:', error);
      }
    }
  };

  const filteredDocuments = data?.documents?.filter((doc) =>
    doc.originalName.toLowerCase().includes(search.toLowerCase())
  ) ?? [];

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Documents</h1>
          <Button variant="outline" disabled>
            <Skeleton className="w-20 h-8" />
          </Button>
        </div>
        <Card>
          <CardContent className="p-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Judge Score</TableHead>
                  <TableHead>Uploaded</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="w-40 h-4" /></TableCell>
                    <TableCell><Skeleton className="w-24 h-4" /></TableCell>
                    <TableCell><Skeleton className="w-24 h-6" /></TableCell>
                    <TableCell><Skeleton className="w-20 h-4" /></TableCell>
                    <TableCell><Skeleton className="w-28 h-4" /></TableCell>
                    <TableCell><Skeleton className="w-8 h-8" /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="w-12 h-12 text-neutral-800 mx-auto mb-4" />
        <h2 className="text-xl font-semibold">Failed to load documents</h2>
        <p className="text-muted-foreground mt-2">{error.message}</p>
        <Button onClick={() => refetch()} className="mt-4">Retry</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Documents</h1>
          <p className="text-muted-foreground">Manage your document library</p>
        </div>
        <Dialog>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Upload Document
            </Button>
          </DialogTrigger>
          <UploadDialog onClose={() => {}} />
        </Dialog>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <CardTitle>All Documents ({data?.documents.length ?? 0})</CardTitle>
            <Input
              placeholder="Search documents..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full sm:w-64"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Judge Score</TableHead>
                <TableHead>Uploaded</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredDocuments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                    {search ? 'No documents match your search' : 'No documents yet. Upload your first document!'}
                  </TableCell>
                </TableRow>
              ) : (
                filteredDocuments.map((doc) => (
                  <DocumentRow key={doc.id} document={doc} onDelete={handleDelete} />
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}