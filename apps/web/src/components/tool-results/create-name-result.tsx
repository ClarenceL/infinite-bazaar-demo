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

  return (
    <div className="group mb-4 flex flex-col gap-2">
      {/* Tool result header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`font-semibold ${theme.accent} text-base`}>
            @tool-results/create_name
          </span>
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
          {/* Name */}
          <div className={`${theme.text} font-medium text-sm`}>{data?.name}</div>

          {/* CDP Wallet message */}
          <div className={`${theme.success} text-sm`}>Assigned Coinbase CDP Wallet:</div>
        </div>
      </div>
    </div>
  );
}
