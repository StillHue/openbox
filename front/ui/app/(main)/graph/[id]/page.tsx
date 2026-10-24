"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Crosshair } from "@phosphor-icons/react";
import { useParams } from "next/navigation";
import { useGraph, useSearchNodes } from "@/hooks/useApi";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import dynamic from "next/dynamic";
import type { Node } from "@/types";
import type { SigmaGraphHandle } from "@/components/SigmaGraph";

const SigmaGraph = dynamic(
  () => import("@/components/SigmaGraph").then((m) => m.SigmaGraph),
  { ssr: false },
);

const TYPE_COLORS: Record<string, string> = {
  Person: "#60a5fa",
  Organization: "#34d399",
  Location: "#fbbf24",
  Concept: "#a78bfa",
  Event: "#f472b6",
};

export default function GraphPage() {
  const params = useParams();
  const documentId = params?.id as string;
  const { data: graph, isLoading, error } = useGraph(documentId);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [searchType, setSearchType] = useState<string>("all");
  const graphRef = useRef<SigmaGraphHandle>(null);

  const { data: searchResults } = useSearchNodes(
    documentId,
    searchQuery,
    searchType === "all" ? undefined : searchType,
    20,
  );

  const sigmaNodes = useMemo(
    () =>
      (graph?.nodes ?? []).map((node) => ({
        id: node.id,
        label: node.name || `Node ${node.id.slice(0, 8)}`,
        color: TYPE_COLORS[node.type] ?? "#a78bfa",
        data: node,
      })),
    [graph],
  );

  const sigmaEdges = useMemo(
    () =>
      (graph?.edges ?? []).map((edge) => ({
        id: edge.id,
        source: edge.sourceId,
        target: edge.targetId,
        label: edge.type,
        color: edge.type === "reference" ? "#3b82f6" : "#8b5cf6",
      })),
    [graph],
  );

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
            <Skeleton className="h-64 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Error loading graph</AlertTitle>
        <AlertDescription>{error.message}</AlertDescription>
      </Alert>
    );
  }

  if (!graph || !graph.nodes || !graph.edges) {
    return (
      <Alert>
        <AlertTitle>No graph data available</AlertTitle>
        <AlertDescription>
          The document has not been processed into a graph yet.
        </AlertDescription>
      </Alert>
    );
  }

  const selectedNodeData = graph?.nodes?.find((n) => n.id === selectedNode);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" asChild>
          <Link href="/documents">
            <ArrowLeft className="w-4 h-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl">Graph Visualization</h1>
          <p className="text-muted-foreground">Document ID: {documentId}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <Card className="lg:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Graph Stats</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Nodes</p>
              <p className="text-2xl">{graph.nodes?.length || 0}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Edges</p>
              <p className="text-2xl">{graph.edges?.length || 0}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Density</p>
              <p className="text-2xl">
                {graph.nodes && graph.nodes.length > 0
                  ? ((graph.edges?.length || 0) / graph.nodes.length).toFixed(2)
                  : "0.00"}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Graph Explorer</CardTitle>
                <CardDescription>
                  Interactive knowledge graph of document entities and relationships
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => graphRef.current?.fit()}
                title="Fit graph to view"
              >
                <Crosshair className="w-4 h-4" />
                Recenter
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="graph" className="w-full">
              <TabsList>
                <TabsTrigger value="graph">Graph View</TabsTrigger>
                <TabsTrigger value="search">Search</TabsTrigger>
              </TabsList>
              <TabsContent value="graph" className="mt-4">
                <div className="h-[600px] w-full rounded-lg border overflow-hidden">
                  <SigmaGraph
                    ref={graphRef}
                    nodes={sigmaNodes}
                    edges={sigmaEdges}
                    onSelect={setSelectedNode}
                    selectedId={selectedNode}
                  />
                </div>
              </TabsContent>
              <TabsContent value="search" className="mt-4 space-y-4">
                <Input
                  placeholder="Search nodes..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full"
                />
                <Select         value={searchType}         onValueChange={setSearchType}>
                  <SelectTrigger>
                    <SelectValue placeholder="All types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All types</SelectItem>
                    <SelectItem value="entity">Entities</SelectItem>
                    <SelectItem value="concept">Concepts</SelectItem>
                    <SelectItem value="topic">Topics</SelectItem>
                  </SelectContent>
                </Select>
                {searchResults && (
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {searchResults.map((node: Node) => (
                      <Button
                        key={node.id}
                        variant="ghost"
                        className="w-full justify-start"
                        onClick={() => setSelectedNode(node.id)}
                      >
                        <div className="flex flex-col text-left">
                          <span className="font-medium">{node.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {node.type} - Confidence:{" "}
                            {Math.round(node.confidence * 100)}%
                          </span>
                        </div>
                      </Button>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      {selectedNodeData && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Selected Node</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">ID</p>
              <p className="text-sm font-mono">{selectedNodeData.id}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Name</p>
              <p className="text-lg font-semibold">{selectedNodeData.name}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Type</p>
              <Badge variant="outline">{selectedNodeData.type}</Badge>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Confidence</p>
              <div className="w-full bg-muted rounded-full h-2">
                <div
                  className="bg-primary h-2 rounded-full"
                  style={{ width: `${selectedNodeData.confidence * 100}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {Math.round(selectedNodeData.confidence * 100)}%
              </p>
            </div>
            {selectedNodeData.description && (
              <div>
                <p className="text-sm text-muted-foreground">Description</p>
                <p className="text-sm">{selectedNodeData.description}</p>
              </div>
            )}
            <div>
              <p className="text-sm text-muted-foreground">Properties</p>
              <pre className="text-xs bg-muted p-3 rounded-lg overflow-auto">
                {JSON.stringify(selectedNodeData.properties, null, 2)}
              </pre>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
