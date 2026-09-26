"use client";

import Link from "next/link";
import { Graph } from "@phosphor-icons/react";
import { useBoxes } from "@/hooks/useApi";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

export default function GraphIndexPage() {
  const { data: boxes, isLoading } = useBoxes();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl">Graph</h1>
        <p className="text-muted-foreground">
          Pick a box to see its files and vector links, Obsidian-style
        </p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      ) : (boxes ?? []).length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No boxes yet. Create one first.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {(boxes ?? []).map((box) => (
            <Link key={box.id} href={`/boxes/${box.id}/graph`}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Graph className="w-5 h-5" />
                    {box.name}
                  </CardTitle>
                  {box.description && (
                    <CardDescription>{box.description}</CardDescription>
                  )}
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                  <Badge variant="secondary">{box.embeddingModel}</Badge>
                  <Badge variant="outline">{box.answerModel}</Badge>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
