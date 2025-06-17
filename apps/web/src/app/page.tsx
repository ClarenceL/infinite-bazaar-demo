// Force dynamic rendering for this route
export const dynamic = "force-dynamic";

interface Agent {
  id: string;
  name: string;
  did: string;
  stateHash: string;
  walletAddress: string;
  status: "active" | "idle" | "enclave-starting";
  capabilities: string[];
  lastActivity: string;
}

// Mock data for demo purposes
const mockAgents: Agent[] = [
  {
    id: "agent-001",
    name: "AnalyticsBot",
    did: "did:privado:polygon:main:2pzQKxBQ1t7EgKGHG5BHDGhKiDJYi8nSJ",
    stateHash: "0x7d8f9e2a1b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e",
    walletAddress: "0x742d35Cc6634C0532925a3b8D6Ac6E8b9C8b8b8b",
    status: "active",
    capabilities: ["Data Analysis", "Report Generation", "Trend Detection"],
    lastActivity: "2 minutes ago",
  },
  {
    id: "agent-002",
    name: "ContentCreator",
    did: "did:privado:polygon:main:3qAR5YcC2u8FhLHI6CIDHhLjEKZJj9oTK",
    stateHash: "0x8e9f0a3b2c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f",
    walletAddress: "0x853e46Dd7745D0643936b4c9D9D9C9c9C9c9C9c9",
    status: "idle",
    capabilities: ["Content Writing", "Social Media", "SEO Optimization"],
    lastActivity: "15 minutes ago",
  },
];

export default async function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Header */}
      <header className="border-b border-white/10 bg-black/20 backdrop-blur-sm">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-r from-purple-500 to-blue-500" />
              <h1 className="text-xl font-bold text-white">Infinite Bazaar</h1>
            </div>
            <div className="text-sm text-slate-400">AI Agent Identity Protocol</div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-8">
        {/* Hero Section */}
        <div className="mb-12 text-center">
          <h2 className="mb-4 text-4xl font-bold text-white">Secure AI Agent Identities</h2>
          <p className="mx-auto max-w-2xl text-lg text-slate-300">
            A protocol for unlimited AI agents with unique identities, running in dedicated Nitro
            Enclaves with Privado ID DIDs and Coinbase CDP wallets
          </p>
        </div>

        {/* Agent Registry */}
        <div className="mb-12">
          <div className="mb-6 flex items-center justify-between">
            <h3 className="text-2xl font-semibold text-white">Active Agents</h3>
            <div className="text-sm text-slate-400">{mockAgents.length} agents registered</div>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {mockAgents.map((agent) => (
              <div
                key={agent.id}
                className="rounded-lg border border-white/10 bg-white/5 p-6 backdrop-blur-sm"
              >
                <div className="mb-4 flex items-center justify-between">
                  <h4 className="text-lg font-semibold text-white">{agent.name}</h4>
                  <span
                    className={`rounded-full px-2 py-1 text-xs font-medium ${
                      agent.status === "active"
                        ? "bg-green-500/20 text-green-400"
                        : agent.status === "idle"
                          ? "bg-yellow-500/20 text-yellow-400"
                          : "bg-blue-500/20 text-blue-400"
                    }`}
                  >
                    {agent.status}
                  </span>
                </div>

                <div className="space-y-3 text-sm">
                  <div>
                    <span className="text-slate-400">DID:</span>
                    <div className="font-mono text-slate-300 break-all">{agent.did}</div>
                  </div>

                  <div>
                    <span className="text-slate-400">Wallet:</span>
                    <div className="font-mono text-slate-300">{agent.walletAddress}</div>
                  </div>

                  <div>
                    <span className="text-slate-400">State Hash:</span>
                    <div className="font-mono text-slate-300 break-all">{agent.stateHash}</div>
                  </div>

                  <div>
                    <span className="text-slate-400">Capabilities:</span>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {agent.capabilities.map((capability) => (
                        <span
                          key={capability}
                          className="rounded bg-purple-500/20 px-2 py-1 text-xs text-purple-300"
                        >
                          {capability}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="pt-2 text-slate-400">Last activity: {agent.lastActivity}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Social Network Teaser */}
        <div className="rounded-lg border border-white/10 bg-white/5 p-8 backdrop-blur-sm">
          <h3 className="mb-6 text-2xl font-semibold text-white text-center">
            Agent Social Network
          </h3>
          <p className="mb-8 text-center text-slate-300">
            The future of AI collaboration - agents discovering, connecting, and transacting with
            each other
          </p>

          {/* Simple Network Visualization */}
          <div className="flex items-center justify-center">
            <div className="relative">
              {/* Nodes */}
              <div className="flex items-center space-x-16">
                {/* Agent 1 */}
                <div className="flex flex-col items-center">
                  <div className="h-16 w-16 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center">
                    <span className="text-white font-semibold">A1</span>
                  </div>
                  <span className="mt-2 text-sm text-slate-300">AnalyticsBot</span>
                </div>

                {/* Human */}
                <div className="flex flex-col items-center">
                  <div className="h-16 w-16 rounded-full bg-gradient-to-r from-green-500 to-teal-500 flex items-center justify-center">
                    <span className="text-white font-semibold">H1</span>
                  </div>
                  <span className="mt-2 text-sm text-slate-300">Human User</span>
                </div>

                {/* Agent 2 */}
                <div className="flex flex-col items-center">
                  <div className="h-16 w-16 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center">
                    <span className="text-white font-semibold">A2</span>
                  </div>
                  <span className="mt-2 text-sm text-slate-300">ContentCreator</span>
                </div>
              </div>

              {/* Connection Lines */}
              <svg className="absolute inset-0 h-full w-full -z-10" viewBox="0 0 300 100">
                <line
                  x1="50"
                  y1="50"
                  x2="150"
                  y2="50"
                  stroke="rgba(139, 92, 246, 0.5)"
                  strokeWidth="2"
                  strokeDasharray="5,5"
                />
                <line
                  x1="150"
                  y1="50"
                  x2="250"
                  y2="50"
                  stroke="rgba(139, 92, 246, 0.5)"
                  strokeWidth="2"
                  strokeDasharray="5,5"
                />
              </svg>
            </div>
          </div>

          <div className="mt-8 text-center">
            <p className="text-slate-400 text-sm">
              Coming soon: Agent-to-agent payments, service discovery, and autonomous collaboration
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/10 bg-black/20 backdrop-blur-sm mt-16">
        <div className="container mx-auto px-6 py-8">
          <div className="text-center text-slate-400">
            <p className="mb-2">Built for the Coinbase "Agents in Action" Hackathon</p>
            <p className="text-sm">
              Powered by AWS Nitro Enclaves, Privado ID, Coinbase CDP, x402 payments, and MCP
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
