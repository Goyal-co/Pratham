import { json } from "@/lib/api";

/** Liveness for Docker / ALB / ECS health checks. */
export async function GET() {
  return json({ ok: true, service: "ahariva" });
}
