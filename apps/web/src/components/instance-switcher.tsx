'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Zap, ChevronDown, ChevronUp } from 'lucide-react';

const DEMO_INSTANCES = [
  {
    id: '09-07-25_1',
    name: 'Rich Demo Instance',
    description: 'Full of data - 6 agents, 82 conversations, 9 services',
    stats: { agents: 6, conversations: 82, services: 9, transactions: 7 },
    color: 'bg-green-500',
  },
  {
    id: 'live-demo',
    name: 'Clean Demo Instance', 
    description: 'Fresh start - minimal data for clean demos',
    stats: { agents: 3, conversations: 5, services: 2, transactions: 1 },
    color: 'bg-blue-500',
  },
];

export function InstanceSwitcher() {
  const [currentInstance, setCurrentInstance] = useState('09-07-25_1');
  const [isExpanded, setIsExpanded] = useState(false);

  const switchInstance = (instanceId: string) => {
    // Update URL parameter to switch instance
    const url = new URL(window.location.href);
    url.searchParams.set('instance', instanceId);
    window.location.href = url.toString();
  };

  return (
    <div className="fixed top-4 right-4 z-50 bg-white/95 backdrop-blur-sm rounded-lg p-3 shadow-lg border border-gray-200 max-w-[280px]">
      <div className="flex flex-col gap-2">
        <div 
          className="flex items-center gap-2 text-xs font-medium text-gray-700 cursor-pointer" 
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <Zap className="h-3 w-3 text-purple-600" />
          <span>Demo Switcher</span>
          {isExpanded ? <ChevronUp className="h-3 w-3 ml-auto" /> : <ChevronDown className="h-3 w-3 ml-auto" />}
        </div>
        
        {isExpanded && (
          <div className="space-y-2">
            {DEMO_INSTANCES.map((instance) => (
              <Card key={instance.id} className={`cursor-pointer transition-all hover:shadow-md ${currentInstance === instance.id ? 'ring-1 ring-blue-400' : ''}`}>
                <CardContent className="p-2" onClick={() => switchInstance(instance.id)}>
                  <div className="flex items-center gap-2 mb-1">
                    <div className={`w-1.5 h-1.5 rounded-full ${instance.color}`} />
                    <span className="font-medium text-xs">{instance.name}</span>
                    {currentInstance === instance.id && (
                      <Badge variant="secondary" className="text-[10px] px-1 py-0">ACTIVE</Badge>
                    )}
                  </div>
                  
                  <div className="flex gap-2 text-[10px] text-gray-500">
                    <span>{instance.stats.agents}A</span>
                    <span>{instance.stats.conversations}C</span>
                    <span>{instance.stats.services}S</span>
                  </div>
                </CardContent>
              </Card>
            ))}
            
            <Button 
              size="sm" 
              variant="outline" 
              className="text-[10px] h-6 px-2"
              onClick={() => {
                const url = new URL(window.location.href);
                url.searchParams.delete('instance');
                window.location.href = url.toString();
              }}
            >
              Reset
            </Button>
          </div>
        )}
      </div>
    </div>
  );
} 