import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ScholarForge AI — Assignment & Lab Writer",
  description: "A cinematic AI workspace for assignments and professional lab tasks.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
