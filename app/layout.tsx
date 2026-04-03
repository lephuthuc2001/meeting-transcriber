import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import ConfigureAmplify from "./components/ConfigureAmplify";
import { Toaster } from "@/components/ui/sonner";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "Bien Ban Cuoc Hop",
  description: "Cong cu chuyen doi ghi am cuoc hop thanh bien ban",
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
