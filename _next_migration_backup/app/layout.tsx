import type { Metadata } from "next";
import "./globals.css";
import Shell from "@/components/layout/Shell";

export const metadata: Metadata = {
  title: "TabraCadabra | High-Performance Debate Tabulation",
  description: "The magical alternative to legacy debate tabulation software.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      </head>
      <body>
        <div id="modal-root"></div>
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
