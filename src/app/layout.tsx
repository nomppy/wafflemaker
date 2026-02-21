import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Wafflemaker",
  description: "Send a voice message to a friend every Wednesday",
  manifest: "/manifest.json",
  icons: {
    icon: "/favicon.ico",
    apple: "/icon-192.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Wafflemaker",
  },
};

export const viewport = {
  themeColor: "#fffbf0",
  viewportFit: "cover" as const,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gingham text-syrup antialiased">
        {children}
      </body>
    </html>
  );
}
