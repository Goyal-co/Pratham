import type { Metadata, Viewport } from "next";
import { StudentChrome } from "@/components/student/StudentChrome";
import "./student.css";

export const metadata: Metadata = {
  title: "Pratham Tiffin",
  description: "Order tiffin · cash on delivery",
  applicationName: "Pratham",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Pratham",
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
  themeColor: "#FC8019",
};

export default function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <StudentChrome>{children}</StudentChrome>;
}
