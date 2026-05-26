import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SwimCoach — AI-Powered Swim Training",
  description: "Track every meter, analyze your SWOLF and pace, and get personalized coaching from Claude AI.",
  keywords: ["swimming", "swim coach", "AI coach", "swim tracking", "SWOLF", "triathlon"],
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
