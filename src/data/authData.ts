// Sistema de Autenticación y Perfiles con Cifrado SHA-256 - NISSEI S.A.
// Perfiles operativos protegidos sin contraseñas en texto plano en el bundle del navegador.

export type UserRole = "ADMIN" | "TECNICO" | "RECEPCION" | "MONTAJES" | "DEPOSITO";

export interface UserProfile {
  id: string;
  nombre: string;
  role: UserRole;
  password: string; // Representación enmascarada para visualización segura
  passwordHash: string; // Hash criptográfico SHA-256 con salt
  defaultRoute: string;
  avatar: string;
  badge: string;
  descripcion: string;
}

const AUTH_SALT = "NISSEI_SATI_SALT_2026::";
const STORED_KEY_SALT = "NISSEI_STORED_KEY_2026::";
const ADMIN_SESSION_KEY_STORAGE = "nissei_admin_key_v1";

/**
 * Implementación síncrona estándar FIPS 180-4 SHA-256.
 */
function computeRawSHA256(ascii: string): string {
  function rightRotate(value: number, amount: number): number {
    return (value >>> amount) | (value << (32 - amount));
  }
  const maxWord = Math.pow(2, 32);
  let result = "";
  const words: number[] = [];
  const utf8 = unescape(encodeURIComponent(ascii));
  const asciiBitLength = utf8.length * 8;
  let hash = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ];
  const k = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];
  let str = utf8 + "\x80";
  while ((str.length % 64) - 56) str += "\x00";
  for (let i = 0; i < str.length; i++) {
    const j = str.charCodeAt(i);
    words[i >> 2] |= j << ((3 - (i % 4)) * 8);
  }
  words[words.length] = (asciiBitLength / maxWord) | 0;
  words[words.length] = asciiBitLength;
  for (let j = 0; j < words.length; ) {
    const w = words.slice(j, (j += 16));
    const oldHash = hash.slice(0);
    for (let i = 0; i < 64; i++) {
      const w15 = w[i - 15],
        w2 = w[i - 2];
      const a = hash[0],
        e = hash[4];
      const temp1 =
        hash[7] +
        (rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25)) +
        ((e & hash[5]) ^ (~e & hash[6])) +
        k[i] +
        (w[i] =
          i < 16
            ? w[i]
            : (w[i - 16] +
                (rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3)) +
                w[i - 7] +
                (rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10))) |
              0);
      const temp2 =
        (rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22)) +
        ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]));
      hash = [(temp1 + temp2) | 0].concat(hash);
      hash[4] = (hash[4] + temp1) | 0;
      hash.pop();
    }
    for (let i = 0; i < 8; i++) hash[i] = (hash[i] + oldHash[i]) | 0;
  }
  for (let i = 0; i < 8; i++) {
    for (let j = 3; j + 1; j--) {
      const b = (hash[i] >> (j * 8)) & 255;
      result += (b < 16 ? 0 : "") + b.toString(16);
    }
  }
  return result;
}

/**
 * Deriva la clave de sesión (ClientKey) a partir de la contraseña ingresada.
 * Esta clave nunca se almacena en el código fuente.
 */
export function hashPasswordSHA256(plainText: string): string {
  return computeRawSHA256(AUTH_SALT + plainText.trim());
}

/**
 * Deriva el verificador público (StoredKey = SHA256(STORED_KEY_SALT + ClientKey))
 * estilo SCRAM (RFC 5802) para impedir ataques Pass-the-Hash.
 */
export function deriveStoredKey(clientKey: string): string {
  if (!clientKey || !/^[a-f0-9]{64}$/i.test(clientKey.trim())) return "";
  return computeRawSHA256(STORED_KEY_SALT + clientKey.trim().toLowerCase());
}

export function verifyClientKeyAgainstProfile(
  clientKey: string | null | undefined,
  profile: UserProfile | undefined
): boolean {
  if (!clientKey || !profile) return false;
  const storedKey = deriveStoredKey(clientKey);
  return Boolean(storedKey && storedKey === profile.passwordHash);
}

