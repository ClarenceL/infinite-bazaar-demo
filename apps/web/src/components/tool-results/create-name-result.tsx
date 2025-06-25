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
        {data?.success ? (
          <div className="space-y-3">
            {/* Success message */}
            <div className={`${theme.success} font-medium text-sm`}>
              {data.alreadyExisted
                ? "Name already exists"
                : "Name and CDP wallet created successfully"}
            </div>

            {/* Name information */}
            <div className="grid grid-cols-1 gap-2 text-sm">
              <div className="flex justify-between">
                <span className={`${theme.text} opacity-75`}>Display Name:</span>
                <span className={`${theme.text} font-mono`}>{data.name}</span>
              </div>
              <div className="flex justify-between">
                <span className={`${theme.text} opacity-75`}>CDP Name:</span>
                <span className={`${theme.text} font-mono`}>{data.cdpName}</span>
              </div>
              <div className="flex justify-between">
                <span className={`${theme.text} opacity-75`}>Wallet Address:</span>
                <span className={`${theme.text} break-all font-mono text-xs`}>
                  {data.walletAddress}
                </span>
              </div>
            </div>

            {/* CDP Account details */}
            {data.cdpAccount && (
              <div
                className={`${theme.bg.replace("bg-", "bg-")} rounded-lg border p-3 ${theme.border}`}
              >
                <div className={`${theme.accent} mb-2 font-medium text-xs`}>
                  CDP Account Details
                </div>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className={`${theme.text} opacity-75`}>Account ID:</span>
                    <span className={`${theme.text} font-mono`}>{data.cdpAccount.id}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className={`${theme.text} opacity-75`}>Network:</span>
                    <span className={`${theme.text}`}>Base Sepolia</span>
                  </div>
                </div>
              </div>
            )}

            {/* Timestamp */}
            {data.timestamp && (
              <div className={`${theme.text} text-xs opacity-50`}>
                Created: {new Date(data.timestamp).toLocaleString()}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {/* Error message */}
            <div className={`${theme.error} font-medium text-sm`}>
              {data?.error || "Unknown error occurred"}
            </div>

            {/* Error details */}
            {data?.details && (
              <details className="mt-2">
                <summary className={`${theme.text} cursor-pointer text-xs opacity-75`}>
                  Error Details
                </summary>
                <pre className={`${theme.text} mt-1 whitespace-pre-wrap text-xs opacity-60`}>
                  {data.details}
                </pre>
              </details>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
