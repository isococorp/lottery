import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Tianming Lottery Analyzer",
  description: "เครื่องมือทดลองเชิงสถิติเพื่อการศึกษา — ไม่ใช่การพยากรณ์",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Prompt:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
