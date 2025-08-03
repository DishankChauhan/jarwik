import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import ConsoleOverrideProvider from "@/components/ConsoleOverrideProvider";
import Navbar from "@/components/Navbar";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Jarwik - AI Voice Assistant",
  description: "Your intelligent voice assistant powered by advanced AI",
  icons: {
    icon: [
      { url: '/favicon.ico' },
      { url: '/jarwik logo.png', type: 'image/png' },
    ],
    shortcut: '/favicon.ico',
    apple: '/jarwik logo.png',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} font-sans antialiased bg-white min-h-screen`}>
        <ConsoleOverrideProvider>
          <Navbar />
          <main className="pt-24 bg-white min-h-screen">
            {children}
          </main>
        </ConsoleOverrideProvider>
      </body>
    </html>
  );
}
