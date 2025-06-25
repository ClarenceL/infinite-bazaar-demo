import type { ToolResultProps } from "./index";

const TOOL_RESULT_THEME = {
  bg: "bg-blue-900/20",
  border: "border-blue-700/50",
  text: "text-blue-100",
  accent: "text-blue-400",
};

export function DefaultToolResult({ message }: ToolResultProps) {
  const theme = TOOL_RESULT_THEME;

  return (
    <div className="group mb-4 flex flex-col gap-2">
      {/* Tool result header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`font-semibold ${theme.accent} text-base`}>
            @tool-results/{message.toolName}
          </span>
          <div className={`h-1.5 w-1.5 rounded-full ${theme.accent.replace("text-", "bg-")}`} />
        </div>
        {message.completedAt === null ? (
          <span className="font-medium text-xs text-yellow-400">streaming...</span>
        ) : message.completedAt && Date.now() - message.completedAt < 30000 ? (
          <span className="font-medium text-green-400 text-xs">just completed</span>
        ) : null}
      </div>

      {/* Tool result content */}
      <div className={`rounded-xl ${theme.bg} ${theme.border} p-4 shadow-lg backdrop-blur-sm`}>
        <div className={`${theme.text} text-sm`}>
          {message.toolResultData ? (
            <pre className="whitespace-pre-wrap font-mono text-xs">
              {JSON.stringify(message.toolResultData, null, 2)}
            </pre>
          ) : (
            <div className="whitespace-pre-wrap leading-relaxed">{message.content}</div>
          )}
        </div>
      </div>
    </div>
  );
}
