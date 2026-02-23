import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Wafflemaker",
  description:
    "Async voice pen-pals. Record a waffle, send it to a friend, and hear back on Wednesday.",
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
  openGraph: {
    title: "Wafflemaker",
    description:
      "Async voice pen-pals. Record a waffle, send it to a friend, and hear back on Wednesday.",
    type: "website",
    siteName: "Wafflemaker",
  },
  twitter: {
    card: "summary",
    title: "Wafflemaker",
    description:
      "Async voice pen-pals. Send voice waffles to friends every week.",
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
      <head>
        <link
          rel="preconnect"
          href="https://fonts.googleapis.com"
        />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Work+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400&family=Lato:ital,wght@0,400;0,700;1,400&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-gingham text-syrup antialiased">
        {children}
      </body>
    </html>
  );
}
