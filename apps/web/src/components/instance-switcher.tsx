'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Zap, Database, Users, DollarSign } from 'lucide-react';

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

  const switchInstance = (instanceId: string) => {
    // Update URL parameter to switch instance
    const url = new URL(window.location.href);
    url.searchParams.set('instance', instanceId);
    window.location.href = url.toString();
  };

  return (
    <div className="fixed top-4 right-4 z-50 bg-white/95 backdrop-blur-sm rounded-lg p-4 shadow-xl border-2 border-purple-200">
      <div className="flex flex-col gap-2 min-w-[320px]">
        <div className="flex items-center gap-2 text-sm font-bold text-purple-700">
          <Zap className="h-4 w-4 text-purple-600" />
          🎯 Demo Instance Switcher
        </div>
        
        {DEMO_INSTANCES.map((instance) => (
          <Card key={instance.id} className={`cursor-pointer transition-all hover:shadow-md ${currentInstance === instance.id ? 'ring-2 ring-blue-500' : ''}`}>
            <CardContent className="p-3" onClick={() => switchInstance(instance.id)}>
              <div className="flex items-center gap-2 mb-2">
                <div className={`w-2 h-2 rounded-full ${instance.color}`} />
                <span className="font-medium text-sm">{instance.name}</span>
                {currentInstance === instance.id && (
                  <Badge variant="secondary" className="text-xs">ACTIVE</Badge>
                )}
              </div>
              
              <p className="text-xs text-gray-600 mb-2">{instance.description}</p>
              
              <div className="flex gap-3 text-xs">
                <div className="flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  {instance.stats.agents}
                </div>
                <div className="flex items-center gap-1">
                  <Database className="h-3 w-3" />
                  {instance.stats.conversations}
                </div>
                <div className="flex items-center gap-1">
                  <DollarSign className="h-3 w-3" />
                  {instance.stats.services}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        
        <Button 
          size="sm" 
          variant="outline" 
          className="text-xs"
          onClick={() => {
            const url = new URL(window.location.href);
            url.searchParams.delete('instance');
            window.location.href = url.toString();
          }}
        >
          Reset to Default
        </Button>
      </div>
    </div>
  );
} 