"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft } from "@phosphor-icons/react";
import { useBoxGraph } from "@/hooks/useApi";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";

function shortName(name: string) {
  return name.length > 28 ? `${name.slice(0, 27)}…` : name;
}

function GraphCanvas({
  nodes,
  edges,
  onSelect,
}: {
  nodes: Array<{ id: string; name: string; isRule: boolean; status: string }>;
  edges: Array<{ source: string; target: string; similarity: number }>;
  onSelect: (id: string | null) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<any>(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  const elements = useMemo(() => {
    const degree = new Map<string, number>();
    for (const e of edges) {
      degree.set(e.source, (degree.get(e.source) ?? 0) + 1);
      degree.set(e.target, (degree.get(e.target) ?? 0) + 1);
    }
    return [
      ...nodes.map((n) => ({
        data: {
          id: n.id,
          name: shortName(n.name),
          isRule: n.isRule ? "yes" : "no",
          degree: degree.get(n.id) ?? 0,
        },
      })),
      ...edges.map((e, i) => ({
        data: {
          id: `e${i}`,
          source: e.source,
          target: e.target,
          similarity: e.similarity,
          label: `${Math.round(e.similarity * 100)}%`,
        },
      })),
    ];
  }, [nodes, edges]);

  // Create once; update elements on data change; destroy on unmount
  useEffect(() => {
    const container = containerRef.current;
    if (!container || cyRef.current) return;
    let disposed = false;

    (async () => {
      const cytoscape = (await import("cytoscape")).default;
      const cola = (await import("cytoscape-cola")).default;
      cytoscape.use(cola);
      if (disposed || !containerRef.current) return;

      const cy = cytoscape({
        container: containerRef.current,
        elements,
        style: [
          {
            selector: "node",
            style: {
              label: "data(name)",
              "text-valign": "bottom",
              "text-halign": "center",
              "font-size": "9px",
              color: "#d4d4d8",
              "text-outline-width": 2,
              "text-outline-color": "#09090b",
              "background-color": "#71717a",
              width: "mapData(degree, 0, 20, 14, 48)",
              height: "mapData(degree, 0, 20, 14, 48)",
            },
          },
          {
            selector: 'node[isRule = "yes"]',
            style: {
              "background-color": "#f59e0b",
              shape: "ellipse",
            },
          },
          {
            selector: "node:selected",
            style: {
              "border-color": "#fafafa",
              "border-width": 2,
            },
          },
          {
            selector: "edge",
            style: {
              width: "mapData(similarity, 0.45, 1, 1, 3)",
              "line-color": "#52525b",
              "curve-style": "bezier",
              opacity: 0.55,
            },
          },
        ],
        layout: {
          name: "cola",
          animate: true,
          refresh: 1,
          maxSimulationTime: 4000,
          infinite: true,
          fit: true,
          padding: 80,
          randomize: true,
          avoidOverlap: true,
          nodeDimensionsIncludeLabels: true,
          nodeRepulsion: 400000,
          idealLinkDistance: 420,
          edgeElasticity: 32,
          gravity: true,
        } as any,
      });

      cy.on("tap", "node", (evt: any) => onSelectRef.current(evt.target.id()));
      cy.on("tap", (evt: any) => {
        if (evt.target === cy) onSelectRef.current(null);
      });

      cyRef.current = cy;
    })();

    return () => {
      disposed = true;
      if (cyRef.current) {
        cyRef.current.destroy();
        cyRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Push data updates into the live instance
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;
    cy.batch(() => {
      cy.elements().remove();
      cy.add(elements);
    });
  }, [elements]);

  return <div ref={containerRef} className="h-[600px] w-full rounded-lg" />;
}

export default function BoxGraphPage() {
  const params = useParams();
  const router = useRouter();
  const boxId = params?.id as string;
  const { data: graph, isLoading, error } = useBoxGraph(boxId);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-[600px] w-full" />
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

  const nodes = graph?.nodes ?? [];
  const edges = graph?.edges ?? [];
  const selected = nodes.find((n) => n.id === selectedId);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" asChild>
          <Link href={`/boxes/${boxId}`}>
            <ArrowLeft className="w-4 h-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl">Box Graph</h1>
          <p className="text-muted-foreground">
            {nodes.length} files · {edges.length} vector links · amber circles
            are golden rules (.md)
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <Card className="lg:col-span-3">
          <CardContent className="p-2">
            <GraphCanvas nodes={nodes} edges={edges} onSelect={setSelectedId} />
          </CardContent>
        </Card>

        <Card className="lg:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Selected file</CardTitle>
            <CardDescription>
              Click a node to inspect — drag to rearrange
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {!selected ? (
              <p className="text-sm text-muted-foreground">No file selected.</p>
            ) : (
              <>
                <p className="text-sm font-medium break-words">
                  {selected.name}
                </p>
                <div className="flex flex-wrap gap-1">
                  <Badge variant="secondary">{selected.status}</Badge>
                  {selected.isRule && (
                    <Badge className="bg-amber-500/15 text-amber-400 border-transparent">
                      golden rule
                    </Badge>
                  )}
                </div>
                <Button
                  size="sm"
                  className="w-full"
                  onClick={() => router.push(`/documents/${selected.id}`)}
                >
                  Open document
                </Button>
                {edges.filter(
                  (e) => e.source === selected.id || e.target === selected.id,
                ).length > 0 && (
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">
                      Linked files
                    </p>
                    {edges
                      .filter(
                        (e) =>
                          e.source === selected.id || e.target === selected.id,
                      )
                      .slice(0, 5)
                      .map((e) => {
                        const otherId =
                          e.source === selected.id ? e.target : e.source;
                        const other = nodes.find((n) => n.id === otherId);
                        return (
                          <p
                            key={`${e.source}-${e.target}`}
                            className="text-xs truncate"
                          >
                            {other?.name ?? otherId} ·{" "}
                            {Math.round(e.similarity * 100)}%
                          </p>
                        );
                      })}
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
