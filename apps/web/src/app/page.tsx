export const dynamic = "force-dynamic";

import { Container } from "@/components/ui/container";
import { ChatContainer } from "@/components/chat-container";
import { RelationshipGraph } from "@/components/relationship-graph";
import { EconomicTrends } from "@/components/economic-trends";
import { InstanceSwitcher } from "@/components/instance-switcher";

export default function Page() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50">
      <InstanceSwitcher />
      <Container className="py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="space-y-8">
            <ChatContainer />
            <EconomicTrends />
          </div>
          <div>
            <RelationshipGraph />
          </div>
        </div>
      </Container>
    </main>
  );
}
