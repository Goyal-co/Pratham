import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Rotatinal Admin",
  description:
    "Admin dashboard for Rotatinal — rotational breakfast, lunch & dinner",
  applicationName: "Rotatinal Admin",
  manifest: "/admin-manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Rotatinal Admin",
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
  themeColor: "#172019",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
