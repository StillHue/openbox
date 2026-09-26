"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "@phosphor-icons/react";
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

const CytoscapeComponent = dynamic(() => import("react-cytoscapejs"), {
  ssr: false,
}) as any;

export default function GraphPage() {
  const params = useParams();
  const documentId = params?.id as string;
  const { data: graph, isLoading, error } = useGraph(documentId);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [searchType, setSearchType] = useState<string>("all");

  const { data: searchResults } = useSearchNodes(
    documentId,
    searchQuery,
    searchType === "all" ? undefined : searchType,
    20,
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

  const handleNodeClick = (event: any) => {
    if (event.target === event.cyTarget) {
      const node = event.target as any;
      setSelectedNode(node.id());
    }
  };

  const cyStyles: any[] = [
    {
      selector: "node",
      style: {
        label: "data(name)",
        "text-valign": "center",
        "text-halign": "center",
        "background-color": "#18181b",
        color: "#fafafa",
        "border-color": "#3f3f46",
        "border-width": "1px",
      },
    },
    {
      selector: "node[?type]",
      style: {
        shape: "data(shape)",
      },
    },
    {
      selector: "node:selected",
      style: {
        "border-color": "#000000",
        "border-width": "2px",
      },
    },
    {
      selector: "edge",
      style: {
        width: 2,
        "line-color": "#71717a",
        "curve-style": "bezier",
      },
    },
    {
      selector: "edge[?type]",
      style: {
        "line-color": "data(color)",
      },
    },
  ];

  const cyElements: any[] = [
    ...(graph.nodes || []).map((node) => ({
      data: {
        id: node.id,
        name: node.name || `Node ${node.id.slice(0, 8)}`,
        type: node.type,
        shape: node.type === "entity" ? "rectangle" : "ellipse",
        confidence: node.confidence,
        description: node.description,
      },
    })),
    ...(graph.edges || []).map((edge) => ({
      data: {
        id: edge.id,
        source: edge.sourceId,
        target: edge.targetId,
        type: edge.type,
        confidence: edge.confidence,
        color: edge.type === "reference" ? "#3b82f6" : "#8b5cf6",
      },
    })),
  ];

  const selectedNodeData = graph.nodes?.find((n) => n.id === selectedNode);

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
            <CardTitle className="text-base">Graph Explorer</CardTitle>
            <CardDescription>
              Interactive knowledge graph of document entities and relationships
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="graph" className="w-full">
              <TabsList>
                <TabsTrigger value="graph">Graph View</TabsTrigger>
                <TabsTrigger value="search">Search</TabsTrigger>
              </TabsList>
              <TabsContent value="graph" className="mt-4">
                <div className="h-[600px] w-full rounded-lg border">
                  <CytoscapeComponent
                    elements={cyElements}
                    cyStyle={cyStyles}
                    style={{ width: "100%", height: "100%" }}
                    layout={{ name: "cose-bilkent" }}
                    onTap={handleNodeClick}
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
