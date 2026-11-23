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

const KIOSK_SELLER_COOKIE = "nissei_kiosk_vendedor";
const DEFAULT_OPERATOR_HOST = "system-integrated.up.railway.app";

/**
 * Determina si la petición proviene del segundo dominio exclusivo de vendedores en Railway.
 * Cualquier dominio adicional en Railway distinto al dominio operativo principal (system-integrated.up.railway.app)
 * queda bloqueado al 100% para mostrar únicamente /armar-pc.
 */
export function isSellerOnlyDomain(req: NextRequest): boolean {
  const rawHost = (
    req.headers.get("x-forwarded-host") ||
    req.headers.get("host") ||
    req.nextUrl.hostname ||
    ""
  )
    .split(",")[0]
    .trim()
    .toLowerCase()
    .replace(/:\d+$/, "");

  if (!rawHost || rawHost === "localhost" || rawHost === "127.0.0.1") {
    return false;
  }

  const explicitSellerHosts = (process.env.SELLER_ONLY_HOSTS || "tienda-ventas.up.railway.app")
    .split(",")
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);

  if (explicitSellerHosts.includes(rawHost)) {
    return true;
  }

  const primaryOperatorHost = (
    process.env.PRIMARY_OPERATOR_HOST || DEFAULT_OPERATOR_HOST
  )
    .trim()
    .toLowerCase();

  // Si es un dominio desplegado que NO es el dominio principal de operadores, es el dominio exclusivo de vendedores
  return rawHost !== primaryOperatorHost;
}

export function hasValidAdminHeader(req: NextRequest): boolean {
  const headerClientKey = req.headers.get(ADMIN_HEADER_NAME);
  if (!headerClientKey) return false;
  const adminProfile = USER_PROFILES.find((p) => p.id === "admin");
  return verifyClientKeyAgainstProfile(headerClientKey, adminProfile);
}

export function middleware(req: NextRequest) {
  const { pathname, search, searchParams } = req.nextUrl;
  const { user, outdatedDeploy } = resolveAuthenticatedUser(req);
  const sellerDomain = isSellerOnlyDomain(req);

  // 0. MODO DOMINIO EXCLUSIVO DE VENDEDORES (Segundo dominio en Railway):
  // En el dominio de vendedores jamás se puede ver /login, / ni ningún módulo interno.
  if (sellerDomain) {
    if (
      pathname.startsWith("/api/db") ||
      pathname.startsWith("/api/whatsapp") ||
      pathname.startsWith("/api/telemetry")
    ) {
      return NextResponse.json(
        { ok: false, error: "No disponible en el dominio de cotizaciones." },
        { status: 403 }
      );
    }

    if (
      pathname !== "/armar-pc" &&
      !pathname.startsWith("/api/nissei-live") &&
      !pathname.startsWith("/api/version") &&
      !pathname.startsWith("/api/feedback")
    ) {
      const armarUrl = new URL("/armar-pc", req.url);
      return NextResponse.redirect(armarUrl, 307);
    }

    return NextResponse.next();
  }

  // 0.1. EXCLUSIVIDAD DE /armar-pc EN EL DOMINIO DE TIENDA:
  // /armar-pc SOLO debe existir y ser visible en https://tienda-ventas.up.railway.app/armar-pc.
  // Si alguien ingresa a /armar-pc desde el dominio de operadores (system-integrated.up.railway.app),
  // se le redirige inmediatamente al dominio exclusivo de ventas de PC.
  if (pathname === "/armar-pc" && !sellerDomain) {
    const rawHost = (
      req.headers.get("x-forwarded-host") ||
      req.headers.get("host") ||
      req.nextUrl.hostname ||
      ""
    )
      .split(",")[0]
      .trim()
      .toLowerCase()
      .replace(/:\d+$/, "");

    const isLocal = !rawHost || rawHost === "localhost" || rawHost === "127.0.0.1";
    if (!isLocal) {
      const sellerTarget = new URL(
        "/armar-pc",
        process.env.TIENDA_VENTAS_URL || "https://tienda-ventas.up.railway.app"
      );
      searchParams.forEach((val, key) => sellerTarget.searchParams.set(key, val));
      return NextResponse.redirect(sellerTarget, 307);
    }

    return NextResponse.next();
  }

  if (pathname === "/" || pathname === "/login") {
    const unlockOperator =
      searchParams.get("operador") === "1" ||
      searchParams.get("sati") === "1" ||
      Boolean(searchParams.get("reason"));

    if (unlockOperator) {
      const res = NextResponse.next();
      res.cookies.delete(KIOSK_SELLER_COOKIE);
      return res;
    }

    const isKioskSeller = req.cookies.get(KIOSK_SELLER_COOKIE)?.value === "1";
    if (isKioskSeller && !user) {
      const armarUrl = new URL("/armar-pc", req.url);
      return NextResponse.redirect(armarUrl, 307);
    }
  }

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
      const isKioskSeller = req.cookies.get(KIOSK_SELLER_COOKIE)?.value === "1";
      if (isKioskSeller) {
        const armarUrl = new URL("/armar-pc", req.url);
        return NextResponse.redirect(armarUrl, 307);
      }

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
    "/",
    "/login",
    "/armar-pc",
    "/recepcion/:path*",
    "/reparaciones/:path*",
    "/tecnicos/:path*",
    "/api/db/:path*",
    "/api/whatsapp/:path*",
    "/api/telemetry/:path*",
  ],
};
