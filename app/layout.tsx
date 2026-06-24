import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "HWS Investment Club",
  description:
    "Markets, research, and careers — the Hobart and William Smith Colleges Investment Club.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen bg-ink font-sans text-gray-100 antialiased">
        <Nav />
        {children}
        <Footer />
      </body>
    </html>
  );
}
