"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { select } from "d3-selection";
import { zoom as d3Zoom, zoomIdentity } from "d3-zoom";
import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
  forceCollide,
} from "d3-force";
import { drag as d3Drag } from "d3-drag";
import { useRouter } from "next/navigation";

type GraphNode = {
  id: string;
  title: string;
  path: string;
  isDoc: boolean;
  domain: string;
  linkCount: number;
  x?: number;
  y?: number;
  fx?: number | null;
  fy?: number | null;
};

type GraphLink = {
  source: string | GraphNode;
  target: string | GraphNode;
  text: string;
};

type Props = {
  initialLinks?: Record<string, { source: string; sourceTitle: string; target: string; text: string }[]>;
  initialBacklinks?: Record<string, { source: string; sourceTitle: string; text: string }[]>;
  highlightId?: string;
  height?: number;
};

const DOMAIN_COLORS: Record<string, string> = {
  "02": "#2f8f68",
  "03": "#4b7a9f",
  "04": "#c5892f",
  "05": "#7fb2dd",
  "06": "#b95852",
  "07": "#6ab59d",
  "08": "#e0b05e",
  "09": "#5e6a66",
  _archive: "#8a7faa",
  _knowledge: "#7b857f",
};

const DOMAIN_LABELS: Record<string, string> = {
  "02": "医疗健康",
  "03": "育儿成长",
  "04": "家庭日常",
  "05": "资产管理",
  "06": "事件记录",
  "07": "家庭规划",
  "08": "家庭文化",
  "09": "知识备忘",
  _archive: "档案",
  _knowledge: "知识库",
};

function getDomain(path: string): string {
  const m = path.match(/^_(?:knowledge|archive)\/(\d+)/);
  if (m) return m[1];
  if (path.startsWith("_archive")) return "_archive";
  if (path.startsWith("_knowledge")) return "_knowledge";
  return "other";
}

function getDomainColor(domain: string): string {
  return DOMAIN_COLORS[domain] || "#7b857f";
}

function getDomainLabel(domain: string): string {
  return DOMAIN_LABELS[domain] || domain;
}

