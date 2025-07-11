"use client";

import { ChatContainer } from "@/components/chat-container";
import { DefaultFont } from "@/components/default-font";
import { EconomicTrends } from "@/components/economic-trends";
import { RelationshipGraph } from "@/components/relationship-graph";
import { useInstanceId } from "@/lib/instance";

export default function Home() {
  const instanceId = useInstanceId();
  
  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <DefaultFont />
      
      {/* Header */}
      <header className="flex-shrink-0 border-white/10 border-b bg-black/20 backdrop-blur-sm">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-r from-purple-500 to-blue-500" />
              <h1 className="font-bold text-white text-xl">Infinite Bazaar</h1>
            </div>
            <div className="text-slate-400 text-sm">AI Agent Identity Protocol</div>
          </div>
        </div>
      </header>

      {/* Economic Trends Section - Horizontal Bar */}
      <div className="flex-shrink-0 border-white/10 border-b bg-black/10 p-4">
        <EconomicTrends />
      </div>

      {/* Main Content - Chat and Relationship Graph Side by Side */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Chat container on the left side */}
        <div className="w-1/2 border-white/10 border-r h-full">
          <ChatContainer />
        </div>
        {/* Relationship graph on the right side */}
        <div className="w-1/2 h-full">
          <RelationshipGraph />
        </div>
      </div>
    </div>
  );
}

