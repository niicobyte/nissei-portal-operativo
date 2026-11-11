import { NextRequest, NextResponse } from "next/server";
import {
  USER_PROFILES,
  AUTH_COOKIE_NAME,
  ADMIN_HEADER_NAME,
  UserProfile,
} from "@/data/authData";

function resolveAuthenticatedUser(req: NextRequest): UserProfile | null {
  const rawCookie = req.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (!rawCookie) return null;

  try {
    const cookieVal = decodeURIComponent(rawCookie);
    if (!cookieVal.includes(":")) return null;

    const parts = cookieVal.split(":");
    const id = parts[0];
    const hash = parts[1];
    const expiresAt = parts[2] ? Number(parts[2]) : null;

    if (!id || !hash) return null;

    // Si tiene expiración y el tiempo actual superó el límite de inactividad: EXPIRADO
    if (expiresAt && Date.now() > expiresAt) {
      return null;
    }

    const found = USER_PROFILES.find(
      (p) => p.id === id && p.passwordHash === hash
    );
    return found || null;
  } catch {
    return null;
  }
}

function hasValidAdminHeader(req: NextRequest): boolean {
  const headerHash = req.headers.get(ADMIN_HEADER_NAME);
  if (!headerHash) return false;
  const adminProfile = USER_PROFILES.find((p) => p.id === "admin");
  return Boolean(adminProfile && adminProfile.passwordHash === headerHash);
}

function isAuthorizedForPath(user: UserProfile, pathname: string): boolean {
  if (user.role === "ADMIN") return true;
  if (pathname.startsWith("/recepcion")) return user.role === "RECEPCION" || user.role === "DEPOSITO";
  if (pathname.startsWith("/reparaciones")) return user.role === "TECNICO";
  if (pathname.startsWith("/tecnicos")) return user.role === "MONTAJES";
  return false;
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const user = resolveAuthenticatedUser(req);

  // 1. Protección de Endpoints de API (/api/db y /api/whatsapp)
  if (pathname.startsWith("/api/db") || pathname.startsWith("/api/whatsapp")) {
    const isAdminHeaderAllowed = hasValidAdminHeader(req);

    if (!user && !isAdminHeaderAllowed) {
      return NextResponse.json(
        {
          ok: false,
          error: "Acceso denegado. Debe autenticarse en el portal operativo.",
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
      loginUrl.searchParams.set("reason", "expired");
      const response = NextResponse.redirect(loginUrl, 307);
      // Limpiar cookie vencida o ausente de inmediato
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
