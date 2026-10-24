"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Crosshair } from "@phosphor-icons/react";
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
import dynamic from "next/dynamic";
import type { SigmaGraphHandle } from "@/components/SigmaGraph";

const SigmaGraph = dynamic(
  () => import("@/components/SigmaGraph").then((m) => m.SigmaGraph),
  { ssr: false },
);

function shortName(name: string) {
  return name.length > 28 ? `${name.slice(0, 27)}…` : name;
}

const STATUS_COLORS: Record<string, string> = {
  completed: "#a78bfa",
  processing: "#60a5fa",
  pending: "#52525b",
  failed: "#f87171",
  rejected: "#a1a1aa",
};

export default function BoxGraphPage() {
  const params = useParams();
  const router = useRouter();
  const boxId = params?.id as string;
  const { data: graph, isLoading, error } = useBoxGraph(boxId);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const graphRef = useRef<SigmaGraphHandle>(null);

  const nodes = graph?.nodes ?? [];
  const edges = graph?.edges ?? [];

  const sigmaNodes = useMemo(
    () =>
      nodes.map((n) => ({
        id: n.id,
        label: shortName(n.name),
        color: STATUS_COLORS[n.status] ?? "#71717a",
        ringColor: n.isRule ? "#fbbf24" : undefined,
        data: n,
      })),
    [nodes],
  );

  const sigmaEdges = useMemo(
    () =>
      edges.map((e, i) => ({
        id: `e${i}`,
        source: e.source,
        target: e.target,
        label: `${Math.round(e.similarity * 100)}%`,
        weight: e.similarity,
      })),
    [edges],
  );

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
            {nodes.length} files · {edges.length} vector links · fill color =
            status · amber ring = golden rule (.md)
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="ml-auto"
          onClick={() => graphRef.current?.fit()}
          title="Fit graph to view"
        >
          <Crosshair className="w-4 h-4" />
          Recenter
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <Card className="lg:col-span-3">
          <CardContent className="p-2">
            <SigmaGraph
              ref={graphRef}
              nodes={sigmaNodes}
              edges={sigmaEdges}
              onSelect={setSelectedId}
              selectedId={selectedId}
            />
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
