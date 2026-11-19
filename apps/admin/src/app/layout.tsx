import type { Metadata, Viewport } from "next";
import Script from "next/script";
import {
  ThemeProvider,
  THEME_BOOT_SCRIPT,
} from "@/components/ThemeProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ahariva Admin",
  description: "Admin dashboard for breakfast, lunch & dinner · COD",
  applicationName: "Ahariva Admin",
  manifest: "/admin-manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Ahariva Admin",
    statusBarStyle: "default",
  },
  icons: {
    icon: [{ url: "/icons/192", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/icons/192", sizes: "192x192", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#172019" },
    { media: "(prefers-color-scheme: dark)", color: "#0f1412" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <Script
          id="ahariva-theme-boot"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }}
        />
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
