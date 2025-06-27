// Force dynamic rendering for this route
export const dynamic = "force-dynamic";

import { ChatContainer } from "@/components/chat-container";
import { RelationshipGraph } from "@/components/relationship-graph";

export default async function HomePage() {
  return (
    <div className="h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Header */}
      <header className="border-white/10 border-b bg-black/20 backdrop-blur-sm">
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

      {/* Main Content */}
      <div className="flex h-[calc(100vh-80px)]">
        {/* Chat container on the left side */}
        <div className="w-1/2 border-white/10 border-r">
          <ChatContainer />
        </div>
        {/* Relationship graph on the right side */}
        <div className="w-1/2">
          <RelationshipGraph />
        </div>
      </div>
    </div>
  );
}
