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
  const token = process.env.WHAPI_API_TOKEN || "";
  const baseUrl = process.env.WHAPI_API_URL || "https://gate.whapi.cloud";

  if (!token) {
    console.error("[WHAPI] Error: WHAPI_API_TOKEN no está configurado en las variables de entorno.");
    return {
      sent: false,
      error: "Servicio de mensajería no configurado en el servidor.",
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

    const data = await response.json();

    if (!response.ok) {
      console.error("[WHAPI] Error en respuesta del proveedor:", response.status);
      return {
        sent: false,
        error: `No se pudo entregar el mensaje por WhatsApp (código ${response.status}).`,
      };
    }

    return {
      sent: true,
      message: { id: data?.message?.id || "sent" },
    };
  } catch (err) {
    console.error("[WHAPI] Error de red al enviar mensaje:", err);
    return {
      sent: false,
      error: "Error de conexión con la pasarela de WhatsApp.",
    };
  }
}
