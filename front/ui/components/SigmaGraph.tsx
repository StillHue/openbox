"use client";

import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from "react";

export interface SigmaNode {
  id: string;
  label: string;
  /** Base color; defaults to violet. */
  color?: string;
  /** Ring color (e.g. amber for golden rules); none by default. */
  ringColor?: string;
  /** Extra payload (kept outside the graph). */
  data?: unknown;
}

export interface SigmaEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  color?: string;
  weight?: number;
}

export interface SigmaGraphHandle {
  /** Animate the camera to fit all nodes. */
  fit: () => void;
  /** Animate the camera back to the initial view. */
  reset: () => void;
}

interface SigmaGraphProps {
  nodes: SigmaNode[];
  edges: SigmaEdge[];
  onSelect: (id: string | null) => void;
  selectedId?: string | null;
  height?: string;
}

const DEFAULT_NODE_COLOR = "#a78bfa";
const DEFAULT_EDGE_COLOR = "#71717a";
const SELECT_RING_COLOR = "#fafafa";
const FADED_COLOR = "#3a3a3a";

/**
 * Obsidian-style knowledge graph (Sigma.js + Graphology):
 * - WebGL rendering, ForceAtlas2 in a Web Worker running continuously
 * - Drag a node to move it (layout pauses, reheats on release)
 * - Hover a node to spotlight its neighborhood (others fade)
 * - Smooth camera transitions on select / double-click reset
 */
