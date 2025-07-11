"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { TrendingUp, TrendingDown, DollarSign, Activity, Users, ShoppingCart, ChevronDown, ChevronUp } from "lucide-react";
import { useInstanceId } from "@/lib/instance";

interface EconomicData {
  transactionVolume: {
    total: number;
    last24h: number;
    trend: "up" | "down" | "stable";
    percentChange: number;
  };
  priceMetrics: {
    averagePrice: number;
    minPrice: number;
    maxPrice: number;
    popularPriceRange: string;
  };
  agentActivity: {
    totalAgents: number;
    activeProviders: number;
    activeConsumers: number;
    topEarners: Array<{
      name: string;
      earnings: number;
      serviceCount: number;
    }>;
  };
  servicePopularity: Array<{
    serviceName: string;
    provider: string;
    callCount: number;
    revenue: number;
    avgRating: number;
  }>;
}

interface EconomicTrendsProps {
  className?: string;
}

export function EconomicTrends({ className }: EconomicTrendsProps) {
  const [data, setData] = useState<EconomicData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const instanceId = useInstanceId(); // Use the URL parameter hook

  const fetchEconomicData = async () => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_INFINITE_BAZAAR_API_URL || "http://localhost:3104"}/api/economic-trends?instance=${instanceId}`,
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      if (result.success) {
        setData(result.data);
        setError(null);
      } else {
        setError("Failed to fetch economic data");
      }
    } catch (err) {
      console.error("Error fetching economic data:", err);
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Start polling immediately
    fetchEconomicData();
  }, []);

  // Set up polling when instanceId is available
  useEffect(() => {
    if (!instanceId) return;

    // Refresh every 30 seconds
    const interval = setInterval(fetchEconomicData, 30000);
    return () => clearInterval(interval);
  }, [instanceId]);

  const formatCurrency = (amount: number) => `$${amount.toFixed(3)}`;
  const formatPercent = (percent: number) => `${percent >= 0 ? '+' : ''}${percent.toFixed(1)}%`;

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="bg-white/5 border-white/10">
              <CardContent className="p-3">
                <Skeleton className="h-3 w-20 mb-1" />
                <Skeleton className="h-5 w-16 mb-1" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-3/4" />
              </CardContent>
            </Card>
          ))}
        </div>
      );
    }

    if (error) {
      return (
        <Card className="bg-red-900/20 border-red-500/30">
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-red-400 text-sm">Error loading economic data</div>
              <div className="text-red-300 text-xs mt-1">{error}</div>
              <button
                onClick={fetchEconomicData}
                className="mt-2 rounded bg-red-600 px-3 py-1 text-white text-xs hover:bg-red-700"
              >
                Retry
              </button>
            </div>
          </CardContent>
        </Card>
      );
    }

    if (!data) {
      return (
        <Card className="bg-white/5 border-white/10">
          <CardContent className="pt-6">
            <div className="text-center text-slate-400 text-sm">
              No economic data available
            </div>
          </CardContent>
        </Card>
      );
    }

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
      {/* Transaction Volume */}
      <Card className="bg-white/5 border-white/10">
        <CardContent className="p-3">
          <div className="flex items-center gap-1.5 text-xs font-medium text-slate-300 mb-1">
            <Activity className="h-3 w-3" />
            Transaction Volume
          </div>
          <div className="text-xl font-bold text-white mb-1">
            {formatCurrency(data.transactionVolume.total)}
          </div>
          <div className="text-xs text-slate-500">
            {formatCurrency(data.transactionVolume.last24h)} last 6h
          </div>
        </CardContent>
      </Card>

      {/* Price Metrics */}
      <Card className="bg-white/5 border-white/10">
        <CardContent className="p-3">
          <div className="flex items-center gap-1.5 text-xs font-medium text-slate-300 mb-1">
            <DollarSign className="h-3 w-3" />
            Price Metrics
          </div>
          <div className="text-xl font-bold text-white mb-1">
            {formatCurrency(data.priceMetrics.averagePrice)}
          </div>
          <div className="text-xs text-slate-400">
            Range: {formatCurrency(data.priceMetrics.minPrice)} - {formatCurrency(data.priceMetrics.maxPrice)}
          </div>
          <div className="text-xs text-slate-500">
            Popular: {data.priceMetrics.popularPriceRange}
          </div>
        </CardContent>
      </Card>

      {/* Agent Activity */}
      <Card className="bg-white/5 border-white/10">
        <CardContent className="p-3">
          <div className="flex items-center gap-1.5 text-xs font-medium text-slate-300 mb-1">
            <Users className="h-3 w-3" />
            Agent Activity
          </div>
          <div className="text-xl font-bold text-white mb-1">
            {data.agentActivity.totalAgents}
          </div>
          <div className="space-y-0.5 text-xs">
            <div className="flex justify-between text-slate-400">
              <span>Providers:</span>
              <span className="text-green-300">{data.agentActivity.activeProviders}</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Consumers:</span>
              <span className="text-blue-300">{data.agentActivity.activeConsumers}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Service Popularity */}
      <Card className="bg-white/5 border-white/10">
        <CardContent className="p-3">
          <div className="flex items-center gap-1.5 text-xs font-medium text-slate-300 mb-1">
            <ShoppingCart className="h-3 w-3" />
            Top Services
          </div>
          <div className="text-xl font-bold text-white mb-1">
            {data.servicePopularity.length}
          </div>
          <div className="space-y-1">
            {data.servicePopularity.slice(0, 3).map((service, index) => (
              <div key={index} className="flex justify-between items-center text-xs">
                <div className="flex-1 min-w-0">
                  <div className="text-slate-300 truncate">{service.serviceName}</div>
                  <div className="text-slate-500 truncate">{service.provider}</div>
                </div>
                <div className="text-right ml-2">
                  <div className="text-slate-300">{service.callCount} calls</div>
                  <div className="text-slate-500">{formatCurrency(service.revenue)}</div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
    );
  };

  return (
    <div className={className}>
      {/* Collapsible Header */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-medium text-slate-300">Market Overview</h2>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="h-6 px-2 text-slate-400 hover:text-white hover:bg-white/10"
        >
          {isCollapsed ? (
            <>
              <span className="text-xs mr-1">Show</span>
              <ChevronDown className="h-3 w-3" />
            </>
          ) : (
            <>
              <span className="text-xs mr-1">Hide</span>
              <ChevronUp className="h-3 w-3" />
            </>
          )}
        </Button>
      </div>

      {/* Collapsible Content */}
      {!isCollapsed && renderContent()}
    </div>
  );
}

// Additional detailed trends component
export function DetailedEconomicTrends({ className }: EconomicTrendsProps) {
  const [data, setData] = useState<EconomicData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [instanceId, setInstanceId] = useState<string>("default");

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

  const fetchEconomicData = async () => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_INFINITE_BAZAAR_API_URL || "http://localhost:3104"}/api/economic-trends?instance=${instanceId}`,
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      if (result.success) {
        setData(result.data);
        setError(null);
      } else {
        setError("Failed to fetch economic data");
      }
    } catch (err) {
      console.error("Error fetching economic data:", err);
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // First get the instance ID, then start polling
    const initializeData = async () => {
      await fetchInstanceId();
      fetchEconomicData();
    };

    initializeData();
  }, []);

  // Set up polling when instanceId is available
  useEffect(() => {
    if (!instanceId) return;

    const interval = setInterval(fetchEconomicData, 30000);
    return () => clearInterval(interval);
  }, [instanceId]);

  if (isLoading) {
    return (
      <div className={`space-y-4 ${className}`}>
        <Card className="bg-white/5 border-white/10">
          <CardHeader>
            <Skeleton className="h-6 w-48" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-32 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className={`${className}`}>
        <Card className="bg-red-900/20 border-red-500/30">
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-red-400 text-sm">Error loading detailed economic data</div>
              {error && <div className="text-red-300 text-xs mt-1">{error}</div>}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const formatCurrency = (amount: number) => `$${amount.toFixed(3)}`;

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Top Earners */}
      <Card className="bg-white/5 border-white/10">
        <CardHeader>
          <CardTitle className="text-base font-medium text-white flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Top Earning Agents
          </CardTitle>
          <CardDescription className="text-slate-400">
            Agents with highest revenue in the marketplace
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {data.agentActivity.topEarners.map((agent, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-white font-bold text-sm">
                    {index + 1}
                  </div>
                  <div>
                    <div className="text-white font-medium">{agent.name}</div>
                    <div className="text-slate-400 text-sm">{agent.serviceCount} services</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-white font-medium">{formatCurrency(agent.earnings)}</div>
                  <div className="text-slate-400 text-sm">total earned</div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Service Performance */}
      <Card className="bg-white/5 border-white/10">
        <CardHeader>
          <CardTitle className="text-base font-medium text-white flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Service Performance
          </CardTitle>
          <CardDescription className="text-slate-400">
            Most popular services by usage and revenue
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {data.servicePopularity.map((service, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                <div className="flex-1 min-w-0">
                  <div className="text-white font-medium truncate">{service.serviceName}</div>
                  <div className="text-slate-400 text-sm">by {service.provider}</div>
                </div>
                <div className="text-right ml-4">
                  <div className="text-white font-medium">{service.callCount} calls</div>
                  <div className="text-slate-400 text-sm">{formatCurrency(service.revenue)} earned</div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 