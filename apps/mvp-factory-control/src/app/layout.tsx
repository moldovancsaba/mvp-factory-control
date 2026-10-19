/**
 * Root application layout with bundled IBM Plex fonts and global styles.
 * Local assets remove build-time font-provider requests; CSS variable names
 * are shared with globals.css.
 */
import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const sans = localFont({
  src: "./fonts/IBMPlexSans-Variable.ttf",
  weight: "400 700",
  style: "normal",
  display: "swap",
  variable: "--font-sans"
});
const mono = localFont({
  src: [
    { path: "./fonts/IBMPlexMono-Regular.ttf", weight: "400", style: "normal" },
    { path: "./fonts/IBMPlexMono-Medium.ttf", weight: "500", style: "normal" },
    { path: "./fonts/IBMPlexMono-SemiBold.ttf", weight: "600", style: "normal" }
  ],
  display: "swap",
  variable: "--font-mono"
});

export const metadata: Metadata = {
  title: "MVP Factory Control",
  description: "Local-first control plane for agents and the MVP Factory Board"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`}>
      <body className="font-sans">{children}</body>
    </html>
  );
}