export const USER_PROFILES: UserProfile[] = [
  // 1. Recepción
  {
    id: "recepcion",
    nombre: "Recepción Post-Venta",
    role: "RECEPCION",
    password: "•••••••• (SHA-256)",
    passwordHash: "abd0efa2316e74673f6fb12bacc5afc9b362ac4f9408810c9e9f08b82d51c246",
    defaultRoute: "/recepcion",
    avatar: "RP",
    badge: "Módulo Post-Venta",
    descripcion: "Recepción de retornos de taller, control de accesorios y entregas con WhatsApp.",
  },

  // 1.1 SATI ASU - CDE (Rendimiento Casa Matriz CDE y Transporte)
  {
    id: "deposito.danesa",
    nombre: "SATI ASU - CDE",
    role: "DEPOSITO",
    password: "•••••••• (SHA-256)",
    passwordHash: "452c82e71e23b5aa61a43503de128fe4b8094ebe22cc1b54559e4aba9ffff6f7",
    defaultRoute: "/recepcion/cde",
    avatar: "SC",
    badge: "SATI ASU - CDE",
    descripcion: "Monitoreo SATI Casa Matriz CDE, retornos por transportadora y Asunción.",
  },

  // 2. Montajes (Taller de Armado)
  {
    id: "montajes",
    nombre: "Taller de Montajes",
    role: "MONTAJES",
    password: "•••••••• (SHA-256)",
    passwordHash: "abd0efa2316e74673f6fb12bacc5afc9b362ac4f9408810c9e9f08b82d51c246",
    defaultRoute: "/tecnicos",
    avatar: "TM",
    badge: "Ensamble PC & Telemetría",
    descripcion: "Carga de pedidos de armado de computadoras, cable management y QA térmico.",
  },

  // 3. Administrador (Supervisor)
  {
    id: "admin",
    nombre: "Admin",
    role: "ADMIN",
    password: "•••••••• (SHA-256)",
    passwordHash: "8daabf75a53a18f5d726d41f2b9d434ec50528df5ebf58cb192757dbaef8aa24",
    defaultRoute: "/reparaciones",
    avatar: "AD",
    badge: "Supervisor General SATI",
    descripcion: "Asignación de equipos en cola, supervisión de técnicos y reportes gerenciales.",
  },

  // 4. Técnicos de Taller
  {
    id: "carlos",
    nombre: "Carlos",
    role: "TECNICO",
    password: "•••••••• (SHA-256)",
    passwordHash: "483b73216112b2e0ddfe2a8147ebb6dec59e27bb3c3b49e829a3772a7d2c540a",
    defaultRoute: "/reparaciones",
    avatar: "CA",
    badge: "Técnico",
    descripcion: "Técnico de laboratorio",
  },
  {
    id: "enrique",
    nombre: "Enrique",
    role: "TECNICO",
    password: "•••••••• (SHA-256)",
    passwordHash: "8602ff483c90ad8f5c263943fac3ff9201f030a7f79bd54d4a2423357f05a9a3",
    defaultRoute: "/reparaciones",
    avatar: "EN",
    badge: "Técnico",
    descripcion: "Técnico de laboratorio",
  },
  {
    id: "michael",
    nombre: "Michael",
    role: "TECNICO",
    password: "•••••••• (SHA-256)",
    passwordHash: "0971bddfa020e938c267c68e7332f241937ed3736969d5511af9f530662d1cc2",
    defaultRoute: "/reparaciones",
    avatar: "MI",
    badge: "Técnico",
    descripcion: "Técnico de laboratorio",
  },
  {
    id: "marcelo",
    nombre: "Marcelo",
    role: "TECNICO",
    password: "•••••••• (SHA-256)",
    passwordHash: "3fee89355384ab414596875cf3e18171b8d379097f400719b8f917a541b7b889",
    defaultRoute: "/reparaciones",
    avatar: "MA",
    badge: "Técnico",
    descripcion: "Técnico de laboratorio",
  },
];

