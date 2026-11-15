import type { Metadata, Viewport } from "next";
import { Fraunces, Outfit } from "next/font/google";
import { StudentChrome } from "@/components/student/StudentChrome";
import "./student.css";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
  display: "swap",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  weight: ["600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Ahariva",
  description: "Breakfast, lunch & dinner · cash on delivery",
  applicationName: "Ahariva",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Ahariva",
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
  return (
    <div className={`${outfit.variable} ${fraunces.variable} ${outfit.className}`}>
      <StudentChrome>{children}</StudentChrome>
    </div>
  );
}
