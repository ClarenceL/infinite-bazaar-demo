"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Filter, X, Eye, EyeOff } from "lucide-react";

export interface GraphFilters {
  minTransactionValue: number;
  maxTransactionValue: number;
  minTrustScore: number;
  maxTrustScore: number;
  timePeriod: "all" | "24h" | "7d" | "30d";
  showOnlyActive: boolean;
  hideZeroTransactions: boolean;
  serviceTypes: string[];
  relationshipTypes: string[];
}

interface RelationshipGraphFiltersProps {
  filters: GraphFilters;
  onFiltersChange: (filters: GraphFilters) => void;
  availableServiceTypes: string[];
  relationshipStats: {
    totalRelationships: number;
    filteredRelationships: number;
    avgTransactionValue: number;
    avgTrustScore: number;
  };
}

export function RelationshipGraphFilters({
  filters,
  onFiltersChange,
  availableServiceTypes,
  relationshipStats,
}: RelationshipGraphFiltersProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const updateFilters = (updates: Partial<GraphFilters>) => {
    onFiltersChange({ ...filters, ...updates });
  };

  const resetFilters = () => {
    onFiltersChange({
      minTransactionValue: 0,
      maxTransactionValue: 10,
      minTrustScore: 0,
      maxTrustScore: 1,
      timePeriod: "all",
      showOnlyActive: false,
      hideZeroTransactions: false,
      serviceTypes: [],
      relationshipTypes: [],
    });
  };

  const hasActiveFilters = 
    filters.minTransactionValue > 0 ||
    filters.maxTransactionValue < 10 ||
    filters.minTrustScore > 0 ||
    filters.maxTrustScore < 1 ||
    filters.timePeriod !== "all" ||
    filters.showOnlyActive ||
    filters.hideZeroTransactions ||
    filters.serviceTypes.length > 0 ||
    filters.relationshipTypes.length > 0;

  return (
    <div className="border-white/10 border-b bg-black/10 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-slate-300 hover:text-white"
          >
            <Filter className="h-4 w-4 mr-2" />
            Filters
            {hasActiveFilters && (
              <Badge variant="secondary" className="ml-2 bg-purple-600/20 text-purple-300">
                {Object.values(filters).filter(Boolean).length}
              </Badge>
            )}
          </Button>
          
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={resetFilters}
              className="text-slate-400 hover:text-white"
            >
              <X className="h-4 w-4 mr-1" />
              Clear
            </Button>
          )}
        </div>

        <div className="flex items-center gap-4 text-xs text-slate-400">
          <span>
            Showing {relationshipStats.filteredRelationships} of {relationshipStats.totalRelationships} relationships
          </span>
          <span>
            Avg: ${relationshipStats.avgTransactionValue.toFixed(3)} USDC
          </span>
          <span>
            Trust: {relationshipStats.avgTrustScore.toFixed(2)}
          </span>
        </div>
      </div>

      {isExpanded && (
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Transaction Value Filter */}
          <Card className="bg-white/5 border-white/10">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Transaction Value</CardTitle>
              <CardDescription className="text-xs">Filter by USDC amount</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label className="text-xs text-slate-400">Min: ${filters.minTransactionValue.toFixed(3)}</Label>
                <Slider
                  value={[filters.minTransactionValue]}
                  onValueChange={([value]) => updateFilters({ minTransactionValue: value })}
                  max={10}
                  step={0.01}
                  className="mt-2"
                />
              </div>
              <div>
                <Label className="text-xs text-slate-400">Max: ${filters.maxTransactionValue.toFixed(3)}</Label>
                <Slider
                  value={[filters.maxTransactionValue]}
                  onValueChange={([value]) => updateFilters({ maxTransactionValue: value })}
                  max={10}
                  step={0.01}
                  className="mt-2"
                />
              </div>
            </CardContent>
          </Card>

          {/* Trust Score Filter */}
          <Card className="bg-white/5 border-white/10">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Trust Score</CardTitle>
              <CardDescription className="text-xs">Filter by relationship trust</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label className="text-xs text-slate-400">Min: {filters.minTrustScore.toFixed(2)}</Label>
                <Slider
                  value={[filters.minTrustScore]}
                  onValueChange={([value]) => updateFilters({ minTrustScore: value })}
                  max={1}
                  step={0.01}
                  className="mt-2"
                />
              </div>
              <div>
                <Label className="text-xs text-slate-400">Max: {filters.maxTrustScore.toFixed(2)}</Label>
                <Slider
                  value={[filters.maxTrustScore]}
                  onValueChange={([value]) => updateFilters({ maxTrustScore: value })}
                  max={1}
                  step={0.01}
                  className="mt-2"
                />
              </div>
            </CardContent>
          </Card>

          {/* Time Period & Options */}
          <Card className="bg-white/5 border-white/10">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Time & Options</CardTitle>
              <CardDescription className="text-xs">Filter by time period</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label className="text-xs text-slate-400">Time Period</Label>
                <Select value={filters.timePeriod} onValueChange={(value: any) => updateFilters({ timePeriod: value })}>
                  <SelectTrigger className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Time</SelectItem>
                    <SelectItem value="24h">Last 24 Hours</SelectItem>
                    <SelectItem value="7d">Last 7 Days</SelectItem>
                    <SelectItem value="30d">Last 30 Days</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="active-only"
                    checked={filters.showOnlyActive}
                    onCheckedChange={(checked) => updateFilters({ showOnlyActive: checked })}
                  />
                  <Label htmlFor="active-only" className="text-xs text-slate-400">
                    Active agents only
                  </Label>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Switch
                    id="hide-zero"
                    checked={filters.hideZeroTransactions}
                    onCheckedChange={(checked) => updateFilters({ hideZeroTransactions: checked })}
                  />
                  <Label htmlFor="hide-zero" className="text-xs text-slate-400">
                    Hide zero transactions
                  </Label>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Service Types Filter */}
          {availableServiceTypes.length > 0 && (
            <Card className="bg-white/5 border-white/10">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Service Types</CardTitle>
                <CardDescription className="text-xs">Filter by service categories</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {availableServiceTypes.map((type) => (
                    <Badge
                      key={type}
                      variant={filters.serviceTypes.includes(type) ? "default" : "outline"}
                      className={`cursor-pointer text-xs ${
                        filters.serviceTypes.includes(type)
                          ? "bg-purple-600/20 text-purple-300 border-purple-500/50"
                          : "border-white/20 text-slate-400 hover:text-white"
                      }`}
                      onClick={() => {
                        const newTypes = filters.serviceTypes.includes(type)
                          ? filters.serviceTypes.filter((t) => t !== type)
                          : [...filters.serviceTypes, type];
                        updateFilters({ serviceTypes: newTypes });
                      }}
                    >
                      {type}
                      {filters.serviceTypes.includes(type) && (
                        <X className="h-3 w-3 ml-1" />
                      )}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
} 