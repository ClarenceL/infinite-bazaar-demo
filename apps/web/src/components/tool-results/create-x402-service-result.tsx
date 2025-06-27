import type { ToolResultProps } from "./index";

const CREATE_X402_SERVICE_THEME = {
  bg: "bg-emerald-900/20",
  border: "border-emerald-700/50",
  text: "text-emerald-100",
  accent: "text-emerald-400",
  success: "text-emerald-300",
  error: "text-red-300",
  payment: "text-amber-300",
  link: "text-blue-400",
  service: "text-cyan-300",
};

export function CreateX402ServiceResult({ message }: ToolResultProps) {
  const theme = CREATE_X402_SERVICE_THEME;
  const data = message.toolResultData;

  // Create friendly title based on the service name
  const serviceName = data?.service?.serviceName || "Service";
  const agentName = data?.service?.agentName || "Agent";
  const title = `${agentName} creates "${serviceName}" service`;

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
            {/* Service Information */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className={`${theme.text} text-sm opacity-75`}>Service Type:</span>
                <span className={`${theme.service} font-medium text-sm capitalize`}>
                  {data.service?.serviceType || "analysis"}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className={`${theme.text} text-sm opacity-75`}>Price:</span>
                <span className={`${theme.payment} font-medium text-sm`}>
                  {data.service?.price} USDC{" "}
                  {data.service?.priceDescription && `(${data.service.priceDescription})`}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className={`${theme.text} text-sm opacity-75`}>Route:</span>
                <span className={`${theme.text} break-all font-mono text-xs`}>
                  {data.service?.route}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className={`${theme.text} text-sm opacity-75`}>Endpoint ID:</span>
                <span className={`${theme.text} break-all font-mono text-xs`}>
                  {data.service?.endpointId}
                </span>
              </div>
            </div>

            {/* Service Description */}
            {data.service?.description && (
              <div className={`rounded-lg border ${theme.border} bg-emerald-900/20 p-3`}>
                <div
                  className={`${theme.service} mb-2 flex items-center gap-1 font-medium text-xs`}
                >
                  📋 Service Description
                </div>
                <p className={`${theme.text} text-sm leading-relaxed`}>
                  {data.service.description}
                </p>
              </div>
            )}

            {/* Service Instructions */}
            {data.instructions && data.instructions.length > 0 && (
              <div className={`rounded-lg border ${theme.border} bg-blue-900/20 p-3`}>
                <div className={`${theme.link} mb-2 flex items-center gap-1 font-medium text-xs`}>
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

            {/* Service Stats */}
            <div className="grid grid-cols-2 gap-3">
              <div className={`rounded-lg border ${theme.border} bg-emerald-900/10 p-2`}>
                <div className={`${theme.text} text-xs opacity-75`}>Total Calls</div>
                <div className={`${theme.accent} font-semibold text-lg`}>
                  {data.service?.totalCalls || 0}
                </div>
              </div>
              <div className={`rounded-lg border ${theme.border} bg-emerald-900/10 p-2`}>
                <div className={`${theme.text} text-xs opacity-75`}>Total Revenue</div>
                <div className={`${theme.payment} font-semibold text-lg`}>
                  {data.service?.totalRevenue || "0"} USDC
                </div>
              </div>
            </div>

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
