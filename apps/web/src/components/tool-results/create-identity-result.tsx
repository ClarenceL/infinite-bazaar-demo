import type { ToolResultProps } from "./index";

const CREATE_IDENTITY_THEME = {
  bg: "bg-purple-900/20",
  border: "border-purple-700/50",
  text: "text-purple-100",
  accent: "text-purple-400",
  success: "text-purple-300",
  error: "text-red-300",
  payment: "text-amber-300",
};

export function CreateIdentityResult({ message }: ToolResultProps) {
  const theme = CREATE_IDENTITY_THEME;
  const data = message.toolResultData;

  return (
    <div className="group mb-4 flex flex-col gap-2">
      {/* Tool result header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`font-semibold ${theme.accent} text-base`}>
            @tool-results/create_identity
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
              {data.message || "Identity claim submitted successfully"}
            </div>

            {/* Service Information */}
            {data.serviceInfo && (
              <div
                className={`${theme.bg.replace("bg-", "bg-")} rounded-lg border p-3 ${theme.border}`}
              >
                <div className={`${theme.accent} mb-2 font-medium text-xs`}>
                  Service Information
                </div>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className={`${theme.text} opacity-75`}>x402 Enabled:</span>
                    <span className={`${theme.text}`}>
                      {data.serviceInfo.x402Enabled ? "✓ Yes" : "✗ No"}
                    </span>
                  </div>
                  {data.serviceInfo.price && (
                    <div className="flex justify-between">
                      <span className={`${theme.text} opacity-75`}>Price:</span>
                      <span className={`${theme.payment}`}>{data.serviceInfo.price}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Payment Details */}
            {data.paymentDetails && (
              <div className={`rounded-lg border border-amber-700/50 bg-amber-900/20 p-3`}>
                <div className={`${theme.payment} mb-2 font-medium text-xs`}>
                  💰 Payment Details
                </div>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-amber-100 opacity-75">Method:</span>
                    <span className="text-amber-100">
                      {data.paymentDetails.method || "x402-cdp"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-amber-100 opacity-75">Status:</span>
                    <span className="text-amber-100">
                      {data.paymentDetails.status || "processed"}
                    </span>
                  </div>
                  {data.paymentDetails.transactionHash && (
                    <div className="flex justify-between">
                      <span className="text-amber-100 opacity-75">Tx Hash:</span>
                      <span className="break-all font-mono text-amber-100 text-xs">
                        {data.paymentDetails.transactionHash}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* AuthClaim Details */}
            {data.authClaim && (
              <div
                className={`${theme.bg.replace("bg-", "bg-")} rounded-lg border p-3 ${theme.border}`}
              >
                <div className={`${theme.accent} mb-2 font-medium text-xs`}>🔐 Iden3 AuthClaim</div>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className={`${theme.text} opacity-75`}>Identity State:</span>
                    <span className={`${theme.text} break-all font-mono text-xs`}>
                      {data.authClaim.identityState}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className={`${theme.text} opacity-75`}>Claims Tree Root:</span>
                    <span className={`${theme.text} break-all font-mono text-xs`}>
                      {data.authClaim.claimsTreeRoot}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className={`${theme.text} opacity-75`}>Public Key X:</span>
                    <span className={`${theme.text} font-mono text-xs`}>
                      {data.authClaim.publicKeyX}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className={`${theme.text} opacity-75`}>Public Key Y:</span>
                    <span className={`${theme.text} font-mono text-xs`}>
                      {data.authClaim.publicKeyY}
                    </span>
                  </div>
                  {data.authClaim.blockchainPublication && (
                    <>
                      <div className="my-2 border-purple-700/30 border-t" />
                      <div className="flex justify-between">
                        <span className={`${theme.text} opacity-75`}>Blockchain Status:</span>
                        <span
                          className={`${
                            data.authClaim.blockchainPublication.success
                              ? "text-green-400"
                              : "text-yellow-400"
                          } text-xs`}
                        >
                          {data.authClaim.blockchainPublication.success
                            ? "✓ Published"
                            : "⚠ Mock/Failed"}
                        </span>
                      </div>
                      {data.authClaim.blockchainPublication.transactionHash && (
                        <div className="flex justify-between">
                          <span className={`${theme.text} opacity-75`}>Tx Hash:</span>
                          <span className={`${theme.text} break-all font-mono text-xs`}>
                            {data.authClaim.blockchainPublication.transactionHash}
                          </span>
                        </div>
                      )}
                      {data.authClaim.blockchainPublication.blockNumber && (
                        <div className="flex justify-between">
                          <span className={`${theme.text} opacity-75`}>Block:</span>
                          <span className={`${theme.text} font-mono text-xs`}>
                            #{data.authClaim.blockchainPublication.blockNumber}
                          </span>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Claim Submission Details */}
            {data.claimSubmission && (
              <div
                className={`${theme.bg.replace("bg-", "bg-")} rounded-lg border p-3 ${theme.border}`}
              >
                <div className={`${theme.accent} mb-2 font-medium text-xs`}>Claim Details</div>
                <div className="space-y-1 text-xs">
                  {data.claimSubmission.claimId && (
                    <div className="flex justify-between">
                      <span className={`${theme.text} opacity-75`}>Claim ID:</span>
                      <span className={`${theme.text} font-mono`}>
                        {data.claimSubmission.claimId}
                      </span>
                    </div>
                  )}
                  {data.claimSubmission.did && (
                    <div className="flex justify-between">
                      <span className={`${theme.text} opacity-75`}>DID:</span>
                      <span className={`${theme.text} break-all font-mono text-xs`}>
                        {data.claimSubmission.did}
                      </span>
                    </div>
                  )}
                  {data.claimSubmission.status && (
                    <div className="flex justify-between">
                      <span className={`${theme.text} opacity-75`}>Status:</span>
                      <span className={`${theme.text}`}>{data.claimSubmission.status}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* CDP Account Information */}
            {data.cdpAccount && (
              <div
                className={`${theme.bg.replace("bg-", "bg-")} rounded-lg border p-3 ${theme.border}`}
              >
                <div className={`${theme.accent} mb-2 font-medium text-xs`}>CDP Account Used</div>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className={`${theme.text} opacity-75`}>Name:</span>
                    <span className={`${theme.text} font-mono`}>{data.cdpAccount.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className={`${theme.text} opacity-75`}>Address:</span>
                    <span className={`${theme.text} break-all font-mono text-xs`}>
                      {data.cdpAccount.address}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className={`${theme.text} opacity-75`}>Account ID:</span>
                    <span className={`${theme.text} font-mono`}>{data.cdpAccount.id}</span>
                  </div>
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
