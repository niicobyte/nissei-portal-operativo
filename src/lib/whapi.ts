/**
 * Servicio de integración con Whapi.cloud (WhaApi)
 * Permite enviar mensajes de texto automáticos a números directos o grupos de WhatsApp.
 * Todas las credenciales e IDs de grupos se leen exclusivamente de variables de entorno del servidor (.env.local).
 */

export type WhapiChannel = "MONTAJES" | "RECEPCION" | "TALLER";

export interface WhapiSendOptions {
  to?: string; // Número de teléfono (ej. 595973123456) o ID de grupo (@g.us)
  channel?: WhapiChannel; // Canal específico preconfigurado
  body: string; // Contenido del mensaje de texto
}

export interface WhapiResponse {
  sent: boolean;
  message?: unknown;
  error?: string;
}

export const WHAPI_GROUPS: Record<WhapiChannel, string> = {
  MONTAJES: process.env.WHAPI_GROUP_MONTAJES || "120363428540171277@g.us",
  RECEPCION: process.env.WHAPI_GROUP_RECEPCION || "120363426626761732@g.us",
  TALLER: process.env.WHAPI_GROUP_TALLER || "120363288459442182@g.us",
};

export async function sendWhapiMessage({
  to,
  channel,
  body,
}: WhapiSendOptions): Promise<WhapiResponse> {
  const token = (process.env.WHAPI_API_TOKEN || process.env.WHAPI_TOKEN || "").trim();
  const baseUrl = (process.env.WHAPI_API_URL || "https://gate.whapi.cloud")
    .trim()
    .replace(/\/+$/, "");

  if (!token || token === "tu_token_whapi_aqui") {
    console.error("[WHAPI] Error: WHAPI_API_TOKEN no está configurado en las variables de entorno.");
    return {
      sent: false,
      error:
        "WHAPI_API_TOKEN no está configurado en el servidor (verificá las Variables de entorno en Railway).",
    };
  }

  // Determinar destino desde canal seguro o número explícito validado
  let destination = to;
  if (!destination || destination.trim() === "") {
    if (channel && WHAPI_GROUPS[channel]) {
      destination = WHAPI_GROUPS[channel];
    } else {
      destination = WHAPI_GROUPS.TALLER;
    }
  }

  if (!destination || destination.trim() === "") {
    return {
      sent: false,
      error: "No se especificó destinatario o el grupo del canal no está configurado en las variables de entorno.",
    };
  }

  // Normalizar destinatario: si es número de teléfono, quitar símbolos como +, espacios o guiones
  let cleanDestination = destination.trim();
  if (!cleanDestination.includes("@")) {
    cleanDestination = cleanDestination.replace(/[^0-9]/g, "");
    if (cleanDestination.length < 8 || cleanDestination.length > 16) {
      return {
        sent: false,
        error: "Formato de número telefónico inválido.",
      };
    }
  }

  try {
    const response = await fetch(`${baseUrl}/messages/text`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        to: cleanDestination,
        body: body.slice(0, 4000),
      }),
    });

    const rawText = await response.text();
    let data: Record<string, unknown> = {};
    try {
      data = rawText ? (JSON.parse(rawText) as Record<string, unknown>) : {};
    } catch {
      data = {};
    }

    if (!response.ok) {
      const nestedError =
        typeof data.error === "object" && data.error !== null
          ? (data.error as { message?: string }).message
          : typeof data.error === "string"
            ? data.error
            : undefined;
      const detail =
        nestedError ||
        (typeof data.message === "string" ? data.message : undefined) ||
        "";
      console.error("[WHAPI] Error en respuesta del proveedor:", response.status, detail);
      return {
        sent: false,
        error: detail
          ? `WhaApi rechazó el envío (HTTP ${response.status}): ${detail}`
          : `No se pudo entregar el mensaje por WhatsApp (código ${response.status}).`,
      };
    }

    const msgObj =
      typeof data.message === "object" && data.message !== null
        ? (data.message as { id?: string })
        : undefined;

    return {
      sent: true,
      message: { id: msgObj?.id || "sent" },
    };
  } catch (err) {
    console.error("[WHAPI] Error de red al enviar mensaje:", err);
    return {
      sent: false,
      error: "Error de conexión con la pasarela de WhatsApp (WhaApi).",
    };
  }
}
