import { NextRequest, NextResponse } from "next/server";
import { sendWhapiMessage, WhapiChannel } from "@/lib/whapi";

const ALLOWED_CHANNELS: WhapiChannel[] = ["MONTAJES", "RECEPCION", "TALLER"];

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();
    const { to, channel, body } = payload || {};

    if (!body || typeof body !== "string" || body.trim() === "") {
      return NextResponse.json(
        { error: "El cuerpo del mensaje (body) es requerido." },
        { status: 400 }
      );
    }

    if (channel && !ALLOWED_CHANNELS.includes(channel)) {
      return NextResponse.json(
        { error: "Canal operativo no válido." },
        { status: 400 }
      );
    }

    const result = await sendWhapiMessage({
      to: typeof to === "string" ? to : undefined,
      channel: channel as WhapiChannel,
      body: body.slice(0, 4000),
    });

    if (!result.sent) {
      return NextResponse.json(
        { error: result.error || "No se pudo enviar la notificación." },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    console.error("[API WHATSAPP ERROR]", error);
    return NextResponse.json(
      { error: "Error interno del servidor procesando el envío de WhatsApp." },
      { status: 500 }
    );
  }
}