export const AUTH_STORAGE_KEY = "nissei_active_session_v4";
export const AUTH_COOKIE_NAME = "nissei_sati_token";
export const ADMIN_HEADER_NAME = "x-sati-admin-auth";
export const RETURN_TO_STORAGE_KEY = "nissei_pending_return_to_v1";
export const SESSION_TIMEOUT_MS = 60 * 60 * 1000; // 1 hora de inactividad

function sanitizeDeployVersion(deployVersion?: string | null): string {
  return String(deployVersion || "").trim().replace(/[:;\s]/g, "_");
}

export function isValidReturnToPath(path: string | null | undefined): path is string {
  if (!path || typeof path !== "string") return false;
  const trimmed = path.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) return false;
  if (trimmed === "/" || trimmed.startsWith("/login") || trimmed.startsWith("/api")) return false;
  return true;
}

export function isAuthorizedForPath(user: UserProfile, pathname: string): boolean {
  const cleanPath = pathname.split("?")[0] || "/";
  if (user.role === "ADMIN") return true;
  if (cleanPath.startsWith("/recepcion")) return user.role === "RECEPCION" || user.role === "DEPOSITO";
  if (cleanPath.startsWith("/reparaciones")) return user.role === "TECNICO";
  if (cleanPath.startsWith("/tecnicos")) return user.role === "MONTAJES";
  return false;
}

export function savePendingReturnTo(path: string): void {
  if (typeof window === "undefined" || !isValidReturnToPath(path)) return;
  try {
    sessionStorage.setItem(RETURN_TO_STORAGE_KEY, path);
    localStorage.setItem(RETURN_TO_STORAGE_KEY, path);
  } catch {
    // Ignorar error de almacenamiento
  }
}

export function getPendingReturnTo(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const val =
      sessionStorage.getItem(RETURN_TO_STORAGE_KEY) ||
      localStorage.getItem(RETURN_TO_STORAGE_KEY);
    return isValidReturnToPath(val) ? val : null;
  } catch {
    return null;
  }
}

export function consumePendingReturnTo(): string | null {
  const val = getPendingReturnTo();
  if (typeof window !== "undefined") {
    try {
      sessionStorage.removeItem(RETURN_TO_STORAGE_KEY);
      localStorage.removeItem(RETURN_TO_STORAGE_KEY);
    } catch {
      // Ignorar
    }
  }
  return val;
}

function getStoredClientKey(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(AUTH_STORAGE_KEY) || localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return typeof parsed?.clientKey === "string" && parsed.clientKey ? parsed.clientKey : null;
  } catch {
    return null;
  }
}

export function syncSessionCookie(
  profile: UserProfile | null,
  deployVersion?: string | null,
  clientKey?: string | null
): void {
  if (typeof document === "undefined") return;
  try {
    const effectiveKey = clientKey || getStoredClientKey();
    if (!profile || !effectiveKey || !verifyClientKeyAgainstProfile(effectiveKey, profile)) {
      document.cookie = `${AUTH_COOKIE_NAME}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Strict`;
      return;
    }
    const expiresAt = Date.now() + SESSION_TIMEOUT_MS;
    const safeDeploy = sanitizeDeployVersion(deployVersion ?? getSessionDeployVersion());
    const tokenValue = safeDeploy
      ? `${profile.id}:${effectiveKey}:${expiresAt}:${safeDeploy}`
      : `${profile.id}:${effectiveKey}:${expiresAt}`;
    // Cookie de sesión con ClientKey verificable por StoredKey (SCRAM)
    document.cookie = `${AUTH_COOKIE_NAME}=${encodeURIComponent(tokenValue)}; path=/; SameSite=Strict`;
  } catch {
    // Ignore cookie errors in restricted contexts
  }
}

