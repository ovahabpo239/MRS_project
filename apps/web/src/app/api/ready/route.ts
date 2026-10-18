import { checkDatabase } from "@/server/db/client";

// Readiness probe: only report ready when the database answers.
export const dynamic = "force-dynamic";

export async function GET() {
  const ready = await checkDatabase();
  return Response.json({ status: ready ? "ready" : "unavailable" }, { status: ready ? 200 : 503 });
}
