"use client";

import { useEffect, useRef, useState } from "react";

interface Entity {
  id: string;
  name: string;
  entityType: "AI" | "HUMAN";
  active: boolean;
  cdpAddress?: string;
  createdAt: number;
}

interface Relationship {
  id: string;
  observerAgentId: string;
  targetAgentId: string;
  relationshipSummary: string;
  trustScore: number;
  interactionCount: number;
  totalTransactionValue: string;
  lastInteractionAt: number | null;
  createdAt: number;
  updatedAt: number;
}

interface GraphData {
  success: boolean;
  entities: Entity[];
  relationships: Relationship[];
  timestamp: number;
}

interface NodePosition {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

interface Tooltip {
  visible: boolean;
  x: number;
  y: number;
  content: string;
  relationship?: Relationship;
}

// Color theme pool for entities (reusing from chat-container)
const COLOR_THEMES = [
  { bg: "fill-purple-500", border: "stroke-purple-300", text: "text-purple-100" },
  { bg: "fill-blue-500", border: "stroke-blue-300", text: "text-blue-100" },
  { bg: "fill-emerald-500", border: "stroke-emerald-300", text: "text-emerald-100" },
  { bg: "fill-amber-500", border: "stroke-amber-300", text: "text-amber-100" },
  { bg: "fill-rose-500", border: "stroke-rose-300", text: "text-rose-100" },
  { bg: "fill-cyan-500", border: "stroke-cyan-300", text: "text-cyan-100" },
  { bg: "fill-indigo-500", border: "stroke-indigo-300", text: "text-indigo-100" },
  { bg: "fill-teal-500", border: "stroke-teal-300", text: "text-teal-100" },
  { bg: "fill-orange-500", border: "stroke-orange-300", text: "text-orange-100" },
  { bg: "fill-pink-500", border: "stroke-pink-300", text: "text-pink-100" },
];

export function RelationshipGraph() {
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<Tooltip>({ visible: false, x: 0, y: 0, content: "" });
  const [lastUpdateTime, setLastUpdateTime] = useState<number>(0);

  const svgRef = useRef<SVGSVGElement>(null);
  const nodePositions = useRef<Map<string, NodePosition>>(new Map());
  const animationRef = useRef<number | undefined>();
  const entityThemes = useRef<Map<string, number>>(new Map());
  const simulationSteps = useRef<number>(0);
  const isStabilized = useRef<boolean>(false);
  const maxSimulationSteps = 300; // Stop simulation after this many steps
  const lastDataHash = useRef<string>("");

  // Create a hash of the graph data to detect changes
  const createDataHash = (data: GraphData): string => {
    // Create a deterministic string representation of the data
    const entitiesString = data.entities
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((e) => `${e.id}:${e.name}:${e.entityType}:${e.active}`)
      .join("|");

    const relationshipsString = data.relationships
      .sort((a, b) => a.id.localeCompare(b.id))
      .map(
        (r) =>
          `${r.id}:${r.observerAgentId}:${r.targetAgentId}:${r.trustScore}:${r.interactionCount}:${r.totalTransactionValue}`,
      )
      .join("|");

    // Simple hash function (djb2)
    const hashString = entitiesString + "||" + relationshipsString;
    let hash = 5381;
    for (let i = 0; i < hashString.length; i++) {
      hash = (hash << 5) + hash + hashString.charCodeAt(i);
    }
    return hash.toString();
  };

  // Get theme for an entity
  const getEntityTheme = (entityId: string) => {
    if (!entityThemes.current.has(entityId)) {
      const themeIndex = entityThemes.current.size % COLOR_THEMES.length;
      entityThemes.current.set(entityId, themeIndex);
    }
    const themeIndex = entityThemes.current.get(entityId) ?? 0;
    return COLOR_THEMES[Math.max(0, Math.min(themeIndex, COLOR_THEMES.length - 1))]!;
  };

  // Initialize node positions with deterministic layout (no randomness)
  const initializePositions = (entities: Entity[]) => {
    const width = 1200; // Much larger canvas
    const height = 800;
    const centerX = width / 2;
    const centerY = height / 2;

    entities.forEach((entity, index) => {
      if (!nodePositions.current.has(entity.id)) {
        // Arrange nodes in a larger circle initially with more spacing
        const angle = (index / entities.length) * 2 * Math.PI;
        const radius = Math.min(width, height) * 0.35; // Even larger initial radius

        // Use deterministic offset based on entity ID to avoid randomness
        const hash = entity.id.split("").reduce((a, b) => a + b.charCodeAt(0), 0);
        const offsetX = ((hash % 100) - 50) * 0.8; // -40 to +40 range
        const offsetY = (((hash * 17) % 100) - 50) * 0.8; // Different offset for Y

        nodePositions.current.set(entity.id, {
          x: centerX + Math.cos(angle) * radius + offsetX,
          y: centerY + Math.sin(angle) * radius + offsetY,
          vx: 0,
          vy: 0,
        });
      }
    });
  };

  // Simple force-directed layout simulation (runs for limited time)
  const updatePositions = () => {
    if (!graphData || isStabilized.current) return;

    const { entities, relationships } = graphData;
    const width = 1200; // Match larger canvas
    const height = 800;
    const centerX = width / 2;
    const centerY = height / 2;

    // Stop after enough steps
    if (simulationSteps.current >= maxSimulationSteps) {
      isStabilized.current = true;
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = undefined;
      }
      return;
    }

    // Reduce forces over time to help stabilize
    const progressRatio = simulationSteps.current / maxSimulationSteps;
    const forceMultiplier = Math.max(0.1, 1 - progressRatio);

    // Apply forces
    entities.forEach((entity) => {
      const pos = nodePositions.current.get(entity.id);
      if (!pos) return;

      // Extremely weak center force to keep nodes from drifting too far
      const centerForce = 0.0005 * forceMultiplier;
      pos.vx += (centerX - pos.x) * centerForce;
      pos.vy += (centerY - pos.y) * centerForce;

      // Stronger repulsion between nodes to prevent overlap
      entities.forEach((otherEntity) => {
        if (entity.id === otherEntity.id) return;
        const otherPos = nodePositions.current.get(otherEntity.id);
        if (!otherPos) return;

        const dx = pos.x - otherPos.x;
        const dy = pos.y - otherPos.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // Increased repulsion distance and force to maintain larger spacing
        if (distance > 0 && distance < 250) {
          const force = (600 / (distance * distance)) * forceMultiplier;
          pos.vx += (dx / distance) * force;
          pos.vy += (dy / distance) * force;
        }
      });

      // Much weaker attraction for connected nodes
      relationships.forEach((rel) => {
        let otherEntityId = null;
        if (rel.observerAgentId === entity.id) {
          otherEntityId = rel.targetAgentId;
        } else if (rel.targetAgentId === entity.id) {
          otherEntityId = rel.observerAgentId;
        }

        if (otherEntityId) {
          const otherPos = nodePositions.current.get(otherEntityId);
          if (!otherPos) return;

          const dx = otherPos.x - pos.x;
          const dy = otherPos.y - pos.y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          // Very weak attraction only for extremely distant nodes
          if (distance > 400) {
            const force = 0.001 * rel.trustScore * forceMultiplier;
            pos.vx += (dx / distance) * force;
            pos.vy += (dy / distance) * force;
          }
        }
      });

      // Strong damping to stabilize quickly
      pos.vx *= 0.92;
      pos.vy *= 0.92;

      // Update position
      pos.x += pos.vx;
      pos.y += pos.vy;

      // Keep within larger bounds
      const margin = 60;
      pos.x = Math.max(margin, Math.min(width - margin, pos.x));
      pos.y = Math.max(margin, Math.min(height - margin, pos.y));
    });

    simulationSteps.current++;
  };

