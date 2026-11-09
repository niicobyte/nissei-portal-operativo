import { NextRequest, NextResponse } from "next/server";
import {
  ensureDatabaseInitialized,
  getPool,
  dbGetReparaciones,
  dbGetRecepcionTickets,
  dbGetMontajes,
  dbGetUsuarios,
  seedReparacionesTable,
  seedRecepcionTable,
  seedMontajesTable,
} from "@/lib/mysql";
import { clasificarMensajeCSV } from "@/data/tallerReparacionesData";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const mod = searchParams.get("module") || "all";

    if (mod === "reparaciones") {
      const data = await dbGetReparaciones();
      return NextResponse.json({ ok: true, data });
    }
    if (mod === "recepcion") {
      const data = await dbGetRecepcionTickets();
      return NextResponse.json({ ok: true, data });
    }
    if (mod === "montajes") {
      const data = await dbGetMontajes();
      return NextResponse.json({ ok: true, data });
    }
    if (mod === "usuarios") {
      const data = await dbGetUsuarios();
      return NextResponse.json({ ok: true, data });
    }

    const [reparaciones, recepcion, montajes, usuarios] = await Promise.all([
      dbGetReparaciones(),
      dbGetRecepcionTickets(),
      dbGetMontajes(),
      dbGetUsuarios(),
    ]);
    return NextResponse.json({
      ok: true,
      reparaciones,
      recepcion,
      montajes,
      usuarios,
    });
  } catch (err: unknown) {
    console.error("[MYSQL GET ERROR]", err);
    return NextResponse.json(
      { ok: false, error: "Servicio MySQL en espera (usando espejo local sincronizado)." },
      { status: 503 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
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
      const { cambios = [], nuevasOrdenes = [] } = body;

      for (const c of cambios) {
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
          [c.estadoNuevo, c.fechaEntregada || null, isDelivered, c.idOrden]
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

      for (const t of nuevasOrdenes) {
        await pool.query(
          `INSERT INTO recepcion_tickets
           (id_orden, codigo_producto, cliente, mensaje, fecha_ingreso, fecha_entregada, fecha_venta, estado, tipo_componente, marca, modelo, serial, origen)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'NUEVO_INGRESO')
           ON DUPLICATE KEY UPDATE
             cliente = VALUES(cliente),
             estado = VALUES(estado),
             fecha_entregada = COALESCE(VALUES(fecha_entregada), fecha_entregada),
             tipo_componente = VALUES(tipo_componente),
             marca = VALUES(marca),
             modelo = VALUES(modelo),
             origen = 'NUEVO_INGRESO'`,
          [
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
            t.serial || "SIN SERIAL VISIBLE",
          ]
        );

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
      const data = await dbGetMontajes();
      return NextResponse.json({ ok: true, data });
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

    // 10. Restablecer órdenes de Montaje
    if (action === "RESET_MONTAJES") {
      await pool.query("TRUNCATE TABLE ordenes_montaje");
      await seedMontajesTable(pool);
      const data = await dbGetMontajes();
      return NextResponse.json({ ok: true, data });
    }

    return NextResponse.json({ ok: false, error: "Acción no reconocida." }, { status: 400 });
  } catch (err: unknown) {
    console.error("[MYSQL POST ERROR]", err);
    return NextResponse.json(
      { ok: false, error: "Servicio MySQL en espera (sincronizado en espejo local)." },
      { status: 503 }
    );
  }
}