export const SigmaGraph = forwardRef<SigmaGraphHandle, SigmaGraphProps>(function SigmaGraph(
  { nodes, edges, onSelect, selectedId, height = "600px" },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sigmaRef = useRef<any>(null);
  const fitRef = useRef<() => void>(() => {});
  const resetRef = useRef<() => void>(() => {});
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const selectedRef = useRef<string | null>(selectedId ?? null);
  selectedRef.current = selectedId ?? null;
  const hoveredRef = useRef<string | null>(null);

  // Rebuild the renderer only when the graph's shape actually changes, not on
  // every new array identity from a refetch (which would re-settle the layout).
  const signature = useMemo(
    () => `${nodes.map((n) => n.id).join("|")}::${edges.map((e) => e.id).join("|")}`,
    [nodes, edges],
  );
  const latest = useRef({ nodes, edges, onSelect, selectedId: selectedId ?? null });
  latest.current = { nodes, edges, onSelect, selectedId: selectedId ?? null };

  useImperativeHandle(ref, () => ({
    fit: () => fitRef.current(),
    reset: () => resetRef.current(),
  }));

  // (Re)build the renderer when the graph shape changes.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const { nodes, edges } = latest.current;
    let disposed = false;
    let sigma: any = null;
    let draggedNode: string | null = null;
    let layoutOn = true;
    let fa2: any = null;
    let fa2Settings: any = null;

    const isNeighbor = (graph: any, a: string, b: string) =>
      a === b || graph.hasEdge(a, b) || graph.hasEdge(b, a);

    (async () => {
      const [{ default: Graph }, { default: Sigma }] = await Promise.all([
        import("graphology"),
        import("sigma"),
      ]);
      if (disposed || !containerRef.current) return;

      // Degrees drive Obsidian-style node sizing.
      const degree = new Map<string, number>();
      for (const e of edges) {
        degree.set(e.source, (degree.get(e.source) ?? 0) + 1);
        degree.set(e.target, (degree.get(e.target) ?? 0) + 1);
      }
      const maxDegree = Math.max(1, ...degree.values());

      const graph = new Graph({ type: "directed", multi: false, allowSelfLoops: false });
        const angleStep = (2 * Math.PI) / Math.max(1, nodes.length);
        // Seed on a small spiral so early frames don't overlap heavily.
        nodes.forEach((n, i) => {
          if (graph.hasNode(n.id)) return;
          const r = 12 + i * 1.2;
          graph.addNode(n.id, {
            label: n.label,
            color: n.color ?? DEFAULT_NODE_COLOR,
            ringColor: n.ringColor,
            degree: degree.get(n.id) ?? 0,
            maxDegree,
            x: Math.cos(i * angleStep) * r,
            y: Math.sin(i * angleStep) * r,
            size: 4,
          });
        });
        edges.forEach((e) => {
        if (!graph.hasNode(e.source) || !graph.hasNode(e.target)) return;
        if (graph.hasEdge(e.source, e.target)) return;
        graph.addEdge(e.source, e.target, {
          label: e.label,
          color: e.color ?? DEFAULT_EDGE_COLOR,
          size: 1,
          weight: e.weight ?? 1,
        });
      });

      const applyReducers = () => {
        const hovered = hoveredRef.current;
        const selected = selectedRef.current;
        // Hover spotlights the neighborhood; selection highlights incident edges.
        const focus = hovered ?? selected;
        sigma.setSetting("nodeReducer", (node: string, data: any) => {
          const d = data.degree / Math.max(1, data.maxDegree);
          const res: any = {
            ...data,
            size: 5 + d * 16,
            borderColor: (data as any).ringColor as string | undefined,
          };
          if (focus && !isNeighbor(graph, focus, node)) {
            res.color = FADED_COLOR;
            res.label = "";
          }
          if (selected === node) {
            res.highlighted = true;
            res.borderColor = SELECT_RING_COLOR;
            res.size += 3;
          }
          return res;
        });
        sigma.setSetting("edgeReducer", (edge: string, data: any) => {
          const res: any = { ...data };
          if (hovered) {
            if (!graph.hasExtremity(edge, hovered)) {
              res.hidden = true;
            } else {
              res.color = "#8b8b96";
              res.size = 2;
            }
          } else if (selected && (graph.source(edge) === selected || graph.target(edge) === selected)) {
            res.color = "#8b8b96";
            res.size = 2;
          }
          return res;
        });
        sigma.refresh();
      };

      sigma = new Sigma(graph, container, {
        // Labels fade in with zoom, like Obsidian.
        labelRenderedSizeThreshold: 9,
        labelColor: { color: "#e4e4e7" },
        labelWeight: "500",
        labelSize: 13,
        defaultNodeColor: DEFAULT_NODE_COLOR,
        defaultEdgeColor: DEFAULT_EDGE_COLOR,
        edgeLabelSize: 11,
        edgeLabelColor: { color: "#a1a1aa" },
        minCameraRatio: 0.05,
        maxCameraRatio: 4,
      });
      sigmaRef.current = sigma;
      applyReducers();

      const stopLayout = () => {
        layoutOn = false;
      };
      const startLayout = () => {
        layoutOn = true;
      };

      // Hover spotlight.
      sigma.on("enterNode", ({ node }: any) => {
        hoveredRef.current = node;
        applyReducers();
      });
      sigma.on("leaveNode", () => {
        hoveredRef.current = null;
        applyReducers();
      });

      // Select + smooth camera focus.
      sigma.on("clickNode", ({ node }: any) => {
        onSelectRef.current(node);
        const pos = graph.getNodeAttributes(node);
        sigma.getCamera().animate({ x: pos.x, y: pos.y, ratio: 0.8 }, { duration: 500 });
      });
      sigma.on("clickStage", () => onSelectRef.current(null));
      sigma.on("doubleClickStage", () => sigma.getCamera().animatedReset());

      // Drag with reheat: pause physics while dragging, resume on release.
      sigma.on("downNode", (e: any) => {
        draggedNode = e.node;
        stopLayout();
        graph.setNodeAttribute(draggedNode, "highlighted", true);
      });
      const captor = sigma.getMouseCaptor();
      captor.on("mousemovebody", (e: any) => {
        if (!draggedNode) return;
        const pos = sigma.viewportToGraph(e);
        graph.setNodeAttribute(draggedNode, "x", pos.x);
        graph.setNodeAttribute(draggedNode, "y", pos.y);
        sigma.refresh();
      });
      captor.on("mouseup", () => {
        if (!draggedNode) return;
        graph.removeNodeAttribute(draggedNode, "highlighted");
        draggedNode = null;
        startLayout();
        runLayout(REHEAT_ITERS);
      });

      // ForceAtlas2 computed to completion in one shot: the layout settles
      // before the first paint and never drifts afterwards. Dragging reheats
      // it briefly with a short synchronous run.
      const { default: forceAtlas2 } = await import("graphology-layout-forceatlas2");
      if (disposed) return;
      fa2 = forceAtlas2;
      fa2Settings = {
        ...fa2.inferSettings(graph),
        // Unbounded repulsion + strong gravity sends the layout to infinity
        // on sparse graphs; these keep it bounded and readable.
        strongGravityMode: false,
        gravity: 0.6,
        scalingRatio: 3,
        slowDown: 6,
        barnesHutOptimize: false,
        adjustSizes: true,
      };
      const SETTLE_ITERS = 300;
      const REHEAT_ITERS = 60;
      const runLayout = (iterations: number) => {
        try {
          fa2.assign(graph, { iterations, settings: fa2Settings });
        } catch {
          // ignore layout failure; the seed positions still render
        }
        try {
          sigma.refresh();
        } catch {
          // ignore repaint failure
        }
      };
      const fitCamera = (animate = true) => {
        try {
          const camera = sigma.getCamera();
          if (animate) camera.animatedFit({ duration: 600, padding: 40 });
          else camera.fit({ padding: 40 });
        } catch {
          // ignore fit failure
        }
      };
      fitRef.current = () => fitCamera(true);
      resetRef.current = () => fitCamera(true);

      // Settle first, then frame it.
      runLayout(SETTLE_ITERS);
      fitCamera(false);
    })();

    return () => {
      disposed = true;
      try {
        sigmaRef.current?.kill();
      } catch {
        // ignore teardown errors
      }
      sigmaRef.current = null;
    };
  }, [signature]);

  // Repaint reducers on selection change.
  useEffect(() => {
    sigmaRef.current?.refresh();
  }, [selectedId]);

  // Sync cosmetic attributes (label/color) without rebuilding the layout.
  useEffect(() => {
    const sigma = sigmaRef.current;
    if (!sigma) return;
    const graph = sigma.getGraph();
    let changed = false;
    for (const n of nodes) {
      if (!graph.hasNode(n.id)) continue;
      if (graph.getNodeAttribute(n.id, "label") !== n.label) {
        graph.setNodeAttribute(n.id, "label", n.label);
        changed = true;
      }
      if (n.color && graph.getNodeAttribute(n.id, "color") !== n.color) {
        graph.setNodeAttribute(n.id, "color", n.color);
        changed = true;
      }
    }
    if (changed) sigma.refresh();
  }, [nodes]);

  return <div ref={containerRef} style={{ height, width: "100%" }} className="rounded-lg bg-zinc-950" />;
});
