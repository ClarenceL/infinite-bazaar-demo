import type { ToolResultProps } from "./index";

const DISCOVER_SERVICES_THEME = {
  bg: "bg-indigo-900/20",
  border: "border-indigo-700/50",
  text: "text-indigo-100",
  accent: "text-indigo-400",
  success: "text-indigo-300",
  error: "text-red-300",
  payment: "text-amber-300",
  link: "text-blue-400",
  service: "text-cyan-300",
  stats: "text-purple-300",
};

export function DiscoverServicesResult({ message }: ToolResultProps) {
  const theme = DISCOVER_SERVICES_THEME;
  const data = message.toolResultData;

  // Create friendly title based on the number of services found
  const servicesCount = data?.services?.length || 0;
  const title = `Discovered ${servicesCount} available service${servicesCount !== 1 ? "s" : ""}`;

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
            {/* Search Summary */}
            {data.summary && (
              <div className={`rounded-lg border ${theme.border} bg-indigo-900/20 p-3`}>
                <div className={`${theme.stats} mb-2 flex items-center gap-1 font-medium text-xs`}>
                  📊 Discovery Summary
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="text-center">
                    <div className={`${theme.accent} font-semibold text-lg`}>
                      {data.summary.totalServicesFound}
                    </div>
                    <div className={`${theme.text} text-xs opacity-75`}>Services</div>
                  </div>
                  <div className="text-center">
                    <div className={`${theme.accent} font-semibold text-lg`}>
                      {data.summary.uniqueAgents}
                    </div>
                    <div className={`${theme.text} text-xs opacity-75`}>Agents</div>
                  </div>
                  <div className="text-center">
                    <div className={`${theme.payment} font-semibold text-lg`}>
                      {data.summary.priceRange?.min !== undefined &&
                      data.summary.priceRange?.max !== undefined
                        ? data.summary.priceRange.min === data.summary.priceRange.max
                          ? `${data.summary.priceRange.min}`
                          : `${data.summary.priceRange.min}-${data.summary.priceRange.max}`
                        : "N/A"}
                    </div>
                    <div className={`${theme.text} text-xs opacity-75`}>USDC Range</div>
                  </div>
                </div>
              </div>
            )}

            {/* Applied Filters */}
            {data.filters && (
              <div className={`rounded-lg border ${theme.border} bg-blue-900/20 p-3`}>
                <div className={`${theme.link} mb-2 flex items-center gap-1 font-medium text-xs`}>
                  🔍 Search Filters
                </div>
                <div className="space-y-1">
                  {data.filters.serviceType && data.filters.serviceType !== "all" && (
                    <div className="flex items-center justify-between">
                      <span className={`${theme.text} text-xs opacity-75`}>Service Type:</span>
                      <span className={`${theme.service} text-xs capitalize`}>
                        {data.filters.serviceType}
                      </span>
                    </div>
                  )}
                  {data.filters.maxPrice && (
                    <div className="flex items-center justify-between">
                      <span className={`${theme.text} text-xs opacity-75`}>Max Price:</span>
                      <span className={`${theme.payment} text-xs`}>
                        {data.filters.maxPrice} USDC
                      </span>
                    </div>
                  )}
                  {data.filters.searchQuery && (
                    <div className="flex items-center justify-between">
                      <span className={`${theme.text} text-xs opacity-75`}>Search Query:</span>
                      <span className={`${theme.text} font-mono text-xs`}>
                        "{data.filters.searchQuery}"
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Services List */}
            {data.services && data.services.length > 0 && (
              <div className="space-y-3">
                <div className={`${theme.service} flex items-center gap-1 font-medium text-sm`}>
                  🛍️ Available Services
                </div>
                {data.services.map((service: any, index: number) => (
                  <div
                    key={service.endpointId || index}
                    className={`rounded-lg border ${theme.border} bg-indigo-900/10 p-3`}
                  >
                    <div className="space-y-2">
                      {/* Service Header */}
                      <div className="flex items-start justify-between">
                        <div>
                          <div className={`${theme.accent} font-semibold text-sm`}>
                            {service.serviceName}
                          </div>
                          <div className={`${theme.text} text-xs opacity-75`}>
                            by {service.agentName} ({service.agentId})
                          </div>
                        </div>
                        <div className="text-right">
                          <div className={`${theme.payment} font-semibold text-sm`}>
                            {service.price} USDC
                          </div>
                          {service.priceDescription && (
                            <div className={`${theme.text} text-xs opacity-75`}>
                              {service.priceDescription}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Service Description */}
                      {service.description && (
                        <p className={`${theme.text} text-sm leading-relaxed`}>
                          {service.description}
                        </p>
                      )}

                      {/* Service Details */}
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="flex items-center justify-between">
                          <span className={`${theme.text} opacity-75`}>Route:</span>
                          <span className={`${theme.text} font-mono`}>{service.route}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className={`${theme.text} opacity-75`}>Trust Score:</span>
                          <span className={`${theme.stats}`}>{service.trustScore || 0}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className={`${theme.text} opacity-75`}>Total Calls:</span>
                          <span className={`${theme.accent}`}>{service.totalCalls || 0}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className={`${theme.text} opacity-75`}>Revenue:</span>
                          <span className={`${theme.payment}`}>
                            {service.totalRevenue || 0} USDC
                          </span>
                        </div>
                      </div>

                      {/* Relationship Info */}
                      {service.relationshipSummary && (
                        <div className={`${theme.text} text-xs opacity-60`}>
                          💭 {service.relationshipSummary}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Instructions */}
            {data.instructions && data.instructions.length > 0 && (
              <div className={`rounded-lg border ${theme.border} bg-emerald-900/20 p-3`}>
                <div
                  className={`${theme.success} mb-2 flex items-center gap-1 font-medium text-xs`}
                >
                  💡 How to Use These Services
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
                Discovered: {new Date(data.timestamp).toLocaleString()}
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
