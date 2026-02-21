import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Wednesday Waffles",
  description: "Send a voice message to a friend every Wednesday",
  manifest: "/manifest.json",
  themeColor: "#d97706",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Waffles",
  },
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
