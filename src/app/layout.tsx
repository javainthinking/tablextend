import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  weight: ['400', '500', '600', '700'],
});

export const metadata: Metadata = {
  title: "Tablextend - AI-Powered Data Extension for Spreadsheets",
  description: "Upload your Excel or CSV files and use AI to automatically extend your data with intelligent insights.",
  keywords: ["AI", "Excel", "CSV", "data analysis", "spreadsheet", "automation", "data extension"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-theme="light">
      <body className={inter.className}>
        {children}
      </body>
    </html>
  );
}
