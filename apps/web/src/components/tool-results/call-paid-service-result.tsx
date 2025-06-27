import type { ToolResultProps } from "./index";

const CALL_PAID_SERVICE_THEME = {
  bg: "bg-violet-900/20",
  border: "border-violet-700/50",
  text: "text-violet-100",
  accent: "text-violet-400",
  success: "text-violet-300",
  error: "text-red-300",
  payment: "text-amber-300",
  link: "text-blue-400",
  service: "text-cyan-300",
  response: "text-green-300",
  metadata: "text-gray-300",
};

export function CallPaidServiceResult({ message }: ToolResultProps) {
  const theme = CALL_PAID_SERVICE_THEME;
  const data = message.toolResultData;

  // Create friendly title based on the service call
  const serviceName = data?.serviceCall?.serviceName || "Service";
  const provider = data?.serviceCall?.provider || "Provider";
  const title = `Called "${serviceName}" by ${provider}`;

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
          <div className="space-y-4">
            {/* Service Call Summary */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className={`${theme.text} text-sm opacity-75`}>Call ID:</span>
                <span className={`${theme.text} break-all font-mono text-xs`}>
                  {data.serviceCall?.callId}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className={`${theme.text} text-sm opacity-75`}>Price:</span>
                <span className={`${theme.payment} font-medium text-sm`}>
                  {data.serviceCall?.price} USDC{" "}
                  {data.serviceCall?.priceDescription && `(${data.serviceCall.priceDescription})`}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className={`${theme.text} text-sm opacity-75`}>Payment Hash:</span>
                <span className={`${theme.text} break-all font-mono text-xs`}>
                  {data.serviceCall?.paymentHash}
                </span>
              </div>
            </div>

            {/* Payment Details */}
            {data.payment && (
              <div className={`rounded-lg border ${theme.border} bg-amber-900/20 p-3`}>
                <div
                  className={`${theme.payment} mb-2 flex items-center gap-1 font-medium text-xs`}
                >
                  💳 Payment Details
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex items-center justify-between">
                    <span className={`${theme.text} text-xs opacity-75`}>Amount:</span>
                    <span className={`${theme.payment} font-medium text-xs`}>
                      {data.payment.amount} {data.payment.currency}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className={`${theme.text} text-xs opacity-75`}>Status:</span>
                    <span className={`${theme.success} font-medium text-xs capitalize`}>
                      {data.payment.status}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Service Input */}
            {data.serviceCall?.response?.input && (
              <div className={`rounded-lg border ${theme.border} bg-blue-900/20 p-3`}>
                <div className={`${theme.link} mb-2 flex items-center gap-1 font-medium text-xs`}>
                  📝 Service Input
                </div>
                <div className="space-y-2">
                  {Object.entries(data.serviceCall.response.input).map(([key, value]) => (
                    <div key={key} className="space-y-1">
                      <div className={`${theme.text} text-xs capitalize opacity-75`}>{key}:</div>
                      <div
                        className={`${theme.text} rounded bg-blue-900/10 p-2 text-sm leading-relaxed`}
                      >
                        {typeof value === "string" ? value : JSON.stringify(value, null, 2)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Service Response */}
            {data.serviceCall?.response?.output && (
              <div className={`rounded-lg border ${theme.border} bg-green-900/20 p-3`}>
                <div
                  className={`${theme.response} mb-2 flex items-center gap-1 font-medium text-xs`}
                >
                  🎯 Service Response
                </div>
                <div className="space-y-2">
                  {data.serviceCall.response.output.result && (
                    <div className="space-y-1">
                      <div className={`${theme.text} text-xs opacity-75`}>Result:</div>
                      <div
                        className={`${theme.text} whitespace-pre-wrap rounded bg-green-900/10 p-3 text-sm leading-relaxed`}
                      >
                        {data.serviceCall.response.output.result}
                      </div>
                    </div>
                  )}

                  {data.serviceCall.response.output.message && (
                    <div className="space-y-1">
                      <div className={`${theme.text} text-xs opacity-75`}>Message:</div>
                      <div className={`${theme.text} text-sm leading-relaxed`}>
                        {data.serviceCall.response.output.message}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Service Metadata */}
            {(data.serviceCall?.response?.metadata ||
              data.serviceCall?.response?.output?.metadata) && (
              <div className={`rounded-lg border ${theme.border} bg-gray-900/20 p-3`}>
                <div
                  className={`${theme.metadata} mb-2 flex items-center gap-1 font-medium text-xs`}
                >
                  📊 Service Metadata
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {/* Response metadata */}
                  {data.serviceCall.response.metadata &&
                    Object.entries(data.serviceCall.response.metadata).map(([key, value]) => (
                      <div key={key} className="flex items-center justify-between">
                        <span className={`${theme.text} capitalize opacity-75`}>
                          {key.replace(/([A-Z])/g, " $1").toLowerCase()}:
                        </span>
                        <span className={`${theme.metadata}`}>
                          {typeof value === "boolean"
                            ? value
                              ? "✓"
                              : "✗"
                            : typeof value === "number"
                              ? value.toLocaleString()
                              : String(value)}
                        </span>
                      </div>
                    ))}

                  {/* Output metadata */}
                  {data.serviceCall.response.output?.metadata &&
                    Object.entries(data.serviceCall.response.output.metadata).map(
                      ([key, value]) => (
                        <div key={`output-${key}`} className="flex items-center justify-between">
                          <span className={`${theme.text} capitalize opacity-75`}>
                            {key.replace(/([A-Z])/g, " $1").toLowerCase()}:
                          </span>
                          <span className={`${theme.metadata}`}>
                            {typeof value === "boolean"
                              ? value
                                ? "✓"
                                : "✗"
                              : typeof value === "number"
                                ? value.toLocaleString()
                                : String(value)}
                          </span>
                        </div>
                      ),
                    )}
                </div>
              </div>
            )}

            {/* Instructions */}
            {data.instructions && data.instructions.length > 0 && (
              <div className={`rounded-lg border ${theme.border} bg-violet-900/20 p-3`}>
                <div className={`${theme.accent} mb-2 flex items-center gap-1 font-medium text-xs`}>
                  💡 Next Steps
                </div>
                <ul className="space-y-1">
                  {data.instructions.map((instruction: string, index: number) => (
                    <li key={index} className={`${theme.text} text-xs leading-relaxed`}>
                      • {instruction}
                    </li>
                  ))}
                </ul>
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
              {data?.error || data?.message || "Unknown error occurred"}
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