export function getSafeUserProfiles(): UserProfile[] {
  return USER_PROFILES.map((u) => ({
    ...u,
    password: "•••••••• (SHA-256)",
    passwordHash: "PROTECTED",
  }));
}

export function getAdminAuthHeaders(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const adminProfile = USER_PROFILES.find((p) => p.id === "admin");
  if (!adminProfile) return {};
  try {
    const cachedAdminKey =
      sessionStorage.getItem(ADMIN_SESSION_KEY_STORAGE) || getStoredClientKey();
    if (cachedAdminKey && verifyClientKeyAgainstProfile(cachedAdminKey, adminProfile)) {
      return { [ADMIN_HEADER_NAME]: cachedAdminKey };
    }
  } catch {
    // Ignore storage error
  }
  return {};
}

/**
 * Renueva el timestamp de actividad de la sesión activa
 */
export function touchSession(): void {
  if (typeof window === "undefined") return;
  try {
    const raw = sessionStorage.getItem(AUTH_STORAGE_KEY) || localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.id || !parsed.clientKey) return;
    const found = USER_PROFILES.find((p) => p.id === parsed.id);
    if (!found || !verifyClientKeyAgainstProfile(parsed.clientKey, found)) return;

    const now = Date.now();
    parsed.lastActive = now;
    sessionStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(parsed));
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(parsed));
    syncSessionCookie(found, parsed.deployVersion, parsed.clientKey);
  } catch {
    // Ignore error
  }
}

export function getActiveUser(): UserProfile | null {
  if (typeof window === "undefined") return null;
  try {
    // Limpieza preventiva de versiones antiguas inseguras
    localStorage.removeItem("nissei_active_session_v1");
    localStorage.removeItem("nissei_active_session_v2");
    localStorage.removeItem("nissei_active_session_v3");

    const raw = sessionStorage.getItem(AUTH_STORAGE_KEY) || localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) {
      syncSessionCookie(null);
      return null;
    }
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.id || !parsed.ts || !parsed.clientKey) {
      logout();
      return null;
    }

    const now = Date.now();
    const lastActive = Number(parsed.lastActive || parsed.ts);
    // Verificación estricta: Si pasó más del tiempo de inactividad permitido (1 hora): EXPIRADA
    if (now - lastActive > SESSION_TIMEOUT_MS) {
      console.warn("[AUTH GUARD] Sesión cerrada automáticamente tras 1 hora de inactividad.");
      logout();
      return null;
    }

    const found = USER_PROFILES.find((p) => p.id === parsed.id);
    if (found && verifyClientKeyAgainstProfile(parsed.clientKey, found)) {
      // Renovar actividad en memoria
      parsed.lastActive = now;
      sessionStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(parsed));
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(parsed));
      syncSessionCookie(found, parsed.deployVersion, parsed.clientKey);
      return found;
    }

    logout();
    return null;
  } catch {
    logout();
    return null;
  }
}

export function getSessionDeployVersion(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(AUTH_STORAGE_KEY) || localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const ver = sanitizeDeployVersion(parsed?.deployVersion);
    return ver || null;
  } catch {
    return null;
  }
}

export function updateSessionDeployVersion(deployVersion: string | null | undefined): void {
  const safeDeploy = sanitizeDeployVersion(deployVersion);
  if (typeof window === "undefined" || !safeDeploy) return;
  try {
    const raw = sessionStorage.getItem(AUTH_STORAGE_KEY) || localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.id || !parsed.clientKey) return;
    parsed.deployVersion = safeDeploy;
    sessionStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(parsed));
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(parsed));

    const found = USER_PROFILES.find((p) => p.id === parsed.id);
    if (found && verifyClientKeyAgainstProfile(parsed.clientKey, found)) {
      syncSessionCookie(found, safeDeploy, parsed.clientKey);
    }
  } catch {
    // Ignore
  }
}

