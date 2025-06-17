import { DefaultFont } from "@/components/default-font";
import { ThemeProvider } from "@/providers/theme-provider";
import type { Metadata, Viewport } from "next";

import "./globals.css";

// Override console.debug
if (process.env.LOG_LEVEL === "info") {
  console.debug = () => {}; // No-op to suppress debug logs
  console.trace = () => {}; // No-op to suppress trace logs
}

export const metadata: Metadata = {
  title: "Infinite Bazaar - AI Agent Protocol",
  description: "A protocol for secure, scalable AI agent identities using AWS Nitro Enclaves",
  metadataBase: new URL("https://infinite-bazaar.dev"),
  openGraph: {
    title: "Infinite Bazaar | AI Agent Identity Protocol",
    description:
      "A protocol for secure, scalable AI agent identities using AWS Nitro Enclaves, Privado ID DIDs, and Coinbase CDP wallets",
    url: "https://infinite-bazaar.dev",
    siteName: "Infinite Bazaar",
    images: [
      {
        url: "/infinite-bazaar-og.jpg",
        width: 1200,
        height: 675,
        alt: "Infinite Bazaar",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Infinite Bazaar | AI Agent Identity Protocol",
    description:
      "A protocol for secure, scalable AI agent identities using AWS Nitro Enclaves, Privado ID DIDs, and Coinbase CDP wallets",
    images: ["/infinite-bazaar-og.jpg"],
    creator: "@infinite_bazaar",
    site: "@infinite_bazaar",
  },
  icons: {
    icon: "/favicon.ico",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  minimumScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html suppressHydrationWarning lang="en" className="dark">
      <head>
        {/* Link the downloaded Satoshi CSS file */}
        <link rel="stylesheet" href="/fonts/satoshi.css" />
      </head>

      <body className="min-h-screen bg-background font-satoshi antialiased">
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
          <DefaultFont />
          <div className="flex min-h-screen flex-col">{children}</div>
          {process.env.NODE_ENV !== "production" && (
            <div className="fixed bottom-1 left-1 z-50 flex size-6 items-center justify-center rounded-full bg-gray-800 p-3 font-mono text-white text-xs">
              <div className="block sm:hidden">xs</div>
              <div className="hidden sm:block md:hidden lg:hidden xl:hidden 2xl:hidden">sm</div>
              <div className="hidden md:block lg:hidden xl:hidden 2xl:hidden">md</div>
              <div className="hidden lg:block xl:hidden 2xl:hidden">lg</div>
              <div className="hidden xl:block 2xl:hidden">xl</div>
              <div className="hidden 2xl:block">2xl</div>
            </div>
          )}
        </ThemeProvider>
      </body>
    </html>
  );
}