  // Animation loop (stops automatically when stabilized)
  const animate = () => {
    updatePositions();
    if (!isStabilized.current) {
      animationRef.current = requestAnimationFrame(animate);
    }
  };

  // Fetch graph data from API
  const fetchGraphData = async () => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_INFINITE_BAZAAR_API_URL || "http://localhost:3104"}/api/relationships/graph`,
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data: GraphData = await response.json();

      if (data.success) {
        // Create hash of new data and compare with previous
        const newDataHash = createDataHash(data);

        // Only update if data has actually changed
        if (newDataHash !== lastDataHash.current) {
          console.log("Graph data changed, updating...", {
            oldHash: lastDataHash.current,
            newHash: newDataHash,
          });

          lastDataHash.current = newDataHash;
          setGraphData(data);
          setLastUpdateTime(Date.now());

          // Only initialize positions for new entities (prevents resetting existing ones)
          const hasNewEntities = data.entities.some(
            (entity) => !nodePositions.current.has(entity.id),
          );

          if (nodePositions.current.size === 0 || hasNewEntities) {
            initializePositions(data.entities);
            // If we have new entities and were stabilized, restart simulation briefly
            if (hasNewEntities && isStabilized.current && nodePositions.current.size > 0) {
              isStabilized.current = false;
              simulationSteps.current = 0;
              if (!animationRef.current) {
                animate();
              }
            }
          }
        } else {
          console.log("Graph data unchanged, skipping update");
        }

        setError(null);
      } else {
        setError("Failed to fetch graph data");
      }
    } catch (err) {
      console.error("Error fetching graph data:", err);
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  };

  // Polling setup
  useEffect(() => {
    fetchGraphData();

    // Set up polling every 5 seconds
    const interval = setInterval(fetchGraphData, 5000);

    return () => {
      clearInterval(interval);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  // Start animation only once when data is first loaded
  useEffect(() => {
    if (graphData && !animationRef.current && !isStabilized.current) {
      // Only start animation if not already stabilized
      simulationSteps.current = 0;
      animate();
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = undefined;
      }
    };
  }, [graphData]);

  // Handle edge click for tooltip
  const handleEdgeClick = (event: React.MouseEvent, relationship: Relationship) => {
    const containerRect = svgRef.current?.parentElement?.getBoundingClientRect();
    if (!containerRect) return;

    setTooltip({
      visible: true,
      x: event.clientX - containerRect.left,
      y: event.clientY - containerRect.top,
      content: relationship.relationshipSummary,
      relationship,
    });
  };

  // Hide tooltip
  const hideTooltip = () => {
    setTooltip({ visible: false, x: 0, y: 0, content: "" });
  };

  if (error) {
    return (
      <div className="flex h-full flex-col">
        <div className="border-white/10 border-b bg-black/20 p-4 backdrop-blur-sm">
          <h3 className="font-semibold text-base text-white">Agent Relationships</h3>
        </div>
        <div className="flex flex-1 items-center justify-center p-4">
          <div className="text-center">
            <div className="text-red-400 text-sm">Error: {error}</div>
            <button
              type="button"
              onClick={() => {
                setError(null);
                setIsLoading(true);
                fetchGraphData();
              }}
              className="mt-2 rounded bg-purple-600 px-2 py-1 text-white text-xs hover:bg-purple-700"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-white/10 border-b bg-black/20 p-4 backdrop-blur-sm">
        <h3 className="font-semibold text-base text-white">Agent Relationships</h3>
        <p className="text-slate-400 text-xs">
          {isLoading
            ? "Loading..."
            : `${graphData?.entities.length || 0} entities, ${graphData?.relationships.length || 0} relationships`}
          {!isLoading && !isStabilized.current && (
            <span className="ml-2 text-yellow-400">• Stabilizing layout...</span>
          )}
          {!isLoading && isStabilized.current && (
            <span className="ml-2 text-green-400">• Layout stable</span>
          )}
          {!isLoading && lastUpdateTime > 0 && (
            <span className="ml-2 text-blue-400">
              • Last change: {new Date(lastUpdateTime).toLocaleTimeString()}
            </span>
          )}
        </p>
      </div>

      {/* Graph */}
      <div className="relative flex-1 overflow-auto">
        {isLoading ? (
          <div className="flex h-full items-center justify-center">
            <div className="text-slate-400 text-sm">Loading graph...</div>
          </div>
        ) : !graphData || graphData.entities.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <div className="text-center text-slate-400">
              <div className="text-sm">No entities found</div>
              <div className="text-xs">Waiting for agent activity...</div>
            </div>
          </div>
        ) : (
          <>
            <div
              className="min-w-[1200px] min-h-[800px] w-full h-full"
              onClick={hideTooltip}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  hideTooltip();
                }
              }}
              tabIndex={0}
              role="button"
              aria-label="Graph area - click or press Escape to close tooltip"
            >
              <svg ref={svgRef} className="w-[1200px] h-[800px]" viewBox="0 0 1200 800">
                {/* Edges (relationships) */}
                {graphData.relationships.map((relationship) => {
                  const sourcePos = nodePositions.current.get(relationship.observerAgentId);
                  const targetPos = nodePositions.current.get(relationship.targetAgentId);

                  if (!sourcePos || !targetPos) return null;

                  const opacity = Math.max(0.2, relationship.trustScore);
                  const strokeWidth = Math.max(1, relationship.trustScore * 3);

                  return (
                    <g key={relationship.id}>
                      {/* Edge line */}
                      <line
                        x1={sourcePos.x}
                        y1={sourcePos.y}
                        x2={targetPos.x}
                        y2={targetPos.y}
                        stroke="#00ddeb"
                        strokeWidth={strokeWidth}
                        opacity={opacity}
                        className="cursor-pointer hover:opacity-100"
                        onClick={(e) => handleEdgeClick(e, relationship)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            handleEdgeClick(e as any, relationship);
                          }
                        }}
                        tabIndex={0}
                        role="button"
                        aria-label={`Relationship between ${relationship.observerAgentId} and ${relationship.targetAgentId}`}
                      />

                      {/* Transaction value label */}
                      <text
                        x={(sourcePos.x + targetPos.x) / 2}
                        y={(sourcePos.y + targetPos.y) / 2 - 5}
                        fill="#00ddeb"
                        fontSize="10"
                        textAnchor="middle"
                        className="pointer-events-none select-none"
                      >
                        ${Number.parseFloat(relationship.totalTransactionValue).toFixed(3)}
                      </text>
                    </g>
                  );
                })}

                {/* Nodes (entities) */}
                {graphData.entities.map((entity) => {
                  const pos = nodePositions.current.get(entity.id);
                  if (!pos) return null;

                  const theme = getEntityTheme(entity.id);
                  const radius = 20;

                  return (
                    <g key={entity.id}>
                      {/* Node circle */}
                      <circle
                        cx={pos.x}
                        cy={pos.y}
                        r={radius}
                        className={`${theme.bg} ${theme.border} stroke-2`}
                      />

                      {/* Entity name */}
                      <text
                        x={pos.x}
                        y={pos.y + radius + 15}
                        fill="white"
                        fontSize="10"
                        textAnchor="middle"
                        className="pointer-events-none select-none"
                      >
                        {entity.name}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>

            {/* Tooltip */}
            {tooltip.visible && (
              <div
                className="absolute z-10 max-w-xs rounded-lg bg-black/90 p-3 text-white text-xs shadow-lg backdrop-blur-sm"
                style={{
                  left: tooltip.x + 10,
                  top: tooltip.y - 10,
                  transform: tooltip.x > 200 ? "translateX(-100%)" : undefined,
                }}
              >
                <div className="mb-2 font-semibold">
                  Trust Score: {tooltip.relationship?.trustScore.toFixed(3)}
                </div>
                <div className="mb-2 text-slate-300">
                  Interactions: {tooltip.relationship?.interactionCount}
                </div>
                <div className="text-slate-200">{tooltip.content}</div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer */}
      <div className="border-white/10 border-t bg-black/20 p-4 backdrop-blur-sm">
        <div className="text-center text-slate-400 text-xs">
          Updates every 5s • Click edges for details • Trust affects opacity • Scroll to explore •
          Layout stabilizes automatically
        </div>
      </div>
    </div>
  );
}
