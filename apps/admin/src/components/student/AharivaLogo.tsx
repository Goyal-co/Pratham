"use client";

type Props = {
  /** Compact mark for headers; wordmark for auth/splash */
  variant?: "mark" | "full";
  className?: string;
  height?: number;
};

export function AharivaLogo({
  variant = "mark",
  className,
  height,
}: Props) {
  const h = height ?? (variant === "full" ? 40 : 28);
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/ahariva-logo.png"
      alt="Ahariva"
      className={className}
      height={h}
      style={{
        height: h,
        width: "auto",
        display: "block",
        objectFit: "contain",
      }}
    />
  );
}
