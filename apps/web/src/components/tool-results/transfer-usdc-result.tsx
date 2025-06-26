import type { ToolResultProps } from "./index";

const TRANSFER_USDC_THEME = {
  bg: "bg-cyan-900/20",
  border: "border-cyan-700/50",
  text: "text-cyan-100",
  accent: "text-cyan-400",
  success: "text-cyan-300",
  error: "text-red-300",
  amount: "text-green-300",
};

export function TransferUsdcResult({ message }: ToolResultProps) {
  const theme = TRANSFER_USDC_THEME;
  const data = message.toolResultData;

  // Create friendly title based on the transfer details
  const amount = data?.amount || "0";
  const title = `Transfer ${amount} USDC`;

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
        {data?.success ? (
          <div className="space-y-3">
            {/* Success message */}
            <div className={`${theme.success} font-medium text-sm`}>
              {data.message || "USDC transfer completed successfully"}
            </div>

            {/* Transfer Amount - Prominent Display */}
            <div className={`rounded-lg border border-green-700/50 bg-green-900/20 p-3`}>
              <div className="flex items-center justify-between">
                <span className="text-green-100 text-sm opacity-75">Amount Transferred:</span>
                <div className="text-right">
                  <div className={`${theme.amount} font-bold text-lg`}>{data.amount} USDC</div>
                  <div className="font-mono text-green-100 text-xs opacity-60">
                    {data.amountInSmallestUnit} wei
                  </div>
                </div>
              </div>
            </div>

            {/* Transaction Details */}
            <div
              className={`${theme.bg.replace("bg-", "bg-")} rounded-lg border p-3 ${theme.border}`}
            >
              <div className={`${theme.accent} mb-2 font-medium text-xs`}>Transaction Details</div>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className={`${theme.text} opacity-75`}>From:</span>
                  <span className={`${theme.text} break-all font-mono text-xs`}>{data.from}</span>
                </div>
                <div className="flex justify-between">
                  <span className={`${theme.text} opacity-75`}>To:</span>
                  <span className={`${theme.text} break-all font-mono text-xs`}>{data.to}</span>
                </div>
                <div className="flex justify-between">
                  <span className={`${theme.text} opacity-75`}>Network:</span>
                  <span className={`${theme.text} capitalize`}>{data.network}</span>
                </div>
                <div className="flex justify-between">
                  <span className={`${theme.text} opacity-75`}>Token:</span>
                  <span className={`${theme.text} uppercase`}>{data.token}</span>
                </div>
              </div>
            </div>

            {/* Transaction Hash - Collapsed by default */}
            {data.transactionHash && (
              <details
                className={`${theme.bg.replace("bg-", "bg-")} rounded-lg border ${theme.border}`}
              >
                <summary
                  className={`${theme.accent} cursor-pointer p-3 font-medium text-xs hover:${theme.success} transition-colors`}
                >
                  Transaction Hash
                </summary>
                <div className="px-3 pb-3">
                  <div
                    className={`${theme.text} break-all rounded bg-black/20 p-2 font-mono text-xs`}
                  >
                    {data.transactionHash}
                  </div>
                  <div className="mt-2">
                    <a
                      href={`https://sepolia.basescan.org/tx/${data.transactionHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`${theme.accent}hover:${theme.success} text-xs underline`}
                    >
                      View on Base Sepolia Explorer ↗
                    </a>
                  </div>
                </div>
              </details>
            )}

            {/* Network Information - Collapsed by default */}
            <details
              className={`${theme.bg.replace("bg-", "bg-")} rounded-lg border ${theme.border}`}
            >
              <summary
                className={`${theme.accent} cursor-pointer p-3 font-medium text-xs hover:${theme.success} transition-colors`}
              >
                Network Information
              </summary>
              <div className="px-3 pb-3">
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className={`${theme.text} opacity-75`}>Blockchain:</span>
                    <span className={`${theme.text}`}>Base Sepolia (Testnet)</span>
                  </div>
                  <div className="flex justify-between">
                    <span className={`${theme.text} opacity-75`}>Token Standard:</span>
                    <span className={`${theme.text}`}>ERC-20</span>
                  </div>
                  <div className="flex justify-between">
                    <span className={`${theme.text} opacity-75`}>Decimals:</span>
                    <span className={`${theme.text}`}>6</span>
                  </div>
                </div>
              </div>
            </details>
          </div>
        ) : (
          <div className="space-y-2">
            {/* Error message */}
            <div className={`${theme.error} font-medium text-sm`}>
              {data?.error || "Unknown error occurred during USDC transfer"}
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
