import { NextRequest, NextResponse } from "next/server";
import {
  ensureDatabaseInitialized,
  getPool,
  dbGetReparaciones,
  dbGetRecepcionTickets,
  dbGetMontajes,
  dbGetUsuarios,
  dbGetCdeTickets,
  dbGetSatiCrossMatches,
  dbSaveSatiCrossMatch,
  dbDeleteSatiCrossMatch,
  dbGetSatiCheckins,
  dbSaveSatiCheckin,
  dbGetCatalogoSku,
  dbGetPortalConfig,
  dbSavePortalConfig,
  upsertSkusToMySQL,
  seedReparacionesTable,
  seedRecepcionTable,
  seedMontajesTable,
  seedCdeTable,
  getMysqlInfo,
  formatMysqlError,
} from "@/lib/mysql";
import { clasificarMensajeCSV } from "@/data/tallerReparacionesData";
import { INITIAL_RECEPCION_DATA } from "@/data/recepcionData";
import {
  isOrderPairChronologicallyCoherent,
  pickBestChronologicalCandidate,
} from "@/lib/crossMatch";
import { resolveAuthenticatedUser, hasValidAdminHeader } from "@/middleware";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { user, outdatedDeploy } = resolveAuthenticatedUser(req);
    if (!user && !hasValidAdminHeader(req)) {
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

    const { searchParams } = new URL(req.url);
    const mod = searchParams.get("module") || "all";
    const serverInfo = getMysqlInfo();

    if (mod === "reparaciones") {
      const data = await dbGetReparaciones();
      return NextResponse.json({ ok: true, serverInfo, data });
    }
    if (mod === "recepcion") {
      const [data, config] = await Promise.all([
        dbGetRecepcionTickets(),
        dbGetPortalConfig(["recepcion_tecnicos_lista", "recepcion_accesorios_por_tipo"]).catch(() => ({})),
      ]);
      return NextResponse.json({ ok: true, serverInfo, data, config });
    }
    if (mod === "portal_config") {
      const data = await dbGetPortalConfig();
      return NextResponse.json({ ok: true, serverInfo, data });
    }
    if (mod === "montajes") {
      const data = await dbGetMontajes();
      return NextResponse.json({ ok: true, serverInfo, data });
    }
    if (mod === "usuarios") {
      const data = await dbGetUsuarios();
      return NextResponse.json({ ok: true, serverInfo, data });
    }
    if (mod === "cde") {
      const [data, crossMatches, checkins] = await Promise.all([
        dbGetCdeTickets(),
        dbGetSatiCrossMatches().catch(() => []),
        dbGetSatiCheckins().catch(() => ({})),
      ]);
      return NextResponse.json({ ok: true, serverInfo, data, crossMatches, checkins });
    }
    if (mod === "sati_cross_matches") {
      const crossMatches = await dbGetSatiCrossMatches();
      return NextResponse.json({ ok: true, serverInfo, crossMatches });
    }
    if (mod === "catalogo_sku") {
      const data = await dbGetCatalogoSku();
      return NextResponse.json({ ok: true, serverInfo, data });
    }

    const [reparaciones, recepcion, montajes, usuarios, cde, crossMatches, checkins, catalogoSku] = await Promise.all([
      dbGetReparaciones(),
      dbGetRecepcionTickets(),
      dbGetMontajes(),
      dbGetUsuarios(),
      dbGetCdeTickets(),
      dbGetSatiCrossMatches().catch(() => []),
      dbGetSatiCheckins().catch(() => ({})),
      dbGetCatalogoSku().catch(() => []),
    ]);

    return NextResponse.json({
      ok: true,
      serverInfo,
      reparaciones,
      recepcion,
      montajes,
      usuarios,
      cde,
      crossMatches,
      checkins,
      catalogoSku,
    });
  } catch (err: unknown) {
    console.error("[MYSQL GET ERROR]", err);
    return NextResponse.json(
      {
        ok: false,
        serverInfo: getMysqlInfo(),
        error: formatMysqlError(err),
      },
      { status: 503 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const { user, outdatedDeploy } = resolveAuthenticatedUser(req);
    if (!user && !hasValidAdminHeader(req)) {
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

    await ensureDatabaseInitialized();
    const pool = getPool();
    const body = await req.json();
    const { action } = body;

    // 1. Asignar orden a técnico en Taller de Reparaciones
    if (action === "ASIGNAR_TECNICO") {
      const { idOrden, nombreTecnico, nombreAdmin, detalleFalla } = body;
      const fechaHoy = new Date().toLocaleDateString("es-PY", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });

      await pool.query(
        `UPDATE taller_reparaciones
         SET estado = 'EN_REPARACION',
             tecnico_asignado = ?,
             asignado_por = ?,
             fecha_asignacion = ?,
             falla_reportada = ?
         WHERE id_orden = ?`,
        [nombreTecnico, nombreAdmin || "Admin", fechaHoy, (detalleFalla || "").trim(), idOrden]
      );

      await pool.query(
        `UPDATE recepcion_tickets SET estado = 'Asignada' WHERE id_orden = ?`,
        [idOrden]
      );

      const data = await dbGetReparaciones();
      return NextResponse.json({ ok: true, data });
    }

    // 2. Finalizar reparación por el técnico
    if (action === "FINALIZAR_REPARACION") {
      const { idOrden, nombreTecnico, dictamen, detalle, repuestos } = body;
      const fechaHoy = new Date().toLocaleDateString("es-PY", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });

      const esReparado = dictamen === "REPARADO";

      if (esReparado) {
        await pool.query(
          `UPDATE taller_reparaciones
           SET estado = 'FINALIZADA',
               tecnico_asignado = ?,
               dictamen_final = ?,
               detalle_reparacion = ?,
               repuestos_utilizados = ?,
               fecha_finalizacion = ?
           WHERE id_orden = ?`,
          [nombreTecnico, dictamen, detalle || "", repuestos || null, fechaHoy, idOrden]
        );
      } else {
        await pool.query(
          `UPDATE taller_reparaciones
           SET estado = 'FINALIZADA',
               tecnico_asignado = ?,
               dictamen_final = ?,
               observaciones = ?,
               repuestos_utilizados = ?,
               fecha_finalizacion = ?
           WHERE id_orden = ?`,
          [nombreTecnico, dictamen, detalle || "", repuestos || null, fechaHoy, idOrden]
        );
      }

      const nuevoEstadoSATI =
        dictamen === "REPARADO"
          ? "Reparada"
          : dictamen === "SIN_DEFECTO"
          ? "Entregada"
          : "Liquidacion";

      await pool.query(
        `UPDATE recepcion_tickets
         SET estado = ?, mensaje = ?
         WHERE id_orden = ?`,
        [nuevoEstadoSATI, detalle || "", idOrden]
      );

      const data = await dbGetReparaciones();
      return NextResponse.json({ ok: true, data });
    }

    // 3. Restablecer cola de Taller de Reparaciones
    if (action === "RESET_REPARACIONES") {
      await pool.query("TRUNCATE TABLE taller_reparaciones");
      await seedReparacionesTable(pool);
      const data = await dbGetReparaciones();
      return NextResponse.json({ ok: true, data });
    }

    // 4. Agregar nuevo ticket en Recepción Post-Venta
    if (action === "ADD_RECEPCION_TICKET") {
      const { ticket } = body;
      try {
        await pool.query(
          `INSERT INTO recepcion_tickets
           (id_orden, codigo_producto, cliente, mensaje, accesorios, ubicacion, fecha_ingreso, fecha_entregada, fecha_venta, estado, tipo_componente, marca, modelo, serial, origen)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'NUEVO_INGRESO')
           ON DUPLICATE KEY UPDATE
             codigo_producto = VALUES(codigo_producto),
             cliente = VALUES(cliente),
             mensaje = VALUES(mensaje),
             accesorios = COALESCE(VALUES(accesorios), accesorios),
             ubicacion = COALESCE(VALUES(ubicacion), ubicacion),
             fecha_ingreso = VALUES(fecha_ingreso),
             fecha_venta = VALUES(fecha_venta),
             estado = VALUES(estado),
             tipo_componente = VALUES(tipo_componente),
             marca = VALUES(marca),
             modelo = VALUES(modelo),
             serial = VALUES(serial),
             origen = 'NUEVO_INGRESO'`,
          [
            ticket.idOrden,
            ticket.codigoProducto || "",
            ticket.cliente,
            ticket.mensaje || "",
            ticket.accesorios || null,
            ticket.ubicacion || null,
            ticket.fechaIngreso || "",
            ticket.fechaEntregada || null,
            ticket.fechaVenta || null,
            ticket.estado || "En Asignacion",
            ticket.tipoComponente || "GENERAL",
            ticket.marca || "",
            ticket.modelo || "",
            ticket.serial || "S/N",
          ]
        );
      } catch {
        await pool.query(
          `INSERT INTO recepcion_tickets
           (id_orden, codigo_producto, cliente, mensaje, fecha_ingreso, fecha_entregada, fecha_venta, estado, tipo_componente, marca, modelo, serial, origen)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'NUEVO_INGRESO')
           ON DUPLICATE KEY UPDATE
             codigo_producto = VALUES(codigo_producto),
             cliente = VALUES(cliente),
             mensaje = VALUES(mensaje),
             fecha_ingreso = VALUES(fecha_ingreso),
             fecha_venta = VALUES(fecha_venta),
             estado = VALUES(estado),
             tipo_componente = VALUES(tipo_componente),
             marca = VALUES(marca),
             modelo = VALUES(modelo),
             serial = VALUES(serial),
             origen = 'NUEVO_INGRESO'`,
          [
            ticket.idOrden,
            ticket.codigoProducto || "",
            ticket.cliente,
            ticket.mensaje || "",
            ticket.fechaIngreso || "",
            ticket.fechaEntregada || null,
            ticket.fechaVenta || null,
            ticket.estado || "En Asignacion",
            ticket.tipoComponente || "GENERAL",
            ticket.marca || "",
            ticket.modelo || "",
            ticket.serial || "S/N",
          ]
        );
      }

      // Si el estado corresponde al taller, también lo insertamos en taller_reparaciones
      const estLower = (ticket.estado || "").toLowerCase();
      if (
        estLower.includes("reparación") ||
        estLower.includes("asignad") ||
        estLower.includes("asignacion") ||
        estLower.includes("repuesto") ||
        estLower === "qc" ||
        estLower.includes("reparada")
      ) {
        const { detalleReparacion, observaciones } = clasificarMensajeCSV(
          ticket.mensaje,
          ticket.estado
        );
        await pool.query(
          `INSERT INTO taller_reparaciones
           (id_orden, codigo_producto, cliente, equipo, marca, modelo, tipo_componente, serial,
            falla_reportada, detalle_reparacion, observaciones, mensaje_sati, fecha_ingreso, estado)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, '', ?, ?, ?, ?, 'SIN_ASIGNAR')
           ON DUPLICATE KEY UPDATE
             cliente = VALUES(cliente),
             equipo = VALUES(equipo),
             serial = VALUES(serial),
             observaciones = VALUES(observaciones)`,
          [
            ticket.idOrden,
            ticket.codigoProducto || "",
            ticket.cliente,
            `${ticket.marca || ""} ${ticket.modelo || ""}`.trim(),
            ticket.marca || "",
            ticket.modelo || "",
            ticket.tipoComponente || "GENERAL",
            ticket.serial || "S/N",
            detalleReparacion,
            observaciones,
            ticket.mensaje || "",
            ticket.fechaIngreso || "",
          ]
        );
      }

      const data = await dbGetRecepcionTickets();
      return NextResponse.json({ ok: true, data });
    }

    // 4a. Guardar configuración compartida del portal (lista de técnicos / accesos directos)
    if (action === "SAVE_PORTAL_CONFIG") {
      const { configKey, configValue } = body;
      const ALLOWED_CONFIG_KEYS = new Set([
        "recepcion_tecnicos_lista",
        "recepcion_accesorios_por_tipo",
      ]);
      const cleanKey = String(configKey || "").trim();
      if (!ALLOWED_CONFIG_KEYS.has(cleanKey)) {
        return NextResponse.json(
          { ok: false, error: "Clave de configuración no permitida." },
          { status: 400 }
        );
      }
      await dbSavePortalConfig(cleanKey, configValue);
      const data = await dbGetPortalConfig([cleanKey]);
      return NextResponse.json({ ok: true, data });
    }

    // 4b. Actualizar detalles técnicos, accesorios, ubicación, técnico, estado y notas de ticket en Recepción
    if (action === "UPDATE_RECEPCION_DETALLES") {
      const {
        idOrden,
        idOrdenCde,
        estado,
        fechaEntregada,
        mensaje,
        accesorios,
        ubicacion,
        tecnico,
        dictamenTipo,
        mensajeEditadoManualmente,
        ticketSnapshot,
      } = body;

      if (!idOrden) {
        return NextResponse.json(
          { ok: false, error: "idOrden es obligatorio." },
          { status: 400 }
        );
      }

      const cleanId = String(idOrden).trim();
      const hasAccesoriosParam = accesorios !== undefined;
      const cleanAcc =
        accesorios !== undefined && accesorios !== null && String(accesorios).trim() !== ""
          ? String(accesorios).trim()
          : null;
      const hasUbicacionParam = ubicacion !== undefined;
      const cleanUbicacion =
        ubicacion !== undefined && ubicacion !== null && String(ubicacion).trim() !== ""
          ? String(ubicacion).trim()
          : null;
      const hasTecnicoParam = tecnico !== undefined;
      const cleanTecnico =
        tecnico !== undefined && tecnico !== null && String(tecnico).trim() !== ""
          ? String(tecnico).trim()
          : null;
      const hasDictamenParam = dictamenTipo !== undefined;
      const cleanDictamen =
        dictamenTipo !== undefined && dictamenTipo !== null && String(dictamenTipo).trim() !== ""
          ? String(dictamenTipo).trim()
          : null;
      const hasManualEditParam = mensajeEditadoManualmente !== undefined;
      const cleanManualEdit = mensajeEditadoManualmente ? 1 : 0;
      const cleanMsg = mensaje !== undefined && mensaje !== null ? String(mensaje).trim() : null;
      const cleanEstado = estado !== undefined && estado !== null && String(estado).trim() !== "" ? String(estado).trim() : null;
      const isDelivered = cleanEstado ? cleanEstado.toLowerCase() === "entregada" : false;
      const fechaHoy = new Date().toLocaleDateString("es-PY", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
      const cleanFechaEntregada = fechaEntregada !== undefined && fechaEntregada !== null && String(fechaEntregada).trim() !== ""
        ? String(fechaEntregada).trim()
        : (isDelivered ? fechaHoy : null);

      // Asegurar columnas accesorios, ubicacion, tecnico, dictamen_tipo y mensaje_editado_manualmente en ambas tablas
      try {
        await pool.query(
          "ALTER TABLE recepcion_tickets ADD COLUMN accesorios TEXT DEFAULT NULL"
        );
      } catch {}
      try {
        await pool.query(
          "ALTER TABLE recepcion_tickets ADD COLUMN ubicacion VARCHAR(150) DEFAULT NULL"
        );
      } catch {}
      try {
        await pool.query(
          "ALTER TABLE recepcion_tickets ADD COLUMN tecnico VARCHAR(120) DEFAULT NULL"
        );
      } catch {}
      try {
        await pool.query(
          "ALTER TABLE recepcion_tickets ADD COLUMN dictamen_tipo VARCHAR(80) DEFAULT NULL"
        );
      } catch {}
      try {
        await pool.query(
          "ALTER TABLE recepcion_tickets ADD COLUMN mensaje_editado_manualmente TINYINT(1) DEFAULT 0"
        );
      } catch {}
      try {
        await pool.query(
          "ALTER TABLE recepcion_cde_tickets ADD COLUMN accesorios TEXT DEFAULT NULL"
        );
      } catch {}
      try {
        await pool.query(
          "ALTER TABLE recepcion_cde_tickets ADD COLUMN ubicacion VARCHAR(150) DEFAULT NULL"
        );
      } catch {}
      try {
        await pool.query(
          "ALTER TABLE recepcion_cde_tickets ADD COLUMN tecnico VARCHAR(120) DEFAULT NULL"
        );
      } catch {}
      try {
        await pool.query(
          "ALTER TABLE recepcion_cde_tickets ADD COLUMN dictamen_tipo VARCHAR(80) DEFAULT NULL"
        );
      } catch {}
      try {
        await pool.query(
          "ALTER TABLE recepcion_cde_tickets ADD COLUMN mensaje_editado_manualmente TINYINT(1) DEFAULT 0"
        );
      } catch {}

      // 1. Actualizar en recepcion_tickets
      const [updateResult] = await pool.query<any>(
        `UPDATE recepcion_tickets
         SET estado = COALESCE(?, estado),
             fecha_entregada = CASE
               WHEN ? IS NOT NULL THEN ?
               WHEN ? THEN COALESCE(fecha_entregada, ?)
               ELSE fecha_entregada
             END,
             mensaje = COALESCE(?, mensaje),
             accesorios = CASE WHEN ? THEN ? ELSE accesorios END,
             ubicacion = CASE WHEN ? THEN ? ELSE ubicacion END,
             tecnico = CASE WHEN ? THEN ? ELSE tecnico END,
             dictamen_tipo = CASE WHEN ? THEN ? ELSE dictamen_tipo END,
             mensaje_editado_manualmente = CASE WHEN ? THEN ? ELSE mensaje_editado_manualmente END,
             origen = CASE
               WHEN origen = 'NUEVO_INGRESO' THEN 'NUEVO_INGRESO'
               WHEN ? THEN 'RECIEN_ENTREGADO'
               WHEN ? IS NOT NULL THEN 'ESTADO_CAMBIADO'
               ELSE origen
             END,
             updated_at = NOW()
         WHERE id_orden = ?`,
        [
          cleanEstado,
          cleanFechaEntregada,
          cleanFechaEntregada,
          isDelivered,
          fechaHoy,
          cleanMsg,
          hasAccesoriosParam ? 1 : 0,
          cleanAcc,
          hasUbicacionParam ? 1 : 0,
          cleanUbicacion,
          hasTecnicoParam ? 1 : 0,
          cleanTecnico,
          hasDictamenParam ? 1 : 0,
          cleanDictamen,
          hasManualEditParam ? 1 : 0,
          cleanManualEdit,
          isDelivered,
          cleanEstado,
          cleanId,
        ]
      );

      // Si no existía en recepcion_tickets (orden base del sistema o snapshot CSV que aún no fue alterado en MySQL), insertarlo
      if (updateResult && updateResult.affectedRows === 0) {
        const baseTicket =
          INITIAL_RECEPCION_DATA.find((t) => String(t.idOrden).trim() === cleanId) ||
          (ticketSnapshot && typeof ticketSnapshot === "object"
            ? (ticketSnapshot as {
                idOrden?: string;
                codigoProducto?: string;
                cliente?: string;
                mensaje?: string;
                fechaIngreso?: string;
                fechaEntregada?: string;
                fechaVenta?: string;
                estado?: string;
                tipoComponente?: string;
                marca?: string;
                modelo?: string;
                serial?: string;
              })
            : null);

        if (baseTicket) {
          const finalEst = cleanEstado || baseTicket.estado || "En Asignacion";
          await pool.query(
            `INSERT INTO recepcion_tickets
             (id_orden, codigo_producto, cliente, mensaje, accesorios, ubicacion, tecnico, dictamen_tipo, mensaje_editado_manualmente, fecha_ingreso, fecha_entregada, fecha_venta, estado, tipo_componente, marca, modelo, serial, origen)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'CSV')
             ON DUPLICATE KEY UPDATE
               estado = VALUES(estado),
               fecha_entregada = VALUES(fecha_entregada),
               mensaje = VALUES(mensaje),
               accesorios = VALUES(accesorios),
               ubicacion = VALUES(ubicacion),
               tecnico = VALUES(tecnico),
               dictamen_tipo = VALUES(dictamen_tipo),
               mensaje_editado_manualmente = VALUES(mensaje_editado_manualmente)`,
            [
              String(baseTicket.idOrden || cleanId).trim(),
              baseTicket.codigoProducto || "",
              baseTicket.cliente || "Cliente",
              cleanMsg !== null ? cleanMsg : (baseTicket.mensaje || ""),
              cleanAcc,
              cleanUbicacion,
              cleanTecnico,
              cleanDictamen,
              cleanManualEdit,
              baseTicket.fechaIngreso || "",
              cleanFechaEntregada || baseTicket.fechaEntregada || null,
              baseTicket.fechaVenta || null,
              finalEst,
              baseTicket.tipoComponente || "GENERAL",
              baseTicket.marca || "",
              baseTicket.modelo || "",
              baseTicket.serial || "S/N",
            ]
          );
        }
      }

      // 2. Si la orden está cruzada con CDE o es una orden CDE directa, reflejarlo también en recepcion_cde_tickets
      const cdeTargetId =
        (idOrdenCde && String(idOrdenCde).trim()) ||
        (parseInt(cleanId, 10) >= 100000 ? cleanId : null);

      if (cdeTargetId) {
        await pool.query(
          `UPDATE recepcion_cde_tickets
           SET estado = COALESCE(?, estado),
               fecha_entregada = CASE
                 WHEN ? IS NOT NULL THEN ?
                 WHEN ? THEN COALESCE(fecha_entregada, ?)
                 ELSE fecha_entregada
               END,
               mensaje = COALESCE(?, mensaje),
               accesorios = CASE WHEN ? THEN ? ELSE accesorios END,
               ubicacion = CASE WHEN ? THEN ? ELSE ubicacion END,
               tecnico = CASE WHEN ? THEN ? ELSE tecnico END,
               dictamen_tipo = CASE WHEN ? THEN ? ELSE dictamen_tipo END,
               mensaje_editado_manualmente = CASE WHEN ? THEN ? ELSE mensaje_editado_manualmente END,
               updated_at = NOW()
           WHERE id_orden = ?`,
          [
            cleanEstado,
            cleanFechaEntregada,
            cleanFechaEntregada,
            isDelivered,
            fechaHoy,
            cleanMsg,
            hasAccesoriosParam ? 1 : 0,
            cleanAcc,
            hasUbicacionParam ? 1 : 0,
            cleanUbicacion,
            hasTecnicoParam ? 1 : 0,
            cleanTecnico,
            hasDictamenParam ? 1 : 0,
            cleanDictamen,
            hasManualEditParam ? 1 : 0,
            cleanManualEdit,
            cdeTargetId,
          ]
        ).catch(() => {});
      }

      const data = await dbGetRecepcionTickets();
      return NextResponse.json({ ok: true, data });
    }

    // 5. Actualizar estado de ticket en Recepción Post-Venta
    if (action === "UPDATE_RECEPCION_STATUS") {
      const { idOrden, newStatus } = body;
      const isDelivered = String(newStatus || "").trim().toLowerCase() === "entregada";
      const fechaHoy = new Date().toLocaleDateString("es-PY", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
      await pool.query(
        `UPDATE recepcion_tickets
         SET estado = ?,
             fecha_entregada = CASE WHEN ? THEN COALESCE(fecha_entregada, ?) ELSE fecha_entregada END,
             origen = CASE
               WHEN origen = 'NUEVO_INGRESO' THEN 'NUEVO_INGRESO'
               WHEN ? THEN 'RECIEN_ENTREGADO'
               ELSE 'ESTADO_CAMBIADO'
             END
         WHERE id_orden = ?`,
        [newStatus, isDelivered, fechaHoy, isDelivered, idOrden]
      );

      const data = await dbGetRecepcionTickets();
      return NextResponse.json({ ok: true, data });
    }

    // 5b. Actualización masiva desde CSV en Recepción Post-Venta
    if (action === "BULK_UPDATE_RECEPCION_CSV") {
      const { tickets = [], cambios = [], nuevasOrdenes = [] } = body;

      // Sincronización completa por lotes (100 filas por query) de tickets del CSV en MySQL
      if (Array.isArray(tickets) && tickets.length > 0) {
        const BATCH_SIZE = 100;
        for (let i = 0; i < tickets.length; i += BATCH_SIZE) {
          const batch = tickets.slice(i, i + BATCH_SIZE).filter((t: any) => t && t.idOrden);
          if (batch.length === 0) continue;
          const values: any[] = [];
          const placeholders = batch
            .map((t: any) => {
              const isDelivered = String(t.estado || "").trim().toLowerCase() === "entregada";
              values.push(
                t.idOrden,
                t.codigoProducto || "",
                t.cliente || "Cliente",
                t.mensaje || "",
                t.fechaIngreso || "",
                t.fechaEntregada || null,
                t.fechaVenta || null,
                t.estado || "En Asignacion",
                t.tipoComponente || "GENERAL",
                t.marca || "",
                t.modelo || "",
                t.serial || "S/N",
                t.accesorios || null,
                t.origen || (isDelivered ? "RECIEN_ENTREGADO" : "CSV")
              );
              return "(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
            })
            .join(", ");

          await pool.query(
            `INSERT INTO recepcion_tickets
             (id_orden, codigo_producto, cliente, mensaje, fecha_ingreso, fecha_entregada, fecha_venta, estado, tipo_componente, marca, modelo, serial, accesorios, origen)
             VALUES ${placeholders}
             ON DUPLICATE KEY UPDATE
               codigo_producto = VALUES(codigo_producto),
               cliente = VALUES(cliente),
               mensaje = CASE
                 WHEN mensaje_editado_manualmente = 1 THEN mensaje
                 ELSE VALUES(mensaje)
               END,
               fecha_ingreso = VALUES(fecha_ingreso),
               fecha_entregada = COALESCE(VALUES(fecha_entregada), fecha_entregada),
               fecha_venta = VALUES(fecha_venta),
               estado = VALUES(estado),
               tipo_componente = VALUES(tipo_componente),
               marca = VALUES(marca),
               modelo = VALUES(modelo),
               serial = VALUES(serial),
               accesorios = COALESCE(VALUES(accesorios), accesorios)`,
            values
          );
        }
      }

      if (Array.isArray(cambios) && cambios.length > 0) {
        for (const c of cambios) {
          if (!c || !c.idOrden) continue;
          const isDelivered = String(c.estadoNuevo || "").trim().toLowerCase() === "entregada";
          await pool.query(
            `UPDATE recepcion_tickets
             SET estado = ?,
                 fecha_entregada = COALESCE(?, fecha_entregada),
                 origen = CASE
                   WHEN origen = 'NUEVO_INGRESO' THEN 'NUEVO_INGRESO'
                   WHEN ? THEN 'RECIEN_ENTREGADO'
                   ELSE 'ESTADO_CAMBIADO'
                 END
             WHERE id_orden = ?`,
            [c.estadoNuevo || "", c.fechaEntregada || null, isDelivered, c.idOrden]
          );

          const estLower = String(c.estadoNuevo || "").toLowerCase();
          if (estLower.includes("reparada") || estLower === "entregada" || estLower === "qc") {
            await pool.query(
              `UPDATE taller_reparaciones
               SET estado = 'FINALIZADA'
               WHERE id_orden = ?`,
              [c.idOrden]
            );
          }
        }
      }

      const validNuevas = Array.isArray(nuevasOrdenes)
        ? nuevasOrdenes.filter((t: any) => t && t.idOrden && t.cliente && t.estado !== undefined)
        : [];

      if (validNuevas.length > 0) {
        const BATCH_SIZE = 100;
        for (let i = 0; i < validNuevas.length; i += BATCH_SIZE) {
          const batch = validNuevas.slice(i, i + BATCH_SIZE);
          const values: any[] = [];
          const placeholders = batch
            .map((t: any) => {
              values.push(
                t.idOrden,
                t.codigoProducto || "",
                t.cliente,
                t.mensaje || "",
                t.fechaIngreso || "",
                t.fechaEntregada || null,
                t.fechaVenta || null,
                t.estado,
                t.tipoComponente || "GENERAL",
                t.marca || "",
                t.modelo || "",
                t.serial || "SIN SERIAL VISIBLE"
              );
              return "(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'NUEVO_INGRESO')";
            })
            .join(", ");

          await pool.query(
            `INSERT INTO recepcion_tickets
             (id_orden, codigo_producto, cliente, mensaje, fecha_ingreso, fecha_entregada, fecha_venta, estado, tipo_componente, marca, modelo, serial, origen)
             VALUES ${placeholders}
             ON DUPLICATE KEY UPDATE
               cliente = VALUES(cliente),
               estado = VALUES(estado),
               fecha_entregada = COALESCE(VALUES(fecha_entregada), fecha_entregada),
               tipo_componente = VALUES(tipo_componente),
               marca = VALUES(marca),
               modelo = VALUES(modelo),
               origen = 'NUEVO_INGRESO'`,
            values
          );
        }

        for (const t of validNuevas) {
          const estLower = String(t.estado || "").toLowerCase();
          if (
            estLower.includes("reparación") ||
            estLower.includes("asignad") ||
            estLower.includes("asignacion") ||
            estLower.includes("repuesto") ||
            estLower === "qc" ||
            estLower.includes("reparada")
          ) {
            const { detalleReparacion, observaciones } = clasificarMensajeCSV(
              t.mensaje,
              t.estado
            );
            const estadoTaller =
              estLower.includes("reparada") || estLower === "qc"
                ? "FINALIZADA"
                : "SIN_ASIGNAR";
            await pool.query(
              `INSERT INTO taller_reparaciones
               (id_orden, codigo_producto, cliente, equipo, marca, modelo, tipo_componente, serial,
                falla_reportada, detalle_reparacion, observaciones, mensaje_sati, fecha_ingreso, estado)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, '', ?, ?, ?, ?, ?)
               ON DUPLICATE KEY UPDATE
                 cliente = VALUES(cliente),
                 equipo = VALUES(equipo),
                 estado = VALUES(estado)`,
              [
                t.idOrden,
                t.codigoProducto || "",
                t.cliente,
                `${t.marca || ""} ${t.modelo || ""}`.trim() || t.tipoComponente || "EQUIPO",
                t.marca || "",
                t.modelo || "",
                t.tipoComponente || "GENERAL",
                t.serial || "SIN SERIAL VISIBLE",
                detalleReparacion,
                observaciones,
                t.mensaje || "",
                t.fechaIngreso || "",
                estadoTaller,
              ]
            );
          }
        }
      }

      if (body.skipReturnData) {
        return NextResponse.json({ ok: true });
      }

      const data = await dbGetRecepcionTickets();
      return NextResponse.json({ ok: true, data });
    }

    // 6. Restablecer tickets de Recepción Post-Venta
    if (action === "RESET_RECEPCION") {
      await pool.query("TRUNCATE TABLE recepcion_tickets");
      await seedRecepcionTable(pool);
      const data = await dbGetRecepcionTickets();
      return NextResponse.json({ ok: true, data });
    }

    // 6b. Depurar IDs contaminados fuera del rango real de ASU (por ejemplo 32551..99999 filtrados desde CDE)
    if (action === "PRUNE_RECEPCION_BY_IDS") {
      const ids: string[] = Array.isArray(body.ids)
        ? body.ids
            .map((v: unknown) => String(v ?? "").trim())
            .filter((s: string) => s.length > 0 && s.length <= 64)
        : [];

      let deletedCount = 0;
      const BATCH_SIZE = 500;
      for (let i = 0; i < ids.length; i += BATCH_SIZE) {
        const batch = ids.slice(i, i + BATCH_SIZE);
        const placeholders = batch.map(() => "?").join(",");
        await pool.query(
          "DELETE FROM recepcion_tickets WHERE id_orden IN (" + placeholders + ")",
          batch
        );
        await pool.query(
          "DELETE FROM taller_reparaciones WHERE id_orden IN (" + placeholders + ")",
          batch
        );
        deletedCount += batch.length;
      }

      if (body.skipReturnData) {
        return NextResponse.json({ ok: true, deletedCount });
      }
      const data = await dbGetRecepcionTickets();
      return NextResponse.json({ ok: true, deletedCount, data });
    }

    // 7. Agregar nueva orden de Montaje de PC
    if (action === "ADD_MONTAJE") {
      const { orden } = body;
      await pool.query(
        `INSERT INTO ordenes_montaje
         (id, nro_reg, cliente, fecha_facturacion, fecha_montaje, vendedor, canal, estado,
          tipo_servicio, cantidad_equipos, tecnico, etapa, progreso, prioridad,
          consumo_estimado, observaciones, componentes_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           cliente = VALUES(cliente),
           tecnico = VALUES(tecnico),
           etapa = VALUES(etapa),
           progreso = VALUES(progreso),
           observaciones = VALUES(observaciones),
           componentes_json = VALUES(componentes_json)`,
        [
          orden.id,
          orden.nro_reg,
          orden.cliente,
          orden.fecha_facturacion,
          orden.fecha_montaje,
          orden.vendedor,
          orden.canal,
          orden.estado,
          orden.tipo_servicio,
          orden.cantidadEquipos || 1,
          orden.tecnico || "Sin Asignar",
          orden.etapa || "PENDIENTE_PIEZAS",
          orden.progreso || 15,
          orden.prioridad || "NORMAL",
          orden.consumoEstimado || "450W",
          orden.observaciones || "",
          JSON.stringify(orden.componentes || []),
        ]
      );
      const skusOrden = Array.isArray(orden.componentes)
        ? orden.componentes.map((c: { sku?: string; upc?: string; descripcion?: string; categoria?: string }) => ({
            sku: c?.sku || "",
            upc: c?.upc || undefined,
            descripcion: c?.descripcion || "",
            categoria: c?.categoria || "OTROS",
            fuente: "ORDEN",
          }))
        : [];
      await upsertSkusToMySQL(pool, skusOrden, { overwrite: false }).catch((err) =>
        console.warn("[DB Warning Upsert SKU on ADD_MONTAJE]", err)
      );

      const [data, catalogoSku] = await Promise.all([
        dbGetMontajes(),
        dbGetCatalogoSku().catch(() => []),
      ]);
      return NextResponse.json({ ok: true, data, catalogoSku });
    }

    // 8. Actualizar técnico de orden de Montaje
    if (action === "UPDATE_MONTAJE_TECNICO") {
      const { id, tecnico } = body;
      await pool.query(
        `UPDATE ordenes_montaje SET tecnico = ? WHERE id = ?`,
        [tecnico, id]
      );
      const data = await dbGetMontajes();
      return NextResponse.json({ ok: true, data });
    }

    // 9. Actualizar etapa y progreso de orden de Montaje
    if (action === "UPDATE_MONTAJE_STAGE") {
      const { id, etapa, progreso } = body;
      const estado = etapa === "LISTO_ENTREGA" ? "Rev. Cerrado" : "En Proceso";
      await pool.query(
        `UPDATE ordenes_montaje SET etapa = ?, progreso = ?, estado = ? WHERE id = ?`,
        [etapa, progreso, estado, id]
      );
      const data = await dbGetMontajes();
      return NextResponse.json({ ok: true, data });
    }

    // 9.b Actualizar estado de orden de Montaje (ej. Entregar)
    if (action === "UPDATE_MONTAJE_ESTADO") {
      const { id, estado } = body;
      const isDelivered = estado === "Entregado";
      const etapa = isDelivered ? "LISTO_ENTREGA" : "ARMADO_MECANICO";
      const progreso = isDelivered ? 100 : 80;
      await pool.query(
        `UPDATE ordenes_montaje SET estado = ?, etapa = ?, progreso = ? WHERE id = ?`,
        [estado, etapa, progreso, id]
      );
      const data = await dbGetMontajes();
      return NextResponse.json({ ok: true, data });
    }

    // 10. Restablecer órdenes de Montaje
    if (action === "RESET_MONTAJES") {
      await pool.query("TRUNCATE TABLE ordenes_montaje");
      await seedMontajesTable(pool);
      const data = await dbGetMontajes();
      return NextResponse.json({ ok: true, data });
    }

    // 10b. Sincronizar y guardar masivamente órdenes de Montaje / CSV hacia MySQL en la nube
    if (action === "SYNC_ALL_MONTAJES_TO_MYSQL" || action === "BULK_UPDATE_MONTAJES_CSV") {
      const { ordenes = [] } = body;
      let totalSincronizados = 0;

      if (Array.isArray(ordenes) && ordenes.length > 0) {
        for (const orden of ordenes) {
          if (!orden || !orden.id) continue;
          await pool.query(
            `INSERT INTO ordenes_montaje
             (id, nro_reg, cliente, fecha_facturacion, fecha_montaje, vendedor, canal, estado,
              tipo_servicio, cantidad_equipos, tecnico, etapa, progreso, prioridad,
              consumo_estimado, observaciones, componentes_json)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
               nro_reg = VALUES(nro_reg),
               cliente = VALUES(cliente),
               fecha_facturacion = VALUES(fecha_facturacion),
               fecha_montaje = VALUES(fecha_montaje),
               vendedor = VALUES(vendedor),
               canal = VALUES(canal),
               estado = VALUES(estado),
               tipo_servicio = VALUES(tipo_servicio),
               cantidad_equipos = VALUES(cantidad_equipos),
               tecnico = VALUES(tecnico),
               etapa = VALUES(etapa),
               progreso = VALUES(progreso),
               prioridad = VALUES(prioridad),
               consumo_estimado = VALUES(consumo_estimado),
               observaciones = VALUES(observaciones),
               componentes_json = VALUES(componentes_json)`,
            [
              String(orden.id),
              String(orden.nro_reg || ""),
              String(orden.cliente || "Cliente"),
              String(orden.fecha_facturacion || ""),
              String(orden.fecha_montaje || ""),
              String(orden.vendedor || "Salón CDE"),
              String(orden.canal || "Tienda"),
              String(orden.estado || "En Proceso"),
              String(orden.tipo_servicio || "Montaje"),
              Number(orden.cantidadEquipos || 1),
              String(orden.tecnico || "Sin Asignar"),
              String(orden.etapa || "PENDIENTE_PIEZAS"),
              Number(orden.progreso ?? 15),
              String(orden.prioridad || "NORMAL"),
              String(orden.consumoEstimado || "450W"),
              String(orden.observaciones || ""),
              JSON.stringify(Array.isArray(orden.componentes) ? orden.componentes : []),
            ]
          );
          totalSincronizados++;
        }

        const learnedSkus = ordenes.flatMap(
          (orden: { componentes?: { sku?: string; upc?: string; descripcion?: string; categoria?: string }[] }) =>
            Array.isArray(orden?.componentes)
              ? orden.componentes.map((c) => ({
                  sku: c?.sku || "",
                  upc: c?.upc || undefined,
                  descripcion: c?.descripcion || "",
                  categoria: c?.categoria || "OTROS",
                  fuente: "ORDEN",
                }))
              : []
        );
        if (learnedSkus.length > 0) {
          await upsertSkusToMySQL(pool, learnedSkus, { overwrite: false }).catch((err) =>
            console.warn("[DB Warning Bulk Upsert SKUs]", err)
          );
        }
      }

      const [data, catalogoSku] = await Promise.all([
        dbGetMontajes(),
        dbGetCatalogoSku().catch(() => []),
      ]);
      return NextResponse.json({
        ok: true,
        data,
        catalogoSku,
        totalSincronizados,
        message: `Sincronización de montajes con MySQL completada (${totalSincronizados} registro(s) guardados).`,
      });
    }

    // 10c. Guardar o importar SKUs nuevos en el catálogo maestro MySQL (`catalogo_sku`)
    if (action === "UPSERT_CATALOGO_SKU") {
      const { items = [] } = body;
      const totalGuardados = await upsertSkusToMySQL(
        pool,
        Array.isArray(items) ? items : [],
        { overwrite: true }
      );
      const data = await dbGetCatalogoSku();
      return NextResponse.json({
        ok: true,
        totalGuardados,
        data,
        message: `${totalGuardados} SKU(s) guardados en el catálogo maestro de MySQL.`,
      });
    }

    // 11. Alternar confirmación de llegada en Depósito Danesa (CDE / ASU)
    if (action === "TOGGLE_CDE_CHECKIN") {
      const { idOrden, idOrdenAsu, idOrdenCde, recibidoEnDeposito, fechaRecibido } = body;
      const fecha = fechaRecibido || new Date().toLocaleDateString("es-PY", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });

      const targetIds = [idOrden, idOrdenAsu, idOrdenCde].filter(Boolean);
      for (const tid of targetIds) {
        await pool.query(
          `UPDATE recepcion_cde_tickets
           SET recibido_en_deposito = ?,
               fecha_recibido_deposito = ?
           WHERE id_orden = ?`,
          [recibidoEnDeposito ? 1 : 0, recibidoEnDeposito ? fecha : null, tid]
        ).catch((err) => console.warn("[DB Warning CDE Toggle]", err));

        await pool.query(
          `UPDATE recepcion_tickets
           SET recibido_en_deposito = ?,
               fecha_recibido_deposito = ?
           WHERE id_orden = ?`,
          [recibidoEnDeposito ? 1 : 0, recibidoEnDeposito ? fecha : null, tid]
        ).catch((err) => console.warn("[DB Warning ASU Toggle]", err));
      }

      // Guardar confirmación en la tabla sati_checkins
      await dbSaveSatiCheckin(idOrden, Boolean(recibidoEnDeposito), fecha, idOrdenAsu, idOrdenCde).catch(() => {});

      const data = await dbGetCdeTickets();
      return NextResponse.json({ ok: true, data });
    }

    // 11b. Actualizar fechas y números de orden SATI desde el modal
    if (action === "UPDATE_SATI_TICKET") {
      const {
        idOrden,
        idOrdenAsu,
        idOrdenCde,
        fechaIngresoAsu,
        fechaIngresoCde,
        fechaDespachoCde,
        fechaRecibidoAsu,
        recibidoEnDeposito,
      } = body;

      const tieneFechaRecibido = fechaRecibidoAsu && String(fechaRecibidoAsu).trim() !== "";
      const esRecibido = recibidoEnDeposito !== undefined ? (recibidoEnDeposito ? 1 : 0) : (tieneFechaRecibido ? 1 : null);
      const fechaRecibidoVal = tieneFechaRecibido ? String(fechaRecibidoAsu).trim() : null;

      // Si se vinculó ASU con CDE, persistir el cruce
      if (idOrdenAsu && idOrdenCde) {
        await dbSaveSatiCrossMatch(idOrdenAsu, idOrdenCde).catch(() => {});
      }

      if (idOrdenCde) {
        await pool.query(
          `UPDATE recepcion_cde_tickets
           SET fecha_ingreso = COALESCE(NULLIF(?, ''), fecha_ingreso),
               fecha_entregada = COALESCE(NULLIF(?, ''), fecha_entregada),
               recibido_en_deposito = COALESCE(?, recibido_en_deposito),
               fecha_recibido_deposito = COALESCE(?, fecha_recibido_deposito)
           WHERE id_orden = ?`,
          [fechaIngresoCde || null, fechaDespachoCde || null, esRecibido, fechaRecibidoVal, idOrdenCde]
        ).catch(() => {});
      }

      if (idOrdenAsu) {
        await pool.query(
          `UPDATE recepcion_tickets
           SET fecha_ingreso = COALESCE(NULLIF(?, ''), fecha_ingreso),
               fecha_entregada = COALESCE(NULLIF(?, ''), fecha_entregada),
               recibido_en_deposito = COALESCE(?, recibido_en_deposito),
               fecha_recibido_deposito = COALESCE(?, fecha_recibido_deposito)
           WHERE id_orden = ?`,
          [fechaIngresoAsu || null, fechaDespachoCde || null, esRecibido, fechaRecibidoVal, idOrdenAsu]
        ).catch(() => {});
      }

      if (idOrden && idOrden !== idOrdenCde && idOrden !== idOrdenAsu) {
        await pool.query(
          `UPDATE recepcion_cde_tickets
           SET fecha_ingreso = COALESCE(NULLIF(?, ''), fecha_ingreso),
               fecha_entregada = COALESCE(NULLIF(?, ''), fecha_entregada),
               recibido_en_deposito = COALESCE(?, recibido_en_deposito),
               fecha_recibido_deposito = COALESCE(?, fecha_recibido_deposito)
           WHERE id_orden = ?`,
          [fechaIngresoCde || null, fechaDespachoCde || null, esRecibido, fechaRecibidoVal, idOrden]
        ).catch(() => {});

        await pool.query(
          `UPDATE recepcion_tickets
           SET fecha_ingreso = COALESCE(NULLIF(?, ''), fecha_ingreso),
               fecha_entregada = COALESCE(NULLIF(?, ''), fecha_entregada),
               recibido_en_deposito = COALESCE(?, recibido_en_deposito),
               fecha_recibido_deposito = COALESCE(?, fecha_recibido_deposito)
           WHERE id_orden = ?`,
          [fechaIngresoAsu || null, fechaDespachoCde || null, esRecibido, fechaRecibidoVal, idOrden]
        ).catch(() => {});
      }

      return NextResponse.json({ ok: true, message: "Ticket actualizado correctamente en MySQL." });
    }

    // 11c. Vincular cruce manual SATI (ASU ↔ CDE)
    if (action === "LINK_CROSS_MATCH") {
      const { idOrdenAsu, idOrdenCde } = body;
      if (!idOrdenAsu || !idOrdenCde) {
        return NextResponse.json({ ok: false, error: "IDs de orden requeridos." }, { status: 400 });
      }

      await dbSaveSatiCrossMatch(idOrdenAsu, idOrdenCde);

      // Si la orden de CDE ya tiene fecha entregada o mensaje de laboratorio, heredar a ASU para reflejar despacho y dictamen oficial
      const [cdeRows]: any = await pool.query(
        "SELECT fecha_entregada, estado, mensaje FROM recepcion_cde_tickets WHERE id_orden = ?",
        [idOrdenCde]
      );
      if (cdeRows && cdeRows[0]?.fecha_entregada) {
        await pool.query(
          "UPDATE recepcion_tickets SET fecha_entregada = ? WHERE id_orden = ?",
          [cdeRows[0].fecha_entregada, idOrdenAsu]
        ).catch(() => {});
      }
      if (cdeRows && cdeRows[0]?.mensaje && cdeRows[0].mensaje.trim()) {
        await pool.query(
          "UPDATE recepcion_tickets SET mensaje = ? WHERE id_orden = ?",
          [cdeRows[0].mensaje.trim(), idOrdenAsu]
        ).catch(() => {});
      }

      return NextResponse.json({
        ok: true,
        message: `Cruce #${idOrdenAsu} ↔ #${idOrdenCde} guardado en MySQL de la nube.`,
      });
    }

    // 11d. Desvincular cruce manual SATI
    if (action === "UNLINK_CROSS_MATCH") {
      const { idOrdenAsu, idOrdenCde } = body;
      if (idOrdenAsu && idOrdenCde) {
        await dbDeleteSatiCrossMatch(idOrdenAsu, idOrdenCde);
      }
      return NextResponse.json({ ok: true, message: "Cruce desvinculado correctamente." });
    }

    // 11e. Notificar por WhatsApp y marcar como Recibido en SATI ASU - CDE con cruce automático
    if (action === "NOTIFICAR_Y_RECIBIR_SATI") {
      const { idOrden, serial, codigoProducto, cliente, fechaNotificacion } = body;
      if (!idOrden) {
        return NextResponse.json({ ok: false, error: "Nº de orden requerido." }, { status: 400 });
      }

      const idOrdenStr = String(idOrden).trim();
      const serialStr = serial ? String(serial).trim() : "";
      const prodCode = codigoProducto ? String(codigoProducto).trim() : "";

      const now = new Date();
      const fechaHoyCorta = now.toLocaleDateString("es-PY", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
      const horaCorta = now.toLocaleTimeString("es-PY", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
      const fecha = fechaNotificacion || `${fechaHoyCorta} ${horaCorta}`;

      // 1. Marcar la orden de ASU como recibida en depósito
      await pool.query(
        `UPDATE recepcion_tickets
         SET recibido_en_deposito = 1,
             fecha_recibido_deposito = ?
         WHERE id_orden = ?`,
        [fecha, idOrdenStr]
      ).catch((err) => console.warn("[DB Warning Recepcion Ticket Update]", err));

      // 2. Buscar cruce automático con orden CDE (con validación cronológica estricta)
      const [asuMetaRows]: any = await pool.query(
        "SELECT fecha_ingreso, fecha_entregada, estado FROM recepcion_tickets WHERE id_orden = ? LIMIT 1",
        [idOrdenStr]
      );
      const asuMeta = {
        idOrden: idOrdenStr,
        fechaIngreso: asuMetaRows?.[0]?.fecha_ingreso || "",
        fechaEntregada: asuMetaRows?.[0]?.fecha_entregada || "",
        estado: asuMetaRows?.[0]?.estado || "",
      };

      const pickBestCdeRow = (rows: any[]): string | null => {
        if (!Array.isArray(rows) || rows.length === 0) return null;
        const cands = rows
          .filter((r) => r?.id_orden)
          .map((r) => ({
            idOrden: String(r.id_orden).trim(),
            fechaIngreso: r.fecha_ingreso || "",
            fechaEntregada: r.fecha_entregada || "",
          }));
        const best = pickBestChronologicalCandidate(asuMeta, cands, null, true);
        return best ? best.idOrden : null;
      };

      let matchedCdeId: string | null = null;

      // 2a. Verificar si ya existe un cruce previo válido en sati_cross_matches
      const [existingMatches]: any = await pool.query(
        `SELECT m.id_orden_cde, c.fecha_ingreso, c.fecha_entregada
         FROM sati_cross_matches m
         LEFT JOIN recepcion_cde_tickets c ON c.id_orden = m.id_orden_cde
         WHERE m.id_orden_asu = ?`,
        [idOrdenStr]
      );
      for (const row of existingMatches || []) {
        const candId = String(row?.id_orden_cde || "").trim();
        if (!candId) continue;
        const coherent = isOrderPairChronologicallyCoherent(
          asuMeta,
          { fechaIngreso: row.fecha_ingreso || "", fechaEntregada: row.fecha_entregada || "" },
          { maxPreIngresoDays: 14, maxPreDespachoDays: 7, maxPostEntregaDays: 7 }
        );
        if (coherent) {
          matchedCdeId = candId;
          break;
        }
        await dbDeleteSatiCrossMatch(idOrdenStr, candId).catch(() => {});
      }

      // 2b. Si no hay cruce previo válido, buscar en recepcion_cde_tickets por serial físico válido
      const isSerialValido =
        serialStr &&
        serialStr.toUpperCase() !== "SIN SERIAL" &&
        serialStr.toUpperCase() !== "S/N" &&
        serialStr.length >= 4;

      if (!matchedCdeId && isSerialValido) {
        const [cdeBySerial]: any = await pool.query(
          `SELECT id_orden, fecha_ingreso, fecha_entregada FROM recepcion_cde_tickets
           WHERE CAST(id_orden AS UNSIGNED) >= 100000
             AND (serial = ? OR serial LIKE ?)
           ORDER BY CAST(id_orden AS UNSIGNED) DESC
           LIMIT 20`,
          [serialStr, `%${serialStr}%`]
        );
        matchedCdeId = pickBestCdeRow(cdeBySerial);
      }

      // 2c. Si aún no cruza, buscar si en el mensaje/dictamen de CDE mencionan la orden ASU
      if (!matchedCdeId) {
        const [cdeByMention]: any = await pool.query(
          `SELECT id_orden, fecha_ingreso, fecha_entregada FROM recepcion_cde_tickets
           WHERE CAST(id_orden AS UNSIGNED) >= 100000
             AND (mensaje LIKE ? OR mensaje LIKE ?)
           ORDER BY CAST(id_orden AS UNSIGNED) DESC
           LIMIT 20`,
          [`%#${idOrdenStr}%`, `%${idOrdenStr}%`]
        );
        matchedCdeId = pickBestCdeRow(cdeByMention);
      }

      // 2d. Si aún no cruza y coincide código de producto + cliente directo
      if (!matchedCdeId && prodCode && cliente && String(cliente).trim().toLowerCase() !== "danesa sa") {
        const [cdeByProdClient]: any = await pool.query(
          `SELECT id_orden, fecha_ingreso, fecha_entregada FROM recepcion_cde_tickets
           WHERE CAST(id_orden AS UNSIGNED) >= 100000
             AND codigo_producto = ? AND cliente = ?
           ORDER BY CAST(id_orden AS UNSIGNED) DESC
           LIMIT 20`,
          [prodCode, cliente]
        );
        matchedCdeId = pickBestCdeRow(cdeByProdClient);
      }

      // 3. Si se encontró orden CDE emparejada, actualizarla y persistir el cruce
      if (matchedCdeId) {
        await dbSaveSatiCrossMatch(idOrdenStr, matchedCdeId).catch(() => {});
        await pool.query(
          `UPDATE recepcion_cde_tickets
           SET recibido_en_deposito = 1,
               fecha_recibido_deposito = ?
           WHERE id_orden = ?`,
          [fecha, matchedCdeId]
        ).catch(() => {});
        await dbSaveSatiCheckin(matchedCdeId, true, fecha, idOrdenStr, matchedCdeId).catch(() => {});
      }

      // 4. Registrar checkin oficial de ASU en sati_checkins
      await dbSaveSatiCheckin(idOrdenStr, true, fecha, idOrdenStr, matchedCdeId || undefined).catch(() => {});

      return NextResponse.json({
        ok: true,
        fecha,
        matchedCdeId,
        message: matchedCdeId
          ? `Orden #${idOrdenStr} cruzada con CDE #${matchedCdeId} y confirmada como Recibido (${fecha}).`
          : `Orden #${idOrdenStr} confirmada como Recibido en SATI ASU - CDE (${fecha}).`,
      });
    }

    // 12. Actualización masiva desde CSV en SATI CDE / Depósito Danesa (Full MySQL)
    if (action === "BULK_UPDATE_CDE_CSV") {
      const { tickets = [] } = body;
      const cdeOnlyTickets = (Array.isArray(tickets) ? tickets : []).filter((t: any) => {
        const num = parseInt(t?.idOrden, 10);
        return isNaN(num) || num >= 100000;
      });

      if (cdeOnlyTickets.length > 0) {
        const BATCH_SIZE = 100;
        for (let i = 0; i < cdeOnlyTickets.length; i += BATCH_SIZE) {
          const batch = cdeOnlyTickets.slice(i, i + BATCH_SIZE);
          const values: any[] = [];
          const placeholders = batch.map((t: any) => {
            values.push(
              t.idOrden,
              t.codigoProducto || "",
              t.cliente,
              t.mensaje || "",
              t.fechaIngreso || "",
              t.fechaEntregada || null,
              t.fechaVenta || null,
              t.estado || "En Asignacion",
              t.tipoComponente || "GENERAL",
              t.modelo || "",
              t.marca || "",
              t.serial || "S/N",
              t.diasResolucion ?? null,
              t.esDanesa ? 1 : 0,
              t.recibidoEnDeposito ? 1 : 0
            );
            return "(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
          }).join(", ");

          await pool.query(
            `INSERT INTO recepcion_cde_tickets
             (id_orden, codigo_producto, cliente, mensaje, fecha_ingreso, fecha_entregada, fecha_venta,
              estado, tipo_componente, modelo, marca, serial, dias_resolucion, es_danesa, recibido_en_deposito)
             VALUES ${placeholders}
             ON DUPLICATE KEY UPDATE
               cliente = VALUES(cliente),
               mensaje = VALUES(mensaje),
               fecha_ingreso = VALUES(fecha_ingreso),
               fecha_entregada = VALUES(fecha_entregada),
               estado = VALUES(estado),
               tipo_componente = VALUES(tipo_componente),
               modelo = VALUES(modelo),
               marca = VALUES(marca),
               serial = VALUES(serial),
               dias_resolucion = VALUES(dias_resolucion),
               es_danesa = VALUES(es_danesa),
               recibido_en_deposito = COALESCE(VALUES(recibido_en_deposito), recibido_en_deposito)`,
            values
          );
        }
      }
      if (body.skipReturnData) {
        return NextResponse.json({ ok: true });
      }

      const data = await dbGetCdeTickets();
      return NextResponse.json({ ok: true, data });
    }

    // 13. Restablecer datos SATI CDE
    if (action === "RESET_CDE") {
      await pool.query("TRUNCATE TABLE recepcion_cde_tickets");
      await seedCdeTable(pool);
      const data = await dbGetCdeTickets();
      return NextResponse.json({ ok: true, data });
    }

    // 14. Eliminar registro individual de cualquier tabla desde el Visor de Base de Datos (Solo ADMIN)
    if (action === "DELETE_ROW") {
      const { user } = resolveAuthenticatedUser(req);
      if (user?.role !== "ADMIN" && !hasValidAdminHeader(req)) {
        return NextResponse.json(
          { ok: false, error: "Autorización de Administrador requerida para eliminar registros." },
          { status: 403 }
        );
      }

      const { table, id } = body;
      if (!table || !id) {
        return NextResponse.json(
          { ok: false, error: "Parámetros tabla e ID son requeridos." },
          { status: 400 }
        );
      }

      if (table === "usuarios" && id === "admin") {
        return NextResponse.json(
          { ok: false, error: "No se puede eliminar el usuario administrador principal." },
          { status: 403 }
        );
      }

      try {
        if (table === "recepcion_tickets") {
          await pool.query("DELETE FROM recepcion_tickets WHERE id_orden = ?", [id]);
          await pool.query("DELETE FROM taller_reparaciones WHERE id_orden = ?", [id]);
        } else if (table === "taller_reparaciones") {
          await pool.query("DELETE FROM taller_reparaciones WHERE id_orden = ?", [id]);
        } else if (table === "ordenes_montaje") {
          await pool.query("DELETE FROM ordenes_montaje WHERE id = ?", [id]);
        } else if (table === "recepcion_cde_tickets") {
          await pool.query("DELETE FROM recepcion_cde_tickets WHERE id_orden = ?", [id]);
        } else if (table === "usuarios") {
          await pool.query("DELETE FROM usuarios WHERE id = ?", [id]);
        }
      } catch (sqlErr) {
        console.warn("[MYSQL DELETE_ROW] Error en MySQL:", sqlErr);
      }

      return NextResponse.json({
        ok: true,
        message: `Registro ${id} eliminado correctamente.`
      });
    }

    // 15. Sincronización masiva de órdenes SATI, checkins y overrides a MySQL en la nube (Full Batch)
    if (action === "SYNC_ALL_SATI_TO_MYSQL") {
      const { checkins = [], overrides = [] } = body;
      let totalSincronizados = 0;

      // 1. Procesar checkins explícitos o personalizados por lotes (Batch IN) para no saturar la red
      if (Array.isArray(checkins) && checkins.length > 0) {
        const activos = checkins.filter((c: any) => c.recibidoEnDeposito);
        const inactivos = checkins.filter((c: any) => !c.recibidoEnDeposito);

        // Agrupar activos por fecha para actualizar en lotes masivos
        const porFecha = new Map<string, string[]>();
        for (const chk of activos) {
          const f = chk.fechaRecibido || new Date().toLocaleDateString("es-PY", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
          });
          const ids = [chk.idOrden, chk.idOrdenAsu, chk.idOrdenCde].filter(Boolean);
          if (!porFecha.has(f)) porFecha.set(f, []);
          porFecha.get(f)!.push(...ids);

          // Registrar en sati_checkins permanente
          await dbSaveSatiCheckin(
            chk.idOrden,
            true,
            f,
            chk.idOrdenAsu,
            chk.idOrdenCde
          ).catch(() => {});
        }

        for (const [fechaVal, allIds] of porFecha.entries()) {
          const uniqueIds = Array.from(new Set(allIds));
          const BATCH = 150;
          for (let i = 0; i < uniqueIds.length; i += BATCH) {
            const chunk = uniqueIds.slice(i, i + BATCH);
            const placeholders = chunk.map(() => "?").join(", ");

            await pool.query(
              `UPDATE recepcion_cde_tickets
               SET recibido_en_deposito = 1, fecha_recibido_deposito = ?
               WHERE id_orden IN (${placeholders})`,
              [fechaVal, ...chunk]
            ).catch(() => {});

            await pool.query(
              `UPDATE recepcion_tickets
               SET recibido_en_deposito = 1, fecha_recibido_deposito = ?
               WHERE id_orden IN (${placeholders})`,
              [fechaVal, ...chunk]
            ).catch(() => {});
          }
        }

        // Si hay órdenes desmarcadas manualmente
        if (inactivos.length > 0) {
          const desmarcadosIds = Array.from(
            new Set(inactivos.flatMap((c: any) => [c.idOrden, c.idOrdenAsu, c.idOrdenCde].filter(Boolean)))
          );
          const BATCH = 150;
          for (let i = 0; i < desmarcadosIds.length; i += BATCH) {
            const chunk = desmarcadosIds.slice(i, i + BATCH);
            const placeholders = chunk.map(() => "?").join(", ");

            await pool.query(
              `UPDATE recepcion_cde_tickets
               SET recibido_en_deposito = 0, fecha_recibido_deposito = NULL
               WHERE id_orden IN (${placeholders})`,
              chunk
            ).catch(() => {});

            await pool.query(
              `UPDATE recepcion_tickets
               SET recibido_en_deposito = 0, fecha_recibido_deposito = NULL
               WHERE id_orden IN (${placeholders})`,
              chunk
            ).catch(() => {});
          }

          for (const chk of inactivos) {
            await dbSaveSatiCheckin(
              chk.idOrden,
              false,
              "",
              chk.idOrdenAsu,
              chk.idOrdenCde
            ).catch(() => {});
          }
        }

        totalSincronizados += checkins.length;
      }

      // 2. Aplicar overrides manuales de fechas u órdenes
      if (Array.isArray(overrides) && overrides.length > 0) {
        for (const ov of overrides) {
          const { idOrdenAsu, idOrdenCde, fechaIngresoAsu, fechaIngresoCde, fechaDespachoCde, fechaRecibidoAsu } = ov;
          if (idOrdenAsu && idOrdenCde) {
            await dbSaveSatiCrossMatch(idOrdenAsu, idOrdenCde).catch(() => {});
          }
          if (idOrdenCde) {
            await pool.query(
              `UPDATE recepcion_cde_tickets
               SET fecha_ingreso = COALESCE(NULLIF(?, ''), fecha_ingreso),
                   fecha_entregada = COALESCE(NULLIF(?, ''), fecha_entregada),
                   fecha_recibido_deposito = COALESCE(NULLIF(?, ''), fecha_recibido_deposito)
               WHERE id_orden = ?`,
              [fechaIngresoCde || null, fechaDespachoCde || null, fechaRecibidoAsu || null, idOrdenCde]
            ).catch(() => {});
          }
          if (idOrdenAsu) {
            await pool.query(
              `UPDATE recepcion_tickets
               SET fecha_ingreso = COALESCE(NULLIF(?, ''), fecha_ingreso),
                   fecha_entregada = COALESCE(NULLIF(?, ''), fecha_entregada),
                   fecha_recibido_deposito = COALESCE(NULLIF(?, ''), fecha_recibido_deposito)
               WHERE id_orden = ?`,
              [fechaIngresoAsu || null, fechaDespachoCde || null, fechaRecibidoAsu || null, idOrdenAsu]
            ).catch(() => {});
          }
        }
      }

      return NextResponse.json({
        ok: true,
        message: "Sincronización completa con MySQL finalizada con éxito.",
        totalSincronizados,
      });
    }

    return NextResponse.json({ ok: false, error: "Acción no reconocida." }, { status: 400 });
  } catch (err: unknown) {
    console.error("[MYSQL POST ERROR]", err);
    return NextResponse.json(
      { ok: false, error: formatMysqlError(err) },
      { status: 503 }
    );
  }
}
