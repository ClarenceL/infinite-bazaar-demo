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

interface BidirectionalGroup {
  entities: [string, string];
  relationships: Relationship[];
  totalValue: number;
  avgTrustScore: number;
}

interface Tooltip {
  visible: boolean;
  x: number;
  y: number;
  content: string;
  relationship?: Relationship | BidirectionalGroup;
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
  const [viewBoxKey, setViewBoxKey] = useState<number>(0); // Force viewBox recalculation
  const [instanceId, setInstanceId] = useState<string>("default");

  const svgRef = useRef<SVGSVGElement>(null);
  const nodePositions = useRef<Map<string, NodePosition>>(new Map());
  const animationRef = useRef<number | undefined>(undefined);
  const entityThemes = useRef<Map<string, number>>(new Map());
  const simulationSteps = useRef<number>(0);
  const isStabilized = useRef<boolean>(false);
  const maxSimulationSteps = 300; // Stop simulation after this many steps
  const lastDataHash = useRef<string>("");

  // Fetch current instance ID from API
  const fetchInstanceId = async () => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_INFINITE_BAZAAR_API_URL || "http://localhost:3104"}/api/chat/instance`,
      );
      
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.instanceId) {
          setInstanceId(data.instanceId);
        }
      }
    } catch (err) {
      console.error("Error fetching instance ID:", err);
      // Keep default instanceId on error
    }
  };

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

  // Get color based on trust score (0.0 to 1.0)
  // Adjusted for high trust values: 0.77+ is good range, below 0.5 is black
  const getTrustColor = (trustScore: number): string => {
    // Clamp trust score between 0 and 1
    const normalizedTrust = Math.max(0, Math.min(1, trustScore));

    if (normalizedTrust < 0.5) {
      // Very low trust: Bright red for visibility
      return `rgb(255, 50, 50)`; // Bright red with slight pink tint
    } else if (normalizedTrust < 0.77) {
      // Low to medium trust: Fade from bright red to orange (0.5 - 0.77)
      const ratio = (normalizedTrust - 0.5) / 0.27; // 0.27 = 0.77 - 0.5
      const r = Math.floor(255 - ratio * 55); // 255 to 200 (red to orange)
      const g = Math.floor(50 + ratio * 110); // 50 to 160 (more orange)
      const b = Math.floor(50 - ratio * 10); // 50 to 40 (slight reduction)
      return `rgb(${r}, ${g}, ${b})`;
    } else {
      // High trust: Red to Green to Cyan (0.77 - 1.0)
      const ratio = (normalizedTrust - 0.77) / 0.23; // 0.23 = 1.0 - 0.77

      if (ratio < 0.5) {
        // Red to Yellow-Green (0.77 - 0.885)
        const subRatio = ratio * 2;
        const r = Math.floor(200 - subRatio * 100); // 200 to 100
        const g = Math.floor(60 + subRatio * 195); // 60 to 255
        const b = Math.floor(40 + subRatio * 60); // 40 to 100
        return `rgb(${r}, ${g}, ${b})`;
      } else {
        // Yellow-Green to Cyan (0.885 - 1.0)
        const subRatio = (ratio - 0.5) * 2;
        const r = Math.floor(100 - subRatio * 100); // 100 to 0
        const g = 255;
        const b = Math.floor(100 + subRatio * 155); // 100 to 255
        return `rgb(${r}, ${g}, ${b})`;
      }
    }
  };

  // Initialize node positions with deterministic layout (no randomness)
  const initializePositions = (entities: Entity[]) => {
    const width = 800; // Reduced to reasonable size
    const height = 600;
    const centerX = width / 2;
    const centerY = height / 2;

    entities.forEach((entity, index) => {
      if (!nodePositions.current.has(entity.id)) {
        // Arrange nodes in a circle, with radius based on number of entities
        const angle = (index / entities.length) * 2 * Math.PI;
        // Reasonable base radius that fits well in viewport
        const baseRadius = Math.min(width, height) * 0.3;
        const radiusMultiplier = Math.max(0.4, Math.min(1.0, entities.length / 5));
        const radius = baseRadius * radiusMultiplier;

        // Use deterministic offset based on entity ID to avoid randomness
        const hash = entity.id.split("").reduce((a, b) => a + b.charCodeAt(0), 0);
        const offsetX = ((hash % 100) - 50) * 0.4;
        const offsetY = (((hash * 17) % 100) - 50) * 0.4;

        nodePositions.current.set(entity.id, {
          x: centerX + Math.cos(angle) * radius + offsetX,
          y: centerY + Math.sin(angle) * radius + offsetY,
          vx: 0,
          vy: 0,
        });
      }
    });
  };

  // Calculate optimal viewBox to fit all nodes
  const calculateViewBox = (): string => {
    if (!graphData || graphData.entities.length === 0) {
      return "0 0 800 600"; // Match canvas size
    }

    const positions = graphData.entities
      .map(entity => nodePositions.current.get(entity.id))
      .filter(pos => pos !== undefined);

    if (positions.length === 0) {
      return "0 0 800 600"; // Match canvas size
    }

    // Calculate bounding box
    const minX = Math.min(...positions.map(pos => pos.x));
    const maxX = Math.max(...positions.map(pos => pos.x));
    const minY = Math.min(...positions.map(pos => pos.y));
    const maxY = Math.max(...positions.map(pos => pos.y));

    // Reasonable padding that doesn't make graph too small
    const nodePadding = 50;
    const paddedMinX = minX - nodePadding;
    const paddedMaxX = maxX + nodePadding;
    const paddedMinY = minY - nodePadding;
    const paddedMaxY = maxY + nodePadding;

    const width = paddedMaxX - paddedMinX;
    const height = paddedMaxY - paddedMinY;

    // Use a reasonable aspect ratio and don't make it too big
    const maxDimension = 800;
    const aspectRatio = width / height;
    
    let finalWidth = width;
    let finalHeight = height;
    
    if (width > maxDimension) {
      finalWidth = maxDimension;
      finalHeight = maxDimension / aspectRatio;
    }
    
    if (finalHeight > maxDimension) {
      finalHeight = maxDimension;
      finalWidth = maxDimension * aspectRatio;
    }

    // Center the content
    const centerOffsetX = (finalWidth - width) / 2;
    const centerOffsetY = (finalHeight - height) / 2;

    return `${paddedMinX - centerOffsetX} ${paddedMinY - centerOffsetY} ${finalWidth} ${finalHeight}`;
  };

  // Simple force-directed layout simulation (runs for limited time)
  const updatePositions = () => {
    if (!graphData || isStabilized.current) return;

    const { entities, relationships } = graphData;
    const width = 800; // Match canvas size
    const height = 600;
    const centerX = width / 2;
    const centerY = height / 2;

    // Stop after enough steps
    if (simulationSteps.current >= maxSimulationSteps) {
      isStabilized.current = true;
      setViewBoxKey(prev => prev + 1); // Trigger viewBox recalculation
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

              // Balanced repulsion between nodes
        entities.forEach((otherEntity) => {
          if (entity.id === otherEntity.id) return;
          const otherPos = nodePositions.current.get(otherEntity.id);
          if (!otherPos) return;

          const dx = pos.x - otherPos.x;
          const dy = pos.y - otherPos.y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          // Increased minimum distance for better spacing
          if (distance > 0 && distance < 150) {
            const force = (1000 / (distance * distance)) * forceMultiplier;
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
          if (distance > 280) {
            const force = 0.0008 * rel.trustScore * forceMultiplier;
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

      // Keep within bounds
      const margin = 50;
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
        `${process.env.NEXT_PUBLIC_INFINITE_BAZAAR_API_URL || "http://localhost:3104"}/api/relationships/graph?instanceId=${instanceId}`,
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
          setViewBoxKey(prev => prev + 1); // Trigger immediate viewBox recalculation

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
    // First get the instance ID, then start polling
    const initializeGraph = async () => {
      await fetchInstanceId();
      fetchGraphData();
    };

    initializeGraph();
  }, []);

  // Set up polling when instanceId is available
  useEffect(() => {
    if (!instanceId) return;

    // Set up polling every 5 seconds
    const interval = setInterval(fetchGraphData, 5000);

    return () => {
      clearInterval(interval);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [instanceId]);

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

  // Create bidirectional relationship groups
  const createBidirectionalGroups = (relationships: Relationship[]) => {
    const groups = new Map<string, {
      entities: [string, string];
      relationships: Relationship[];
      totalValue: number;
      avgTrustScore: number;
    }>();

    relationships.forEach(rel => {
      // Create a consistent key for the pair (sort to ensure same key regardless of direction)
      const entities = [rel.observerAgentId, rel.targetAgentId].sort() as [string, string];
      const key = `${entities[0]}-${entities[1]}`;

      if (!groups.has(key)) {
        groups.set(key, {
          entities,
          relationships: [],
          totalValue: 0,
          avgTrustScore: 0,
        });
      }

      const group = groups.get(key)!;
      group.relationships.push(rel);
      group.totalValue += Number.parseFloat(rel.totalTransactionValue || "0");
    });

    // Calculate average trust scores
    groups.forEach(group => {
      group.avgTrustScore = group.relationships.reduce((sum, rel) => sum + rel.trustScore, 0) / group.relationships.length;
    });

    return Array.from(groups.values());
  };

  // Handle edge click for tooltip
  const handleEdgeClick = (event: React.MouseEvent, relationshipGroup: BidirectionalGroup) => {
    event.stopPropagation(); // Prevent hiding tooltip
    
    const containerRect = svgRef.current?.parentElement?.getBoundingClientRect();
    if (!containerRect) return;

    // Create detailed content for bidirectional relationship
    const content = relationshipGroup.relationships.length === 1 
      ? relationshipGroup.relationships[0]?.relationshipSummary || "No summary available"
      : `Bidirectional relationship with ${relationshipGroup.relationships.length} interactions`;

    setTooltip({
      visible: true,
      x: event.clientX - containerRect.left,
      y: event.clientY - containerRect.top,
      content,
      relationship: relationshipGroup,
    });
  };

  // Type guard to check if relationship is BidirectionalGroup
  const isBidirectionalGroup = (rel: Relationship | BidirectionalGroup): rel is BidirectionalGroup => {
    return 'entities' in rel && 'relationships' in rel;
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
      <div className="border-white/10 border-b bg-gradient-to-b from-slate-900/80 to-slate-800/60 p-4 backdrop-blur-sm">
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
      <div className="relative flex-1 overflow-hidden bg-gradient-to-br from-slate-900/40 to-slate-800/30">
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
              className="h-full w-full"
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
              <svg 
                ref={svgRef} 
                className="h-full w-full" 
                viewBox={calculateViewBox()}
                preserveAspectRatio="xMidYMid meet"
                key={viewBoxKey}
              >
                {/* Edges (simplified bidirectional relationships) */}
                {createBidirectionalGroups(graphData.relationships).map((group, index) => {
                  const [entity1, entity2] = group.entities;
                  const pos1 = nodePositions.current.get(entity1);
                  const pos2 = nodePositions.current.get(entity2);

                  if (!pos1 || !pos2) return null;

                  // Enhanced visual properties
                  const opacity = Math.max(0.3, Math.min(0.9, group.avgTrustScore));
                  const strokeWidth = Math.max(2, Math.min(6, group.avgTrustScore * 5)); // Increased thickness
                  const trustColor = getTrustColor(group.avgTrustScore);

                  // Calculate if there's bidirectional flow
                  const entity1ToEntity2 = group.relationships
                    .filter(rel => rel.observerAgentId === entity1)
                    .reduce((sum, rel) => sum + Number.parseFloat(rel.totalTransactionValue || "0"), 0);
                  
                  const entity2ToEntity1 = group.relationships
                    .filter(rel => rel.observerAgentId === entity2)
                    .reduce((sum, rel) => sum + Number.parseFloat(rel.totalTransactionValue || "0"), 0);

                  const isBidirectional = entity1ToEntity2 > 0 && entity2ToEntity1 > 0;

                  return (
                    <g key={`group-${index}`}>
                      {/* Main edge line with enhanced styling */}
                      <line
                        x1={pos1.x}
                        y1={pos1.y}
                        x2={pos2.x}
                        y2={pos2.y}
                        stroke={trustColor}
                        strokeWidth={strokeWidth}
                        opacity={opacity}
                        strokeLinecap="round"
                        className="cursor-pointer hover:opacity-100 transition-opacity duration-200"
                        onClick={(e) => handleEdgeClick(e, group)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            handleEdgeClick(e as any, group);
                          }
                        }}
                        tabIndex={0}
                        role="button"
                        aria-label={`Relationship between ${(() => {
                          const ent1 = graphData.entities.find(e => e.id === entity1);
                          const ent2 = graphData.entities.find(e => e.id === entity2);
                          return `${ent1?.name || entity1} and ${ent2?.name || entity2}`;
                        })()}`}
                      />


                    </g>
                  );
                })}

                {/* Nodes (entities) with enhanced styling */}
                {graphData.entities.map((entity) => {
                  const pos = nodePositions.current.get(entity.id);
                  if (!pos) return null;

                  const theme = getEntityTheme(entity.id);
                  const radius = 18; // Reduced for better readability

                  return (
                    <g key={entity.id}>
                      {/* Node shadow */}
                      <circle
                        cx={pos.x + 2}
                        cy={pos.y + 2}
                        r={radius}
                        fill="rgba(0, 0, 0, 0.3)"
                        className="pointer-events-none"
                      />

                      {/* Node circle with enhanced styling */}
                      <circle
                        cx={pos.x}
                        cy={pos.y}
                        r={radius}
                        className={`${theme.bg} ${theme.border} stroke-2`}
                        filter="url(#glow)"
                      />

                      {/* Entity type indicator */}
                      <circle
                        cx={pos.x + 10}
                        cy={pos.y - 10}
                        r="4"
                        fill={entity.entityType === "AI" ? "rgb(34, 197, 94)" : "rgb(59, 130, 246)"}
                        stroke="white"
                        strokeWidth="1"
                        className="pointer-events-none"
                      />

                      {/* Entity name with background */}
                      <rect
                        x={pos.x - (entity.name.length * 3.5)}
                        y={pos.y + radius + 8}
                        width={entity.name.length * 7}
                        height="16"
                        rx="4"
                        fill="rgba(0, 0, 0, 0.7)"
                        stroke="rgba(255, 255, 255, 0.1)"
                        strokeWidth="0.5"
                        className="pointer-events-none"
                      />

                      <text
                        x={pos.x}
                        y={pos.y + radius + 18}
                        fill="white"
                        fontSize="11"
                        fontWeight="500"
                        textAnchor="middle"
                        className="pointer-events-none select-none"
                      >
                        {entity.name}
                      </text>
                    </g>
                  );
                })}

                {/* Define filters for enhanced visuals */}
                <defs>
                  <filter id="glow">
                    <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                    <feMerge> 
                      <feMergeNode in="coloredBlur"/>
                      <feMergeNode in="SourceGraphic"/>
                    </feMerge>
                  </filter>
                </defs>
              </svg>
            </div>

            {/* Simplified tooltip */}
            {tooltip.visible && tooltip.relationship && (() => {
              const rel = tooltip.relationship;
              return (
                <div
                  className="absolute z-20 max-w-xs rounded-lg bg-slate-900/95 p-3 text-white text-sm shadow-2xl backdrop-blur-sm border border-slate-700"
                  style={{
                    left: tooltip.x + 10,
                    top: tooltip.y - 10,
                    transform: tooltip.x > 300 ? "translateX(-100%)" : undefined,
                  }}
                >
                  {isBidirectionalGroup(rel) ? (
                    <>
                      <div className="mb-2 font-semibold text-slate-100">
                        {(() => {
                          const entity1 = graphData.entities.find(e => e.id === rel.entities[0]);
                          const entity2 = graphData.entities.find(e => e.id === rel.entities[1]);
                          return `${entity1?.name || rel.entities[0]} ↔ ${entity2?.name || rel.entities[1]}`;
                        })()}
                      </div>
                      
                      <div className="space-y-1 text-xs">
                        <div className="flex justify-between">
                          <span className="text-slate-400">Trust Score:</span>
                          <span className="text-slate-200">{rel.avgTrustScore.toFixed(3)}</span>
                        </div>
                        
                        {/* Money flow in both directions */}
                        <div className="mt-2 pt-2 border-t border-slate-600">
                          <div className="text-slate-300 font-medium mb-1">Money Flow:</div>
                          {(() => {
                            const entity1ToEntity2 = rel.relationships
                              .filter(r => r.observerAgentId === rel.entities[0])
                              .reduce((sum, r) => sum + Number.parseFloat(r.totalTransactionValue || "0"), 0);
                            
                            const entity2ToEntity1 = rel.relationships
                              .filter(r => r.observerAgentId === rel.entities[1])
                              .reduce((sum, r) => sum + Number.parseFloat(r.totalTransactionValue || "0"), 0);
                            
                            const entity1 = graphData.entities.find(e => e.id === rel.entities[0]);
                            const entity2 = graphData.entities.find(e => e.id === rel.entities[1]);
                            const entity1Name = entity1?.name || rel.entities[0];
                            const entity2Name = entity2?.name || rel.entities[1];
                            
                            return (
                              <div className="space-y-1">
                                <div className="flex justify-between">
                                  <span className="text-slate-400">{entity1Name} → {entity2Name}:</span>
                                  <span className="text-green-400">${entity1ToEntity2.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-slate-400">{entity2Name} → {entity1Name}:</span>
                                  <span className="text-green-400">${entity2ToEntity1.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between pt-1 border-t border-slate-700">
                                  <span className="text-slate-300 font-medium">Total:</span>
                                  <span className="text-white font-medium">${(entity1ToEntity2 + entity2ToEntity1).toFixed(2)}</span>
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                        
                        <div className="flex justify-between">
                          <span className="text-slate-400">Interactions:</span>
                          <span className="text-slate-200">
                            {rel.relationships.reduce((sum: number, r: Relationship) => sum + r.interactionCount, 0)}
                          </span>
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="mb-2 font-semibold text-slate-100">
                        {(() => {
                          const observer = graphData.entities.find(e => e.id === rel.observerAgentId);
                          const target = graphData.entities.find(e => e.id === rel.targetAgentId);
                          return `${observer?.name || rel.observerAgentId} → ${target?.name || rel.targetAgentId}`;
                        })()}
                      </div>
                      <div className="space-y-1 text-xs">
                        <div className="flex justify-between">
                          <span className="text-slate-400">Trust Score:</span>
                          <span className="text-slate-200">{rel.trustScore.toFixed(3)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Transaction Value:</span>
                          <span className="text-green-400">${Number.parseFloat(rel.totalTransactionValue || "0").toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Interactions:</span>
                          <span className="text-slate-200">{rel.interactionCount}</span>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              );
            })()}
          </>
        )}
      </div>

      {/* Footer */}
      <div className="border-white/10 border-t bg-gradient-to-t from-slate-900/80 to-slate-800/60 p-3 backdrop-blur-sm">
        <div className="text-center text-slate-400 text-xs">
          Click relationships for details • Green circles = AI • Blue circles = Human • Line thickness = Trust level
        </div>
      </div>
    </div>
  );
}
