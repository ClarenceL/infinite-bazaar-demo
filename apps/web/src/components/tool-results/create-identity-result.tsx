import type { ToolResultProps } from "./index";

const CREATE_IDENTITY_THEME = {
  bg: "bg-purple-900/20",
  border: "border-purple-700/50",
  text: "text-purple-100",
  accent: "text-purple-400",
  success: "text-purple-300",
  error: "text-red-300",
  payment: "text-amber-300",
  link: "text-blue-400",
};

export function CreateIdentityResult({ message }: ToolResultProps) {
  const theme = CREATE_IDENTITY_THEME;
  const data = message.toolResultData;

  // Create friendly title based on the entity name
  const entityName = data?.entityName || data?.identity?.entityId || "Agent";
  const title = `${entityName} establishes digital identity`;

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
            {/* Core Identity Information */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className={`${theme.text} text-sm opacity-75`}>Payment Method:</span>
                <span className={`${theme.payment} font-medium text-sm`}>
                  {data.paymentDetails?.method || "x402-cdp"}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className={`${theme.text} text-sm opacity-75`}>Claims Tree Root:</span>
                <span className={`${theme.text} break-all font-mono text-xs`}>
                  {data.authClaim?.claimsTreeRoot || "N/A"}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className={`${theme.text} text-sm opacity-75`}>Cost:</span>
                <span className={`${theme.payment} font-medium text-sm`}>
                  {data.serviceInfo?.price || "1 USDC"}
                </span>
              </div>
            </div>

            {/* IPFS Publication Link */}
            {data.ipfsPublication?.ipfsHash && (
              <div className={`rounded-lg border ${theme.border} bg-blue-900/20 p-3`}>
                <div className={`${theme.link} mb-2 flex items-center gap-1 font-medium text-xs`}>
                  🌐 IPFS Publication
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-blue-100 text-xs opacity-75">Verifiable Claim:</span>
                  <a
                    href={`https://gateway.pinata.cloud/ipfs/${data.ipfsPublication.ipfsHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`${theme.link} break-all font-mono text-xs hover:underline`}
                  >
                    {data.ipfsPublication.ipfsHash}
                  </a>
                </div>
                <div className="mt-1 flex items-center justify-between">
                  <span className="text-blue-100 text-xs opacity-75">Source:</span>
                  <span className="text-blue-100 text-xs">
                    {data.ipfsPublication.source || "pinata"}
                  </span>
                </div>
              </div>
            )}

            {/* Timestamp */}
            {data.timestamp && (
              <div className={`${theme.text} text-xs opacity-50`}>
                Completed: {new Date(data.timestamp).toLocaleString()}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {/* Error message */}
            <div className={`${theme.error} font-medium text-sm`}>
              {data?.error || "Unknown error occurred"}
            </div>

            {/* Status code */}
            {data?.statusCode && (
              <div className={`${theme.text} text-xs opacity-75`}>
                Status Code: {data.statusCode}
              </div>
            )}

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
