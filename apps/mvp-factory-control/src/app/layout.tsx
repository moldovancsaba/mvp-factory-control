/**
 * Root layout for the Next.js App Router: global fonts (IBM Plex Sans / Mono), `globals.css`, and
 * default HTML shell. All routes render inside `{children}`. Metadata titles the app for the browser tab.
 */
//> Import bindings from a module.
import type { Metadata } from "next";
//> Import bindings from a module.
import { IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
//> Import bindings from a module.
import "./globals.css";

//> Variable declaration.
const sans = IBM_Plex_Sans({
  //> Source statement or expression.
  subsets: ["latin"],
  //> Source statement or expression.
  weight: ["400", "500", "600", "700"],
  //> Source statement or expression.
  variable: "--font-sans"
//> Brace or statement terminator.
});
//> Variable declaration.
const mono = IBM_Plex_Mono({
  //> Source statement or expression.
  subsets: ["latin"],
  //> Source statement or expression.
  weight: ["400", "500", "600"],
  //> Source statement or expression.
  variable: "--font-mono"
//> Brace or statement terminator.
});

//> Export declaration.
export const metadata: Metadata = {
  //> Source statement or expression.
  title: "MVP Factory Control",
  //> Source statement or expression.
  description: "Local-first control plane for agents and the MVP Factory Board"
//> Brace or statement terminator.
};

//> Export declaration.
export default function RootLayout({
  //> Source statement or expression.
  children
//> Source statement or expression.
}: Readonly<{
  //> Source statement or expression.
  children: React.ReactNode;
//> Source statement or expression.
}>) {
  //> Return a value.
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`}>
      <body className="font-sans">{children}</body>
    </html>
  );
//> Brace or statement terminator.
}
