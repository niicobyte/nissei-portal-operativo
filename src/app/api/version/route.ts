import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const SERVER_BOOT_ID = `boot-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
let cachedNextBuildId: string | null = null;

function getNextBuildId(): string {
  if (cachedNextBuildId !== null) return cachedNextBuildId;
  try {
    const buildIdPath = path.join(process.cwd(), ".next", "BUILD_ID");
    if (fs.existsSync(buildIdPath)) {
      cachedNextBuildId = fs.readFileSync(buildIdPath, "utf8").trim();
      return cachedNextBuildId;
    }
  } catch {
    // Entorno sin archivo .next/BUILD_ID (ej. desarrollo)
  }
  cachedNextBuildId = "";
  return "";
}

/**
 * Expone un identificador único del deploy/build activo en el servidor.
 * Permite detectar automáticamente nuevos deploys en Railway y renovar sesiones.
 */
export async function GET() {
  try {
    const railwayDepId = (process.env.RAILWAY_DEPLOYMENT_ID || "").trim();
    const commitSha = (process.env.RAILWAY_GIT_COMMIT_SHA || "").trim();
    const nextBuildId = getNextBuildId();
    const rawId =
      railwayDepId ||
      [nextBuildId, commitSha].filter(Boolean).join("-") ||
      SERVER_BOOT_ID;
    const deployId = rawId.replace(/[:\s]/g, "_");

    return NextResponse.json(
      { ok: true, deployId },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
        },
      }
    );
  } catch {
    return NextResponse.json(
      { ok: true, deployId: SERVER_BOOT_ID },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
        },
      }
    );
  }
}
