import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import ConfigureAmplify from "./components/ConfigureAmplify";
import { Toaster } from "@/components/ui/sonner";

const inter = Inter({ subsets: ["latin", "vietnamese"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "Biên Bản Cuộc Họp",
  description: "Công cụ chuyển đổi ghi âm cuộc họp thành biên bản",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi">
      <body className={`${inter.variable} font-sans antialiased`}>
        <ConfigureAmplify />
        {children}
        <Toaster richColors position="top-center" />
      </body>
    </html>
  );
}
