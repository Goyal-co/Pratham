import { DM_Sans, Syne } from "next/font/google";
import { AppChrome } from "@/components/AppChrome";

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  display: "swap",
});

const syne = Syne({
  subsets: ["latin"],
  variable: "--font-syne",
  weight: ["600", "700", "800"],
  display: "swap",
});

export const dynamic = "force-dynamic";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className={`${dmSans.variable} ${syne.variable} ${dmSans.className}`}>
      <AppChrome>{children}</AppChrome>
    </div>
  );
}
