import type { Metadata } from "next";
import "./globals.css";
import localFont from "next/font/local";
import { cn } from "@/lib/utils";

const geist = localFont({
  src: "../node_modules/geist/dist/fonts/geist-sans/Geist-Variable.woff2",
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "Jobops Dashboard",
  description: "Job search command center — fetched jobs, applications, referrals, progress",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={cn("dark", "font-sans", geist.variable)}>
      <body>{children}</body>
    </html>
  );
}
