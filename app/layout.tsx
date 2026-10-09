import type { Metadata, Viewport } from "next";
import { Be_Vietnam_Pro, Noto_Serif } from "next/font/google";
import "./globals.css";
import ConfigureAmplify from "./components/ConfigureAmplify";
import { Toaster } from "@/components/ui/sonner";

const sans = Be_Vietnam_Pro({
  subsets: ["vietnamese", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans-vn",
  display: "swap",
});

const serif = Noto_Serif({
  subsets: ["vietnamese", "latin"],
  weight: ["400", "600", "700"],
  variable: "--font-serif-vn",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Biên Bản Cuộc Họp",
  description:
    "Chuyển đổi ghi âm cuộc họp thành Nghị quyết Chi bộ theo đúng thể thức",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#8f1d1d",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi">
      <body className={`${sans.variable} ${serif.variable} font-sans antialiased`}>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
        >
          Bỏ qua đến nội dung chính
        </a>
        <ConfigureAmplify />
        {children}
        <Toaster richColors position="top-center" />
      </body>
    </html>
  );
}
