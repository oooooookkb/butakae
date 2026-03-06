import type { Metadata, Viewport } from "next";
import "./globals.css";
import AuthGuard from "@/components/AuthGuard";

export const metadata: Metadata = {
  title: "부탁해 - 동네 부탁 마켓",
  description: "누구나 부탁을 올리고, 누구나 해결하고 돈을 버는 동네 마켓",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "부탁해",
  },
};

export const viewport: Viewport = {
  themeColor: "#00C9A7",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>
        <AuthGuard>{children}</AuthGuard>
      </body>
    </html>
  );
}