export function KnowledgeGraph({ initialLinks, highlightId, height = 520 }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const router = useRouter();
  const [data, setData] = useState<{ nodes: GraphNode[]; links: GraphLink[] } | null>(null);
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);
  const [loading, setLoading] = useState(!initialLinks);

  const buildGraph = useCallback((links: Record<string, { source: string; sourceTitle: string; target: string; text: string }[]>) => {
    const nodeMap = new Map<string, GraphNode>();
    const linkList: GraphLink[] = [];
    const linkCount = new Map<string, number>();

    for (const sourceId of Object.keys(links)) {
      for (const link of links[sourceId]) {
        const sourcePath = link.source;
        const targetPath = link.target;

        const sourceIsDoc = sourcePath.startsWith("_knowledge/") || sourcePath.startsWith("_archive/");
        const targetIsDoc = targetPath.startsWith("_knowledge/") || targetPath.startsWith("_archive/");

        if (!sourceIsDoc && !targetIsDoc) continue;

        const sourceDomain = getDomain(sourcePath);
        const targetDomain = getDomain(targetPath);

        if (!nodeMap.has(sourcePath)) {
          nodeMap.set(sourcePath, {
            id: sourcePath,
            title: link.sourceTitle,
            path: sourcePath,
            isDoc: sourceIsDoc,
            domain: sourceDomain,
            linkCount: 0,
          });
        }
        if (!nodeMap.has(targetPath)) {
          nodeMap.set(targetPath, {
            id: targetPath,
            title: targetPath.split("/").pop()?.replace(/\.md$/, "") || targetPath,
            path: targetPath,
            isDoc: targetIsDoc,
            domain: targetDomain,
            linkCount: 0,
          });
        }

        linkCount.set(targetPath, (linkCount.get(targetPath) || 0) + 1);
        linkCount.set(sourcePath, (linkCount.get(sourcePath) || 0) + 1);

        linkList.push({ source: sourcePath, target: targetPath, text: link.text });
      }
    }

    for (const [id, count] of linkCount) {
      const node = nodeMap.get(id);
      if (node) node.linkCount = count;
    }

    const nodes = Array.from(nodeMap.values());
    return { nodes, links: linkList };
  }, []);

  useEffect(() => {
    if (initialLinks) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setData(buildGraph(initialLinks));
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLoading(false);
      return;
    }

    fetch("/api/links")
      .then((r) => r.json())
      .then((json) => {
        setData(buildGraph(json.links || {}));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [initialLinks, buildGraph]);

  useEffect(() => {
    if (!data || !svgRef.current) return;

    const svg = select(svgRef.current);
    const width = svgRef.current.clientWidth;
    const h = height;

    svg.selectAll("*").remove();

    const g = svg.append("g");

    const zoom = d3Zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.2, 4])
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
      });

    svg.call(zoom);

    const simulation = forceSimulation<GraphNode>(data.nodes)
      .force("link", forceLink<GraphNode, GraphLink>(data.links)
        .id((d) => d.id)
        .distance(80)
        .strength(0.3))
      .force("charge", forceManyBody().strength(-180))
      .force("center", forceCenter(width / 2, h / 2))
      .force("collision", forceCollide().radius(20));

    const link = g.append("g")
      .selectAll<SVGLineElement, GraphLink>("line")
      .data(data.links)
      .join("line")
      .attr("stroke", "var(--family-border)")
      .attr("stroke-width", 0.8)
      .attr("stroke-opacity", 0.4);

    const node = g.append("g")
      .selectAll<SVGGElement, GraphNode>("g")
      .data(data.nodes)
      .join("g")
      .style("cursor", "pointer")
      .call(
        d3Drag<SVGGElement, GraphNode>()
          .on("start", (event, d) => {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
          })
          .on("drag", (event, d) => {
            d.fx = event.x;
            d.fy = event.y;
          })
          .on("end", (event, d) => {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null;
            d.fy = null;
          })
      );

    node.append("circle")
      .attr("r", (d) => Math.max(5, Math.min(14, 4 + Math.sqrt(d.linkCount) * 2.5)))
      .attr("fill", (d) => getDomainColor(d.domain))
      .attr("stroke", "#fff")
      .attr("stroke-width", 1.2)
      .attr("opacity", 0.85);

    node.append("title")
      .text((d) => `${d.title}\n${d.domain === "other" ? "" : getDomainLabel(d.domain)}${d.linkCount > 0 ? ` · ${d.linkCount} 连接` : ""}`);

    node.on("mouseenter", function (event, d) {
      setHoveredNode(d);
      select(this).select("circle")
        .transition().duration(200)
        .attr("opacity", 1)
        .attr("stroke", "var(--family-primary)")
        .attr("stroke-width", 2.5);
      link
        .attr("stroke-opacity", (l) => {
          const src = typeof l.source === "object" ? l.source.id : l.source;
          const tgt = typeof l.target === "object" ? l.target.id : l.target;
          return src === d.id || tgt === d.id ? 0.8 : 0.05;
        })
        .attr("stroke-width", (l) => {
          const src = typeof l.source === "object" ? l.source.id : l.source;
          const tgt = typeof l.target === "object" ? l.target.id : l.target;
          return src === d.id || tgt === d.id ? 2 : 0.4;
        });
    });

    node.on("mouseleave", function () {
      setHoveredNode(null);
      select(this).select("circle")
        .transition().duration(200)
        .attr("opacity", 0.85)
        .attr("stroke", "#fff")
        .attr("stroke-width", 1.2);
      link
        .attr("stroke-opacity", 0.3)
        .attr("stroke-width", 0.8);
    });

    node.on("click", function (event, d) {
      let docPath = d.path;
      if (docPath.startsWith("_knowledge/") || docPath.startsWith("_archive/")) {
        if (!docPath.endsWith(".md")) {
          docPath += ".md";
        }
        router.push(`/doc?path=${encodeURIComponent(docPath)}`);
      }
    });

    if (highlightId) {
      const hlNode = data.nodes.find((n) => n.id === highlightId);
      if (hlNode) {
        const r = Math.max(8, Math.min(20, 6 + Math.sqrt(hlNode.linkCount) * 3));
        select(svgRef.current).selectAll("circle")
          .filter((d: unknown) => (d as GraphNode).id === highlightId)
          .attr("r", r)
          .attr("stroke", "var(--family-primary)")
          .attr("stroke-width", 3);

        setTimeout(() => {
          const tx = width / 2 - (hlNode.x || 0);
          const ty = h / 2 - (hlNode.y || 0);
          svg.transition().duration(750).call(
            zoom.transform,
            zoomIdentity.translate(tx, ty).scale(1.5)
          );
        }, 500);
      }
    }

    simulation.on("tick", () => {
      link
        .attr("x1", (l) => (typeof l.source === "object" ? l.source.x! : 0))
        .attr("y1", (l) => (typeof l.source === "object" ? l.source.y! : 0))
        .attr("x2", (l) => (typeof l.target === "object" ? l.target.x! : 0))
        .attr("y2", (l) => (typeof l.target === "object" ? l.target.y! : 0));
      node.attr("transform", (d) => `translate(${d.x},${d.y})`);
    });

    return () => {
      simulation.stop();
    };
  }, [data, height, router, highlightId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center" style={{ height, color: "var(--family-text-3)" }}>
        <span className="text-xs">加载知识图谱…</span>
      </div>
    );
  }

  if (!data || data.nodes.length === 0) {
    return (
      <div className="flex items-center justify-center" style={{ height, color: "var(--family-text-3)" }}>
        <span className="text-xs">暂无关联数据</span>
      </div>
    );
  }

  const domainSet = new Set(data.nodes.map((n) => n.domain));

  return (
    <div className="relative">
      <svg
        ref={svgRef}
        width="100%"
        height={height}
        style={{
          display: "block",
          borderRadius: 12,
          background: "var(--family-surface)",
        }}
      />
      <div className="flex flex-wrap gap-2 px-3 pb-2" style={{ marginTop: -8 }}>
        {Array.from(domainSet).filter((d) => d !== "other").map((domain) => (
          <span
            key={domain}
            className="inline-flex items-center gap-1 text-xs"
            style={{ color: "var(--family-text-3)" }}
          >
            <span
              className="inline-block rounded-full"
              style={{ width: 8, height: 8, background: getDomainColor(domain) }}
            />
            {getDomainLabel(domain)}
          </span>
        ))}
        <span className="text-xs" style={{ color: "var(--family-text-3)" }}>
          · 拖拽可移动 · 滚轮缩放 · 点击节点跳转
        </span>
      </div>
      {hoveredNode && (
        <div
          className="absolute rounded-lg border px-3 py-2 shadow-sm"
          style={{
            top: 8,
            right: 8,
            background: "var(--family-surface)",
            borderColor: "var(--family-border)",
            maxWidth: 260,
            zIndex: 10,
          }}
        >
          <div className="text-xs font-semibold mb-1" style={{ color: "var(--family-text)" }}>
            {hoveredNode.title}
          </div>
          <div className="flex items-center gap-2 text-xs" style={{ color: "var(--family-text-3)" }}>
            <span
              className="inline-block rounded-full"
              style={{ width: 6, height: 6, background: getDomainColor(hoveredNode.domain) }}
            />
            {getDomainLabel(hoveredNode.domain)}
            {hoveredNode.linkCount > 0 && <span>· {hoveredNode.linkCount} 连接</span>}
          </div>
        </div>
      )}
    </div>
  );
}
