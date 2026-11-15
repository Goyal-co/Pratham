import { ImageResponse } from "next/og";

export const runtime = "edge";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ size: string }> }
) {
  const { size: raw } = await ctx.params;
  const n = Number(String(raw).replace(/\D/g, "")) || 192;
  const size = Math.min(512, Math.max(48, n));
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#FC8019",
          color: "white",
          fontSize: Math.round(size * 0.42),
          fontWeight: 800,
          fontFamily: "sans-serif",
        }}
      >
        T
      </div>
    ),
    { width: size, height: size }
  );
}
