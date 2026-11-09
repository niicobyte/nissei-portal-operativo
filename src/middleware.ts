import { NextRequest, NextResponse } from "next/server";
import {
  USER_PROFILES,
  AUTH_COOKIE_NAME,
  ADMIN_HEADER_NAME,
  UserProfile,
} from "@/data/authData";

function resolveAuthenticatedUser(req: NextRequest): UserProfile | null {
  const cookieVal = req.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (!cookieVal || !cookieVal.includes(":")) return null;

  const [id, hash] = cookieVal.split(":");
  if (!id || !hash) return null;

  const found = USER_PROFILES.find(
    (p) => p.id === id && p.passwordHash === hash
  );
  return found || null;
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
      return NextResponse.redirect(loginUrl);
    }

    if (!isAuthorizedForPath(user, pathname)) {
      const allowedUrl = new URL(user.defaultRoute, req.url);
      return NextResponse.redirect(allowedUrl);
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
