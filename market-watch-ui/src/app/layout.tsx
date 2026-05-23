import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AppShell } from "@/components/layout/app-shell";

export const metadata: Metadata = {
  title: "Market Watch",
  description: "Comprehensive Market Tracker",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Market Watch",
  },
  icons: {
    icon: "/favicon.ico",
  },
};

export const viewport: Viewport = {
  themeColor: "#0f1115",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){try{var s=localStorage.getItem('theme')||'dark';document.documentElement.setAttribute('data-theme',s)}catch(e){document.documentElement.setAttribute('data-theme','dark')}})();",
          }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html:
              "if ('serviceWorker' in navigator) { navigator.serviceWorker.register('/sw.js').catch(function(){}); }",
          }}
        />
      </head>
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
