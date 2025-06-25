# Tool Results Components

This folder contains specialized renderers for different tool result types in the InfiniteBazaar chat interface.

## Architecture

The tool result rendering system uses a modular approach where each tool type has its own dedicated renderer component. This provides better user experience with tool-specific formatting and styling.

### Components

- **`index.ts`** - Main registry that maps tool names to their renderers
- **`default-tool-result.tsx`** - Fallback renderer for unknown tools or basic JSON display
- **`create-name-result.tsx`** - Specialized renderer for CDP wallet creation results
- **`create-identity-result.tsx`** - Specialized renderer for DID identity claims with x402 payments
- **`transfer-usdc-result.tsx`** - Specialized renderer for USDC transfer transactions

### Usage

The system automatically selects the appropriate renderer based on the `toolName` field:

```tsx
// In chat-container.tsx
const ToolResultRenderer = getToolResultRenderer(message.toolName);
return <ToolResultRenderer message={toolResultMessage} />;
```

### Adding New Tool Renderers

1. Create a new component file (e.g., `my-tool-result.tsx`)
2. Export the component following the `ToolResultProps` interface
3. Add the mapping to `TOOL_RESULT_RENDERERS` in `index.ts`
4. Export the component from `index.ts`

### Design Principles

- **Tool-specific themes**: Each tool has its own color scheme for better visual distinction
- **Rich formatting**: Display structured data in user-friendly formats instead of raw JSON
- **Status indicators**: Show success/error states prominently
- **Progressive disclosure**: Use collapsible sections for detailed error information
- **Consistent layout**: All renderers follow the same header/content structure

### Themes

Each tool renderer uses a distinct color theme:
- **create_name**: Emerald theme (account creation)
- **create_identity**: Purple theme (identity/DID operations)
- **transfer_usdc**: Cyan theme (financial transactions)
- **default**: Blue theme (fallback)

### Error Handling

All renderers gracefully handle both success and error states, providing:
- Clear error messages
- Collapsible error details
- Status codes when available
- Helpful context for debugging 