import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AppProviders } from "@/components/app-providers";

export const metadata: Metadata = {
  title: { default: "Rumbo", template: "%s · Rumbo" },
  description: "Build practical Mexican Spanish confidence before your trip.",
  applicationName: "Rumbo",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Rumbo" },
  formatDetection: { telephone: false },
};
export const viewport: Viewport = {
  themeColor: "#FFF8EC",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
