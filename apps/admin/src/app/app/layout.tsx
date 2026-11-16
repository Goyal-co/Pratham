import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { StudentChrome } from "@/components/student/StudentChrome";
import "./student.css";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
  display: "swap",
  weight: ["400", "600", "700"],
});

export const metadata: Metadata = {
  title: "AHARIVA",
  description: "Homemade meals for student life",
  applicationName: "AHARIVA",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "AHARIVA",
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
    <div className={`${jakarta.variable} ${jakarta.className}`}>
      <StudentChrome>{children}</StudentChrome>
    </div>
  );
}
