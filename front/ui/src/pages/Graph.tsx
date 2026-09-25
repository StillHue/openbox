import { useEffect, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, GitGraph, ZoomIn, ZoomOut, RotateCcw, X, AlertCircle } from 'lucide-react';
import { useGraph, useSearchNodes } from '@/hooks/useApi';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import type { Node, Edge, GraphResponse } from '@/types';

const NODE_TYPES = [
  'Person', 'Organization', 'Location', 'Concept', 'Event',
  'Product', 'Technology', 'Project', 'Document', 'Date', 'Money', 'Other'
] as const;

const nodeTypeColors: Record<string, string> = {
  Person: '#09090a',
  Organization: '#27272a',
  Location: '#3f3f46',
  Concept: '#52525b',
  Event: '#636366',
  Product: '#71717a',
  Technology: '#81818a',
  Project: '#8e8e96',
  Document: '#64748b',
  Date: '#a1a1aa',
  Money: '#b6b6bc',
  Other: '#d4d4d8',
};

function GraphCanvas({
  nodes,
  edges,
  selectedNodeId,
  onNodeSelect,
  onBackgroundClick
}: {
  nodes: Node[];
  edges: Edge[];
  selectedNodeId: string | null;
  onNodeSelect: (id: string | null) => void;
  onBackgroundClick: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<cytoscape.Core | null>(null);

  useEffect(() => {
    if (!containerRef.current || cyRef.current) return;

    // Dynamic import to avoid SSR issues
    import('cytoscape').then((cytoscape) => {
      import('cytoscape-cose-bilkent').then(() => {
        import('cytoscape-fcose').then(() => {
          const cy = cytoscape.default({
            container: containerRef.current!,
            elements: [
              ...nodes.map((n) => ({
                data: {
                  id: n.id,
                  label: n.name,
                  type: n.type,
                  description: n.description,
                  confidence: n.confidence,
                },
                classes: `node-type-${n.type.toLowerCase()}`,
              })),
              ...edges.map((e) => ({
                data: {
                  id: e.id,
                  source: e.sourceId,
                  target: e.targetId,
                  label: e.type,
                  type: e.type,
                  confidence: e.confidence,
                },
                classes: 'edge',
              })),
            ],
            style: [
              {
                selector: 'node',
                style: {
                  'label': 'data(label)',
                  'text-valign': 'bottom',
                  'text-halign': 'center',
                  'font-size': '10px',
                  'font-family': 'Inter, system-ui, sans-serif',
                  'color': '#09090a',
                  'text-outline-width': 2,
                  'text-outline-color': '#ffffff',
                  'background-color': (ele: any) => nodeTypeColors[ele.data('type')] || '#94a3b8',
                  'width': 'mapData(confidence, 0, 1, 20, 60)',
                  'height': 'mapData(confidence, 0, 1, 20, 60)',
                  'border-width': (ele: any) => ele.data('id') === selectedNodeId ? 3 : 1,
                  'border-color': (ele: any) => ele.data('id') === selectedNodeId ? '#09090a' : '#ffffff',
                  'border-opacity': 1,
                },
              },
              {
                selector: 'edge',
                style: {
                  'label': 'data(label)',
                  'font-size': '8px',
                  'font-family': 'Inter, system-ui, sans-serif',
                  'color': '#64748b',
                  'text-outline-width': 2,
                  'text-outline-color': '#ffffff',
                  'curve-style': 'bezier',
                  'target-arrow-shape': 'triangle',
                  'target-arrow-color': '#94a3b8',
                  'line-color': '#94a3b8',
                  'width': 'mapData(confidence, 0, 1, 1, 4)',
                  'opacity': 0.7,
                },
              },
              {
                selector: 'node:selected',
                style: {
                  'border-width': 3,
                  'border-color': '#09090a',
                  'border-opacity': 1,
                },
              },
              {
                selector: '.highlighted',
                style: {
                  'background-color': '#e4e4e7',
                  'border-color': '#52525b',
                  'border-width': 3,
                },
              },
              {
                selector: '.faded',
                style: {
                  'opacity': 0.3,
                },
              },
            ],
            layout: {
              name: 'fcose',
            },
            zoomingEnabled: true,
            userZoomingEnabled: true,
            boxSelectionEnabled: true,
            selectionType: 'single',
          });

          cyRef.current = cy;

          cy.on('tap', 'node', (event: any) => {
            const nodeId = event.target.data('id');
            onNodeSelect(nodeId);
          });

          cy.on('tap', (event: any) => {
            if (event.target === cy) {
              onBackgroundClick();
            }
          });

          cy.on('cxttap', 'node', (event: any) => {
            event.target.select();
            onNodeSelect(event.target.data('id'));
          });

        });
      });
    });

    return () => {
      if (cyRef.current) {
        cyRef.current.destroy();
        cyRef.current = null;
      }
    };
  }, []); // Only run once on mount

  // Update elements when nodes/edges change
  useEffect(() => {
    if (!cyRef.current) return;

    const cy = cyRef.current;
    const currentNodes = cy.nodes().map((n: any) => n.data('id'));
    const currentEdges = cy.edges().map((e: any) => e.data('id'));
    const newNodeIds = nodes.map((n) => n.id);
    const newEdgeIds = edges.map((e) => e.id);

    // Remove old elements
    const nodesToRemove = currentNodes.filter((id: string) => !newNodeIds.includes(id));
    const edgesToRemove = currentEdges.filter((id: string) => !newEdgeIds.includes(id));

    if (nodesToRemove.length > 0) cy.remove(`#${nodesToRemove.join(', #')}`);
    if (edgesToRemove.length > 0) cy.remove(`#${edgesToRemove.join(', #')}`);

    // Add new nodes
    for (const node of nodes) {
      if (!currentNodes.includes(node.id)) {
        cy.add({
          group: 'nodes',
          data: {
            id: node.id,
            label: node.name,
            type: node.type,
            description: node.description,
            confidence: node.confidence,
          },
          classes: `node-type-${node.type.toLowerCase()}`,
        });
      }
    }

    // Add new edges
    for (const edge of edges) {
      if (!currentEdges.includes(edge.id)) {
        cy.add({
          group: 'edges',
          data: {
            id: edge.id,
            source: edge.sourceId,
            target: edge.targetId,
            label: edge.type,
            type: edge.type,
            confidence: edge.confidence,
          },
          classes: 'edge',
        });
      }
    }

    // Update styles for selection
    cy.nodes().forEach((n: any) => {
      n.style({
        'border-width': n.data('id') === selectedNodeId ? 3 : 1,
        'border-color': n.data('id') === selectedNodeId ? '#09090a' : '#ffffff',
      });
    });
  }, [nodes, edges, selectedNodeId]);

  // Handle zoom controls
  const zoomIn = () => cyRef.current?.zoom(cyRef.current.zoom() * 1.2);
  const zoomOut = () => cyRef.current?.zoom(cyRef.current.zoom() / 1.2);
  const resetView = () => {
    cyRef.current?.fit(undefined, 50);
    cyRef.current?.center();
  };

  return (
    <div className="relative">
      <div ref={containerRef} className="w-full h-[600px] bg-background rounded-lg border" />

      <div className="absolute bottom-4 right-4 flex flex-col gap-2 z-10">
        <Button variant="outline" size="icon" onClick={zoomIn} title="Zoom In">
          <ZoomIn className="w-4 h-4" />
        </Button>
        <Button variant="outline" size="icon" onClick={zoomOut} title="Zoom Out">
          <ZoomOut className="w-4 h-4" />
        </Button>
        <Button variant="outline" size="icon" onClick={resetView} title="Reset View">
          <RotateCcw className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

function NodePanel({ node, graph, onClose }: {
  node: Node | null;
  graph: GraphResponse | null;
  onClose: () => void;
}) {
  if (!node) return null;

  const connectedEdges = graph?.edges.filter(
    (e) => e.sourceId === node.id || e.targetId === node.id
  ) ?? [];

  const neighborIds = new Set<string>();
  connectedEdges.forEach((e) => {
    neighborIds.add(e.sourceId === node.id ? e.targetId : e.sourceId);
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[80vh]">
        <DialogHeader className="flex flex-row items-start justify-between">
          <div>
            <DialogTitle className="flex items-center gap-2">
              <span
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: nodeTypeColors[node.type] }}
              />
              {node.type}: {node.name}
            </DialogTitle>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {node.description && (
            <div>
              <h4 className="font-medium mb-1">Description</h4>
              <p className="text-sm text-muted-foreground">{node.description}</p>
            </div>
          )}

          <div>
            <h4 className="font-medium mb-1">Confidence</h4>
            <div className="w-full bg-muted rounded-full h-2">
              <div
                className="bg-primary h-2 rounded-full transition-all duration-300"
                style={{ width: `${node.confidence * 100}%` }}
              />
            </div>
            <p className="text-sm text-muted-foreground mt-1">{Math.round(node.confidence * 100)}%</p>
          </div>

          {Object.keys(node.properties).length > 0 && (
            <div>
              <h4 className="font-medium mb-1">Properties</h4>
              <dl className="grid grid-cols-2 gap-2 text-sm">
                {Object.entries(node.properties).map(([key, value]) => (
                  <div key={key}>
                    <dt className="text-muted-foreground capitalize">{key.replace(/_/g, ' ')}</dt>
                    <dd className="font-medium">{String(value)}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}

          <Separator />

          <div>
            <h4 className="font-medium mb-2">Connections ({connectedEdges.length})</h4>
            <div className="max-h-60 overflow-y-auto space-y-2">
              {connectedEdges.map((edge) => {
                const isOutgoing = edge.sourceId === node.id;
                const neighbor = graph?.nodes.find((n) => n.id === (isOutgoing ? edge.targetId : edge.sourceId));
                return (
                  <div key={edge.id} className="flex items-center gap-2 p-2 bg-muted rounded-lg">
                    <span
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: nodeTypeColors[neighbor?.type ?? 'Other'] }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {isOutgoing ? '→' : '←'} {neighbor?.name ?? 'Unknown'}
                      </p>
                      <p className="text-xs text-muted-foreground capitalize">{edge.type.toLowerCase().replace(/_/g, ' ')}</p>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {Math.round(edge.confidence * 100)}%
                    </Badge>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function Graph() {
  const { id } = useParams<{ id: string }>();
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchType, setSearchType] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'overview' | 'search' | 'paths'>('overview');

const handleTabChange = (value: string) => {
  setActiveTab(value as 'overview' | 'search' | 'paths');
};

  const { data: graph, isLoading, error } = useGraph(id!);
  const { data: searchResults } = useSearchNodes(id!, searchQuery, searchType || undefined, 20);

  const selectedNode = graph?.nodes.find((n) => n.id === selectedNodeId) ?? null;

  const handleNodeSelect = (nodeId: string | null) => {
    setSelectedNodeId(nodeId);
  };

  const handleBackgroundClick = () => {
    setSelectedNodeId(null);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="w-48 h-8 mb-2" />
            <Skeleton className="w-64 h-4" />
          </div>
        </div>
        <Card>
          <CardContent className="p-6">
            <Skeleton className="w-full h-[600px] rounded-lg" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !graph) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="w-12 h-12 text-neutral-800 mx-auto mb-4" />
        <h2 className="text-xl font-semibold">Graph not found</h2>
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
          <Link to={`/documents/${id}`} className="p-2 hover:bg-accent rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-3xl font-bold">Knowledge Graph</h1>
            <p className="text-muted-foreground">
              {graph.nodes.length} nodes, {graph.edges.length} edges
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild>
            <Link to={`/documents/${id}`}>
              <GitGraph className="w-4 h-4 mr-2" />
              Document Details
            </Link>
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="search">Search</TabsTrigger>
          <TabsTrigger value="paths">Paths</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            <div className="lg:col-span-3">
              <Card>
                <CardContent className="p-0">
                  <GraphCanvas
                    nodes={graph.nodes}
                    edges={graph.edges}
                    selectedNodeId={selectedNodeId}
                    onNodeSelect={handleNodeSelect}
                    onBackgroundClick={handleBackgroundClick}
                  />
                </CardContent>
              </Card>
            </div>

            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Legend</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {NODE_TYPES.map((type) => (
                    <div key={type} className="flex items-center gap-2">
                      <span
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: nodeTypeColors[type] }}
                      />
                      <span className="text-sm capitalize">{type}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Stats</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Nodes</span>
                    <span className="font-medium">{graph.nodes.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Edges</span>
                    <span className="font-medium">{graph.edges.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Node Types</span>
                    <span className="font-medium">{new Set(graph.nodes.map(n => n.type)).size}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Edge Types</span>
                    <span className="font-medium">{new Set(graph.edges.map(e => e.type)).size}</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          <NodePanel node={selectedNode} graph={graph} onClose={() => setSelectedNodeId(null)} />
        </TabsContent>

        <TabsContent value="search" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Search Nodes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input
                  placeholder="Search by name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex-1"
                />
                <Select value={searchType} onValueChange={setSearchType}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="All Types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All Types</SelectItem>
                    {NODE_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>{type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button onClick={() => { setSearchQuery(''); setSearchType(''); }} variant="outline">
                  <X className="w-4 h-4" />
                </Button>
              </div>

              {searchQuery && (
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {searchResults?.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">No nodes found</p>
                  ) : (
                    searchResults?.map((node) => (
                      <Button
                        key={node.id}
                        variant="outline"
                        className="w-full justify-start gap-3"
                        onClick={() => handleNodeSelect(node.id)}
                      >
                        <span
                          className="w-3 h-3 rounded-full flex-shrink-0"
                          style={{ backgroundColor: nodeTypeColors[node.type] }}
                        />
                        <div className="flex-1 text-left">
                          <p className="font-medium truncate">{node.name}</p>
                          <p className="text-xs text-muted-foreground capitalize">{node.type}</p>
                        </div>
                        <Badge variant="outline">{Math.round(node.confidence * 100)}%</Badge>
                      </Button>
                    ))
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="paths" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Find Paths</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Source Node</label>
                  <Select value={selectedNodeId || ''} onValueChange={(v) => { setSelectedNodeId(v); handleNodeSelect(v); }}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select source node" />
                    </SelectTrigger>
                    <SelectContent>
                      {graph.nodes.map((node) => (
                        <SelectItem key={node.id} value={node.id}>
                          {node.type}: {node.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium">Target Node</label>
                  <Select onValueChange={() => {}}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select target node" />
                    </SelectTrigger>
                    <SelectContent>
                      {graph.nodes.filter(n => n.id !== selectedNodeId).map((node) => (
                        <SelectItem key={node.id} value={node.id}>
                          {node.type}: {node.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                Path finding between nodes will be available once both source and target are selected.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}