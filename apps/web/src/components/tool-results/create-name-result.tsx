import type { ToolResultProps } from "./index";

const CREATE_NAME_THEME = {
  bg: "bg-emerald-900/20",
  border: "border-emerald-700/50",
  text: "text-emerald-100",
  accent: "text-emerald-400",
  success: "text-emerald-300",
  error: "text-red-300",
};

export function CreateNameResult({ message }: ToolResultProps) {
  const theme = CREATE_NAME_THEME;
  const data = message.toolResultData;

  // Create friendly title based on the agent name
  const agentName = data?.name || "Agent";
  const title = data?.alreadyExisted
    ? `${agentName} already has a name`
    : `${agentName} creates identity`;

  return (
    <div className="group mb-4 flex flex-col gap-2">
      {/* Tool result header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`font-semibold ${theme.accent} text-base`}>{title}</span>
          <div className={`h-1.5 w-1.5 rounded-full ${theme.accent.replace("text-", "bg-")}`} />
          {data?.success ? (
            <span className={`font-medium text-xs ${theme.success}`}>✓ Success</span>
          ) : (
            <span className={`font-medium text-xs ${theme.error}`}>✗ Failed</span>
          )}
        </div>
        {message.completedAt === null ? (
          <span className="font-medium text-xs text-yellow-400">streaming...</span>
        ) : message.completedAt && Date.now() - message.completedAt < 30000 ? (
          <span className="font-medium text-green-400 text-xs">just completed</span>
        ) : null}
      </div>

      {/* Tool result content */}
      <div className={`rounded-xl ${theme.bg} ${theme.border} p-4 shadow-lg backdrop-blur-sm`}>
        <div className="space-y-3">
          {/* Agent Name */}
          <div className={`${theme.text} font-medium text-sm`}>
            Agent Name: <span className={`${theme.success}`}>{data?.name}</span>
          </div>

          {/* CDP Wallet Information */}
          {data?.cdpAccount && (
            <div className={`rounded-lg border ${theme.border} bg-black/20 p-3`}>
              <div className={`${theme.success} mb-2 font-medium text-sm`}>
                💰 Coinbase CDP Wallet Assigned
              </div>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className={`${theme.text} opacity-75`}>CDP Name:</span>
                  <span className={`${theme.text} font-mono`}>{data.cdpAccount.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className={`${theme.text} opacity-75`}>Wallet Address:</span>
                  <span className={`${theme.text} break-all font-mono text-xs`}>
                    {data.cdpAccount.address}
                  </span>
                </div>
                {data.cdpAccount.id && data.cdpAccount.id !== "unknown" && (
                  <div className="flex justify-between">
                    <span className={`${theme.text} opacity-75`}>Account ID:</span>
                    <span className={`${theme.text} font-mono`}>{data.cdpAccount.id}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Status message */}
          {data?.alreadyExisted && (
            <div className={`${theme.text} text-sm opacity-75`}>
              This agent already had a name and CDP wallet configured.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
