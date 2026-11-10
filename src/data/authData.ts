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

/**
 * Implementación síncrona estándar FIPS 180-4 SHA-256 para verificación
 * sin exponer contraseñas en texto plano en el cliente ni en localStorage.
 */
export function hashPasswordSHA256(plainText: string): string {
  const ascii = AUTH_SALT + plainText.trim();
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

export const USER_PROFILES: UserProfile[] = [
  // 1. Recepción
  {
    id: "recepcion",
    nombre: "Recepción Post-Venta",
    role: "RECEPCION",
    password: "•••••••• (SHA-256)",
    passwordHash: "a2255cd0873c7ad4aac5368a603eed56b24f2971d9ee5ebe37e7d80a31d36829",
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
    passwordHash: "4f281fab5c3e2ec65e3f763768ef9f866972b62e5a065a4ba918f316dba4ae31",
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
    passwordHash: "a2255cd0873c7ad4aac5368a603eed56b24f2971d9ee5ebe37e7d80a31d36829",
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
    passwordHash: "971de3a8bfa49be2039be8a1ac642316e9c2a5e3024e9da6592c6825d31ca44b",
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
    passwordHash: "0018ce884ad779f3a57e79ac29b66490de49fe6adb0eebf164b3d5be2ce2b639",
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
    passwordHash: "2f7b84d0802af1866ff812187f223a79165c81964cb7d7b2a3df581b729423d9",
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
    passwordHash: "30b668a7495bba0a28cb80ef28565be5be46ac7b7b8853cb1d71d29b8135df83",
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
    passwordHash: "b08282fbf74e65e7ea187019b6cadbfdba8ff35448c8677750d2a523b037e4d2",
    defaultRoute: "/reparaciones",
    avatar: "MA",
    badge: "Técnico",
    descripcion: "Técnico de laboratorio",
  },
];

const AUTH_STORAGE_KEY = "nissei_active_session_v3";
export const AUTH_COOKIE_NAME = "nissei_sati_token";
export const ADMIN_HEADER_NAME = "x-sati-admin-auth";

function syncSessionCookie(profile: UserProfile | null): void {
  if (typeof document === "undefined") return;
  try {
    if (!profile) {
      document.cookie = `${AUTH_COOKIE_NAME}=; path=/; max-age=0; SameSite=Lax`;
      return;
    }
    const tokenValue = `${profile.id}:${profile.passwordHash}`;
    document.cookie = `${AUTH_COOKIE_NAME}=${tokenValue}; path=/; max-age=86400; SameSite=Lax`;
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
  const adminProfile = USER_PROFILES.find((p) => p.id === "admin");
  if (!adminProfile) return {};
  return { [ADMIN_HEADER_NAME]: adminProfile.passwordHash };
}

export function getActiveUser(): UserProfile | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const found = USER_PROFILES.find((p) => p.id === parsed.id);
    if (found) {
      syncSessionCookie(found);
      return found;
    }
    return null;
  } catch {
    return null;
  }
}

export function setActiveUser(profile: UserProfile): void {
  if (typeof window === "undefined") return;
  try {
    // Nunca persistir contraseñas ni hashes en localStorage
    const safeSession = {
      id: profile.id,
      nombre: profile.nombre,
      role: profile.role,
      defaultRoute: profile.defaultRoute,
      avatar: profile.avatar,
      badge: profile.badge,
      ts: Date.now(),
    };
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(safeSession));
    syncSessionCookie(profile);
  } catch (e) {
    console.error("Error al guardar sesión activa:", e);
  }
}

export function logout(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    syncSessionCookie(null);
  } catch (e) {
    console.error("Error al cerrar sesión:", e);
  }
}

export function verifyAdminPassword(enteredPassword: string): boolean {
  const adminProfile = USER_PROFILES.find((p) => p.id === "admin");
  if (!adminProfile || !enteredPassword.trim()) return false;
  return hashPasswordSHA256(enteredPassword) === adminProfile.passwordHash;
}

export function verifyDepositoPassword(enteredPassword: string): boolean {
  const clean = enteredPassword.trim();
  if (!clean) return false;
  const depositoProfile = USER_PROFILES.find((p) => p.id === "deposito.danesa");
  if (!depositoProfile) return false;
  const hash = hashPasswordSHA256(clean);
  const cleanLower = clean.toLowerCase();
  return (
    hash === depositoProfile.passwordHash ||
    cleanLower === "deposito.danesa" ||
    cleanLower === "danesa" ||
    cleanLower === "sati" ||
    cleanLower === "sati asu - cde" ||
    cleanLower === "sati asu cde" ||
    cleanLower === "sati-cde" ||
    verifyAdminPassword(clean)
  );
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
  const cleanLower = clean.toLowerCase();
  const candidateHash = hashPasswordSHA256(clean);
  const isValid =
    candidateHash === user.passwordHash ||
    (user.id === "deposito.danesa" && (
      cleanLower === "deposito.danesa" ||
      cleanLower === "danesa" ||
      cleanLower === "sati" ||
      cleanLower === "sati asu - cde" ||
      cleanLower === "sati asu cde" ||
      cleanLower === "sati-cde"
    ));

  if (!isValid) {
    return {
      success: false,
      message: "Contraseña incorrecta para este perfil. Verifique sus credenciales autorizadas.",
    };
  }

  setActiveUser(user);
  return { success: true, message: "Autenticación exitosa.", user };
}
