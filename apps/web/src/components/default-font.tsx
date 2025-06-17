"use client";

import { useEffect } from "react";

// The single source of truth for the default font family
export const DEFAULT_FONT_FAMILY = "Satoshi, sans-serif";

export function DefaultFont() {
  useEffect(() => {
    // Just enforce Satoshi directly without recreating @font-face
    const style = document.createElement("style");
    style.textContent = `
      /* Apply Satoshi to all elements */
      * {
        font-family: ${DEFAULT_FONT_FAMILY} !important;
      }
    `;

    document.head.appendChild(style);

    // Force body to use Satoshi
    document.body.style.fontFamily = DEFAULT_FONT_FAMILY;

    return () => {
      document.head.removeChild(style);
    };
  }, []);

  return null;
}