export async function fetchServerDeployId(timeoutMs = 3000): Promise<string | null> {
  if (typeof window === "undefined") return null;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch("/api/version", {
      cache: "no-store",
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const json = await res.json().catch(() => null);
    const clean = sanitizeDeployVersion(json?.deployId);
    return clean || null;
  } catch {
    return null;
  }
}

export function setActiveUser(
  profile: UserProfile,
  deployVersion?: string | null,
  clientKey?: string | null
): void {
  if (typeof window === "undefined") return;
  try {
    const effectiveKey = clientKey || getStoredClientKey();
    if (!effectiveKey || !verifyClientKeyAgainstProfile(effectiveKey, profile)) return;

    const now = Date.now();
    // Limpieza estricta de residuos antiguos
    localStorage.removeItem("nissei_active_session_v1");
    localStorage.removeItem("nissei_active_session_v2");
    localStorage.removeItem("nissei_active_session_v3");

    const safeDeploy = sanitizeDeployVersion(deployVersion);
    const safeSession = {
      id: profile.id,
      nombre: profile.nombre,
      role: profile.role,
      defaultRoute: profile.defaultRoute,
      avatar: profile.avatar,
      badge: profile.badge,
      clientKey: effectiveKey,
      ts: now,
      lastActive: now,
      ...(safeDeploy ? { deployVersion: safeDeploy } : {}),
    };
    sessionStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(safeSession));
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(safeSession));
    if (profile.role === "ADMIN") {
      sessionStorage.setItem(ADMIN_SESSION_KEY_STORAGE, effectiveKey);
    }
    syncSessionCookie(profile, safeDeploy, effectiveKey);
  } catch (e) {
    console.error("Error al guardar sesión activa:", e);
  }
}

export function logout(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(AUTH_STORAGE_KEY);
    sessionStorage.removeItem(ADMIN_SESSION_KEY_STORAGE);
    localStorage.removeItem(AUTH_STORAGE_KEY);
    localStorage.removeItem("nissei_active_session_v1");
    localStorage.removeItem("nissei_active_session_v2");
    localStorage.removeItem("nissei_active_session_v3");
    syncSessionCookie(null);
  } catch (e) {
    console.error("Error al cerrar sesión:", e);
  }
}

export function verifyAdminPassword(enteredPassword: string): boolean {
  const adminProfile = USER_PROFILES.find((p) => p.id === "admin");
  if (!adminProfile || !enteredPassword.trim()) return false;
  const clientKey = hashPasswordSHA256(enteredPassword);
  const isValid = verifyClientKeyAgainstProfile(clientKey, adminProfile);
  if (isValid && typeof window !== "undefined") {
    try {
      sessionStorage.setItem(ADMIN_SESSION_KEY_STORAGE, clientKey);
    } catch {
      // Ignore storage error
    }
  }
  return isValid;
}

export function verifyDepositoPassword(enteredPassword: string): boolean {
  const clean = enteredPassword.trim();
  if (!clean) return false;
  const depositoProfile = USER_PROFILES.find((p) => p.id === "deposito.danesa");
  if (!depositoProfile) return false;
  const clientKey = hashPasswordSHA256(clean);
  return verifyClientKeyAgainstProfile(clientKey, depositoProfile) || verifyAdminPassword(clean);
}

export function authenticate(
  profileId: string,
  enteredPassword: string
): { success: boolean; message: string; user?: UserProfile } {
  const user = USER_PROFILES.find((p) => p.id === profileId);
  if (!user) {
    return { success: false, message: "Perfil no encontrado en el sistema SATI." };
  }

  const clean = enteredPassword.trim();
  if (!clean) {
    return {
      success: false,
      message: "Debe ingresar una contraseña válida.",
    };
  }

  const clientKey = hashPasswordSHA256(clean);
  const isValid = verifyClientKeyAgainstProfile(clientKey, user);

  if (!isValid) {
    return {
      success: false,
      message: "Contraseña incorrecta para este perfil. Verifique sus credenciales autorizadas.",
    };
  }

  setActiveUser(user, undefined, clientKey);
  return { success: true, message: "Autenticación exitosa.", user };
}
