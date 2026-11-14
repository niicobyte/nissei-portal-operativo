import { NextRequest, NextResponse } from "next/server";
import {
  USER_PROFILES,
  AUTH_COOKIE_NAME,
  ADMIN_HEADER_NAME,
  UserProfile,
  isAuthorizedForPath,
  verifyClientKeyAgainstProfile,
} from "@/data/authData";

interface ResolvedSession {
  user: UserProfile | null;
  outdatedDeploy: boolean;
}

export function resolveAuthenticatedUser(req: NextRequest): ResolvedSession {
  const rawCookie = req.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (!rawCookie) return { user: null, outdatedDeploy: false };

  try {
    const cookieVal = decodeURIComponent(rawCookie);
    if (!cookieVal.includes(":")) return { user: null, outdatedDeploy: false };

    const parts = cookieVal.split(":");
    const id = parts[0];
    const clientKey = parts[1];
    const expiresAt = parts[2] ? Number(parts[2]) : null;
    const cookieDeployId = (parts[3] || "").trim();

    if (!id || !clientKey) return { user: null, outdatedDeploy: false };

    // Si tiene expiración y el tiempo actual superó el límite de inactividad: EXPIRADO
    if (expiresAt && Date.now() > expiresAt) {
      return { user: null, outdatedDeploy: false };
    }

    const found = USER_PROFILES.find(
      (p) => p.id === id && verifyClientKeyAgainstProfile(clientKey, p)
    );
    if (!found) return { user: null, outdatedDeploy: false };

    const envDeployId = (process.env.RAILWAY_DEPLOYMENT_ID || "")
      .trim()
      .replace(/[:;\s]/g, "_");
    if (envDeployId && cookieDeployId !== envDeployId) {
      return { user: null, outdatedDeploy: true };
    }

    return { user: found, outdatedDeploy: false };
  } catch {
    return { user: null, outdatedDeploy: false };
  }
}

export function hasValidAdminHeader(req: NextRequest): boolean {
  const headerClientKey = req.headers.get(ADMIN_HEADER_NAME);
  if (!headerClientKey) return false;
  const adminProfile = USER_PROFILES.find((p) => p.id === "admin");
  return verifyClientKeyAgainstProfile(headerClientKey, adminProfile);
}

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const { user, outdatedDeploy } = resolveAuthenticatedUser(req);

  // 1. Protección de Endpoints de API (/api/db y /api/whatsapp)
  if (pathname.startsWith("/api/db") || pathname.startsWith("/api/whatsapp")) {
    const isAdminHeaderAllowed = hasValidAdminHeader(req);

    if (!user && !isAdminHeaderAllowed) {
      return NextResponse.json(
        {
          ok: false,
          error: outdatedDeploy
            ? "Portal actualizado. Inicie sesión nuevamente para continuar."
            : "Acceso denegado. Debe autenticarse en el portal operativo.",
          outdatedDeploy,
        },
        { status: 401 }
      );
    }
    return NextResponse.next();
  }

  // 2. Protección de Rutas de Módulos Operativos en el Servidor
  if (
    pathname.startsWith("/recepcion") ||
    pathname.startsWith("/reparaciones") ||
    pathname.startsWith("/tecnicos")
  ) {
    if (!user) {
      const loginUrl = new URL("/login", req.url);
      loginUrl.searchParams.set("reason", outdatedDeploy ? "updated" : "expired");
      loginUrl.searchParams.set("returnTo", `${pathname}${search}`);
      const response = NextResponse.redirect(loginUrl, 307);
      // Limpiar cookie vencida, ausente o de un deploy anterior
      response.cookies.delete(AUTH_COOKIE_NAME);
      return response;
    }

    if (!isAuthorizedForPath(user, pathname)) {
      const allowedUrl = new URL(user.defaultRoute, req.url);
      return NextResponse.redirect(allowedUrl, 307);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/recepcion/:path*",
    "/reparaciones/:path*",
    "/tecnicos/:path*",
    "/api/db/:path*",
    "/api/whatsapp/:path*",
  ],
};
