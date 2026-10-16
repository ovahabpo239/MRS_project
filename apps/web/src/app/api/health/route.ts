// Liveness probe: answers as long as the process can serve requests. No dependencies checked.
export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({ status: "ok" });
}
