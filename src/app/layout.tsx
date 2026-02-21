import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Wednesday Waffles",
  description: "Send a voice message to a friend every Wednesday",
  manifest: "/manifest.json",
  icons: {
    icon: "/favicon.ico",
    apple: "/icon-192.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Waffles",
  },
};

export const viewport = {
  themeColor: "#d97706",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-amber-50 text-gray-900 antialiased">
        {children}
      </body>
    </html>
  );
}
