import { NextRequest, NextResponse } from "next/server";
import { sendWhapiFeedbackMessage } from "@/lib/whapi";

const recentSubmissionsByIp = new Map<string, number>();

export async function POST(req: NextRequest) {
  try {
    const clientIp =
      (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() ||
      "anonymous";
    const lastSentAt = recentSubmissionsByIp.get(clientIp) || 0;
    if (Date.now() - lastSentAt < 4000) {
      return NextResponse.json(
        {
          ok: false,
          error: "Aguarde unos segundos antes de enviar otro reporte.",
        },
        { status: 429 }
      );
    }

    const payload = await req.json().catch(() => null);
    if (!payload || typeof payload !== "object") {
      return NextResponse.json(
        { ok: false, error: "Datos del formulario inválidos." },
        { status: 400 }
      );
    }

    const nombre = String(payload.nombre || "")
      .trim()
      .slice(0, 100);
    const tipoRaw = String(payload.tipo || "SUGERENCIA")
      .trim()
      .toUpperCase();
    const tipo = tipoRaw === "BUG" || tipoRaw === "ERROR" ? "BUG" : "SUGERENCIA";
    const detalle = String(payload.detalle || "")
      .trim()
      .slice(0, 2000);
    const pagina = String(payload.pagina || "/armar-pc")
      .trim()
      .slice(0, 150);

    if (!nombre || nombre.length < 2) {
      return NextResponse.json(
        { ok: false, error: "Por favor completá tu nombre." },
        { status: 400 }
      );
    }

    if (!detalle || detalle.length < 4) {
      return NextResponse.json(
        {
          ok: false,
          error: "Por favor escribí el detalle de la sugerencia o del error encontrado.",
        },
        { status: 400 }
      );
    }

    const fechaHora = new Date().toLocaleString("es-PY", {
      timeZone: "America/Asuncion",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    const headerTitle =
      tipo === "BUG"
        ? "🐛 *REPORTE DE ERROR / BUG EN LA PÁGINA*"
        : "💡 *NUEVA SUGERENCIA / MEJORA EN LA PÁGINA*";

    const tipoLabel =
      tipo === "BUG" ? "Error / Bug detectado" : "Sugerencia / Mejora";

    const messageBody = [
      headerTitle,
      "━━━━━━━━━━━━━━━━━━━━",
      `👤 *Vendedor / Usuario:* ${nombre}`,
      `🏷️ *Categoría:* ${tipoLabel}`,
      `📍 *Página:* ${pagina}`,
      `🕒 *Fecha y Hora:* ${fechaHora}`,
      "━━━━━━━━━━━━━━━━━━━━",
      "📝 *Detalle escrito por el vendedor:*",
      detalle,
    ].join("\n");

    const result = await sendWhapiFeedbackMessage(messageBody);

    if (!result.sent) {
      return NextResponse.json(
        {
          ok: false,
          error:
            result.error ||
            "No se pudo enviar la notificación por WhatsApp en este momento.",
        },
        { status: 502 }
      );
    }

    recentSubmissionsByIp.set(clientIp, Date.now());

    return NextResponse.json({
      ok: true,
      sent: true,
    });
  } catch (error) {
    console.error("[API FEEDBACK ERROR]", error);
    return NextResponse.json(
      {
        ok: false,
        error: "Error interno del servidor al procesar el envío del reporte.",
      },
      { status: 500 }
    );
  }
}
