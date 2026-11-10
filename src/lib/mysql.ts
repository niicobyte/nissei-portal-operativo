import mysql from "mysql2/promise";
import { INITIAL_RECEPCION_DATA, RecepcionTicket } from "@/data/recepcionData";
import { INITIAL_MONTAJES_REALES, OrdenMontajeReal } from "@/data/montajesData";
import {
  LISTA_TECNICOS,
  OrdenReparacion,
  clasificarMensajeCSV,
} from "@/data/tallerReparacionesData";
import {
  INITIAL_RECEPCION_CDE_DATA,
  RecepcionCdeTicket,
  calcularDiasResolucion,
  isTicketDanesa,
} from "@/data/recepcionCdeData";
import { USER_PROFILES, UserProfile } from "@/data/authData";

export interface MysqlConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  source: string;
  isRailway: boolean;
}

export function resolveMysqlConfig(): MysqlConfig {
  const isRailway = Boolean(
    process.env.RAILWAY_ENVIRONMENT ||
    process.env.RAILWAY_SERVICE_NAME ||
    process.env.RAILWAY_PROJECT_ID
  );

  const connectionUrl =
    process.env.MYSQL_URL ||
    process.env.MYSQL_PUBLIC_URL ||
    process.env.DATABASE_URL;

  if (connectionUrl) {
    try {
      const parsed = new URL(connectionUrl);
      return {
        host: parsed.hostname || "localhost",
        port: Number(parsed.port || 3306),
        user: decodeURIComponent(parsed.username || "root"),
        password: decodeURIComponent(parsed.password || ""),
        database: parsed.pathname.replace(/^\//, "") || (isRailway ? "railway" : "nissei_portal"),
        source: "URL",
        isRailway,
      };
    } catch {
      // Fallback a variables individuales si la URL no es válida
    }
  }

  const defaultHost = isRailway ? "mysql.railway.internal" : "localhost";
  const defaultDatabase = isRailway ? "railway" : "nissei_portal";

  return {
    host: process.env.MYSQL_HOST || process.env.MYSQLHOST || defaultHost,
    port: Number(process.env.MYSQL_PORT || process.env.MYSQLPORT || 3306),
    user: process.env.MYSQL_USER || process.env.MYSQLUSER || "root",
    password: process.env.MYSQL_PASSWORD || process.env.MYSQLPASSWORD || "",
    database: process.env.MYSQL_DATABASE || process.env.MYSQLDATABASE || defaultDatabase,
    source: isRailway ? "RAILWAY_INTERNAL" : "ENV_LOCAL",
    isRailway,
  };
}

export function getMysqlInfo() {
  const config = resolveMysqlConfig();
  return {
    host: config.host,
    port: config.port,
    database: config.database,
    user: config.user,
    isRailway: config.isRailway,
    source: config.source,
  };
}

declare global {
  // eslint-disable-next-line no-var
  var __nisseiMysqlPool: mysql.Pool | undefined;
  // eslint-disable-next-line no-var
  var __nisseiMysqlInitialized: boolean | undefined;
  // eslint-disable-next-line no-var
  var __nisseiMysqlInitPromise: Promise<void> | undefined;
}

export function getPool(): mysql.Pool {
  const config = resolveMysqlConfig();
  if (!global.__nisseiMysqlPool) {
    global.__nisseiMysqlPool = mysql.createPool({
      host: config.host,
      port: config.port,
      user: config.user,
      password: config.password,
      database: config.database,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      charset: "utf8mb4",
      connectTimeout: 7000,
    });
  }
  return global.__nisseiMysqlPool;
}

/**
 * Crea la base de datos y las 5 tablas si no existen, y realiza el seed inicial
 * con todos los datos reales del CSV de Recepción, Taller de Reparaciones, Montajes, CDE y Usuarios.
 */
export async function ensureDatabaseInitialized(): Promise<void> {
  if (global.__nisseiMysqlInitialized) return;
  if (global.__nisseiMysqlInitPromise) {
    return global.__nisseiMysqlInitPromise;
  }

  global.__nisseiMysqlInitPromise = (async () => {
    try {
      const config = resolveMysqlConfig();

      // 1. Asegurar que la base de datos exista (compatible con MySQL local y Railway Cloud)
      try {
        const bootstrapConn = await mysql.createConnection({
          host: config.host,
          port: config.port,
          user: config.user,
          password: config.password,
          connectTimeout: 5000,
        });
        await bootstrapConn.query(
          `CREATE DATABASE IF NOT EXISTS \`${config.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`
        );
        await bootstrapConn.end();
      } catch {
        // En proveedores cloud como Railway la base de datos (ej. 'railway') ya viene precreada
      }

      const pool = getPool();

      // 2. Crear las 5 tablas principales si no existen
      await pool.query(`
        CREATE TABLE IF NOT EXISTS usuarios (
          id VARCHAR(50) PRIMARY KEY,
          nombre VARCHAR(120) NOT NULL,
          role VARCHAR(50) NOT NULL,
          password VARCHAR(120) NOT NULL,
          default_route VARCHAR(100) NOT NULL,
          avatar VARCHAR(10) NOT NULL,
          badge VARCHAR(100) NOT NULL,
          descripcion TEXT,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);

      try {
        await pool.query("ALTER TABLE usuarios MODIFY COLUMN role VARCHAR(50) NOT NULL");
      } catch {
        // Ignorar si ya es VARCHAR
      }

      await pool.query(`
        CREATE TABLE IF NOT EXISTS recepcion_tickets (
          id_orden VARCHAR(50) PRIMARY KEY,
          codigo_producto VARCHAR(80) DEFAULT '',
          cliente VARCHAR(200) NOT NULL,
          mensaje TEXT,
          fecha_ingreso VARCHAR(50) NOT NULL,
          fecha_entregada VARCHAR(50) DEFAULT NULL,
          fecha_venta VARCHAR(50) DEFAULT NULL,
          estado VARCHAR(80) NOT NULL,
          tipo_componente VARCHAR(100) NOT NULL,
          marca VARCHAR(100) NOT NULL,
          modelo VARCHAR(200) NOT NULL,
          serial VARCHAR(150) NOT NULL,
          origen VARCHAR(40) DEFAULT 'CSV',
          accesorios TEXT DEFAULT NULL,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_recepcion_estado (estado),
          INDEX idx_recepcion_cliente (cliente)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);

      try {
        await pool.query(
          "ALTER TABLE recepcion_tickets ADD COLUMN origen VARCHAR(40) DEFAULT 'CSV'"
        );
      } catch {
        // La columna origen ya existe en la tabla
      }

      try {
        await pool.query(
          "ALTER TABLE recepcion_tickets ADD COLUMN accesorios TEXT DEFAULT NULL"
        );
      } catch {
        // La columna accesorios ya existe en la tabla
      }

      try {
        await pool.query(
          "ALTER TABLE recepcion_tickets ADD COLUMN recibido_en_deposito TINYINT(1) DEFAULT 0"
        );
      } catch {
        // La columna ya existe
      }

      try {
        await pool.query(
          "ALTER TABLE recepcion_tickets ADD COLUMN fecha_recibido_deposito VARCHAR(50) DEFAULT NULL"
        );
      } catch {
        // La columna ya existe
      }

      await pool.query(`
        CREATE TABLE IF NOT EXISTS taller_reparaciones (
          id_orden VARCHAR(50) PRIMARY KEY,
          codigo_producto VARCHAR(80) DEFAULT '',
          cliente VARCHAR(200) NOT NULL,
          equipo VARCHAR(255) NOT NULL,
          marca VARCHAR(100) NOT NULL,
          modelo VARCHAR(200) NOT NULL,
          tipo_componente VARCHAR(100) NOT NULL,
          serial VARCHAR(150) NOT NULL,
          falla_reportada TEXT,
          detalle_reparacion TEXT,
          observaciones TEXT,
          mensaje_sati TEXT,
          fecha_ingreso VARCHAR(50) NOT NULL,
          fecha_asignacion VARCHAR(50) DEFAULT NULL,
          fecha_finalizacion VARCHAR(50) DEFAULT NULL,
          estado ENUM('SIN_ASIGNAR', 'EN_REPARACION', 'FINALIZADA') NOT NULL DEFAULT 'SIN_ASIGNAR',
          tecnico_asignado VARCHAR(100) DEFAULT NULL,
          asignado_por VARCHAR(100) DEFAULT NULL,
          dictamen_final ENUM('REPARADO', 'SIN_DEFECTO', 'NO_REPARADO') DEFAULT NULL,
          repuestos_utilizados TEXT,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_taller_estado (estado),
          INDEX idx_taller_tecnico (tecnico_asignado)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS ordenes_montaje (
          id VARCHAR(60) PRIMARY KEY,
          nro_reg VARCHAR(60) NOT NULL,
          cliente VARCHAR(200) NOT NULL,
          fecha_facturacion VARCHAR(50) NOT NULL,
          fecha_montaje VARCHAR(50) NOT NULL,
          vendedor VARCHAR(150) NOT NULL,
          canal VARCHAR(100) NOT NULL,
          estado VARCHAR(60) NOT NULL,
          tipo_servicio VARCHAR(60) NOT NULL,
          cantidad_equipos INT NOT NULL DEFAULT 1,
          tecnico VARCHAR(120) NOT NULL DEFAULT 'Sin Asignar',
          etapa VARCHAR(60) NOT NULL DEFAULT 'PENDIENTE_PIEZAS',
          progreso INT NOT NULL DEFAULT 15,
          prioridad VARCHAR(40) NOT NULL DEFAULT 'NORMAL',
          consumo_estimado VARCHAR(50) DEFAULT '450W',
          observaciones TEXT,
          componentes_json LONGTEXT NOT NULL,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_montaje_estado (estado),
          INDEX idx_montaje_tecnico (tecnico)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS recepcion_cde_tickets (
          id_orden VARCHAR(50) PRIMARY KEY,
          codigo_producto VARCHAR(80) DEFAULT '',
          cliente VARCHAR(200) NOT NULL,
          mensaje TEXT,
          fecha_ingreso VARCHAR(50) NOT NULL,
          fecha_entregada VARCHAR(50) DEFAULT NULL,
          fecha_venta VARCHAR(50) DEFAULT NULL,
          estado VARCHAR(80) NOT NULL,
          tipo_componente VARCHAR(100) NOT NULL,
          modelo VARCHAR(200) NOT NULL,
          marca VARCHAR(100) NOT NULL,
          serial VARCHAR(150) NOT NULL,
          dias_resolucion INT DEFAULT NULL,
          es_danesa TINYINT(1) DEFAULT 0,
          recibido_en_deposito TINYINT(1) DEFAULT 0,
          fecha_recibido_deposito VARCHAR(50) DEFAULT NULL,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_cde_estado (estado),
          INDEX idx_cde_cliente (cliente),
          INDEX idx_cde_deposito (recibido_en_deposito)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);

      // Limpieza preventiva: recepcion_cde_tickets solo debe contener órdenes reales de CDE (>= 100000)
      await pool.query(
        "DELETE FROM recepcion_cde_tickets WHERE CAST(id_orden AS UNSIGNED) < 100000"
      ).catch(() => {});

      // Auto-confirmar en depósito las órdenes con estado Entregada o Reparada
      await pool.query(
        `UPDATE recepcion_cde_tickets
         SET recibido_en_deposito = 1,
             fecha_recibido_deposito = COALESCE(NULLIF(fecha_entregada, ''), fecha_recibido_deposito, fecha_ingreso)
         WHERE (LOWER(estado) LIKE '%entregad%' OR LOWER(estado) LIKE '%reparad%')
           AND recibido_en_deposito = 0`
      ).catch(() => {});

      await pool.query(
        `UPDATE recepcion_tickets
         SET recibido_en_deposito = 1,
             fecha_recibido_deposito = COALESCE(NULLIF(fecha_entregada, ''), fecha_recibido_deposito, fecha_ingreso)
         WHERE (LOWER(estado) LIKE '%entregad%' OR LOWER(estado) LIKE '%reparad%')
           AND recibido_en_deposito = 0`
      ).catch(() => {});

      // 3. Seed de Usuarios (almacena únicamente hash SHA-256, nunca texto plano)
      for (const u of USER_PROFILES) {
        await pool.query(
          `INSERT INTO usuarios (id, nombre, role, password, default_route, avatar, badge, descripcion)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE
             nombre = VALUES(nombre),
             role = VALUES(role),
             password = VALUES(password),
             default_route = VALUES(default_route),
             avatar = VALUES(avatar),
             badge = VALUES(badge),
             descripcion = VALUES(descripcion)`,
          [u.id, u.nombre, u.role, u.passwordHash, u.defaultRoute, u.avatar, u.badge, u.descripcion]
        );
      }

      // 4. Seed inicial de Recepción Post-Venta si está vacía
      const [recCountRows] = await pool.query<mysql.RowDataPacket[]>(
        "SELECT COUNT(*) as count FROM recepcion_tickets"
      );
      if ((recCountRows[0]?.count || 0) === 0) {
        await seedRecepcionTable(pool);
      }

      // 5. Seed inicial de Taller de Reparaciones si está vacía
      const [repCountRows] = await pool.query<mysql.RowDataPacket[]>(
        "SELECT COUNT(*) as count FROM taller_reparaciones"
      );
      if ((repCountRows[0]?.count || 0) === 0) {
        await seedReparacionesTable(pool);
      }

      // 6. Seed inicial de Órdenes de Montaje si está vacía
      const [mntCountRows] = await pool.query<mysql.RowDataPacket[]>(
        "SELECT COUNT(*) as count FROM ordenes_montaje"
      );
      if ((mntCountRows[0]?.count || 0) === 0) {
        await seedMontajesTable(pool);
      }

      // 7. Seed inicial de Tickets CDE Casa Matriz / Depósito Danesa si está vacía
      const [cdeCountRows] = await pool.query<mysql.RowDataPacket[]>(
        "SELECT COUNT(*) as count FROM recepcion_cde_tickets"
      );
      if ((cdeCountRows[0]?.count || 0) === 0) {
        await seedCdeTable(pool);
      }

      global.__nisseiMysqlInitialized = true;
    } catch (err) {
      global.__nisseiMysqlInitPromise = undefined;
      throw err;
    }
  })();

  return global.__nisseiMysqlInitPromise;
}

export async function seedCdeTable(pool: mysql.Pool): Promise<void> {
  if (INITIAL_RECEPCION_CDE_DATA.length === 0) return;
  const CHUNK_SIZE = 250;
  for (let i = 0; i < INITIAL_RECEPCION_CDE_DATA.length; i += CHUNK_SIZE) {
    const chunk = INITIAL_RECEPCION_CDE_DATA.slice(i, i + CHUNK_SIZE);
    const values = chunk.map((t) => [
      t.idOrden,
      t.codigoProducto || "",
      t.cliente,
      t.mensaje || "",
      t.fechaIngreso || "",
      t.fechaEntregada || null,
      t.fechaVenta || null,
      t.estado,
      t.tipoComponente || "GENERAL",
      t.modelo || "",
      t.marca || "",
      t.serial || "S/N",
      t.diasResolucion ?? calcularDiasResolucion(t.fechaIngreso, t.fechaEntregada),
      (t.esDanesa ?? isTicketDanesa(t.cliente)) ? 1 : 0,
      t.recibidoEnDeposito ? 1 : 0,
    ]);
    await pool.query(
      `INSERT IGNORE INTO recepcion_cde_tickets
       (id_orden, codigo_producto, cliente, mensaje, fecha_ingreso, fecha_entregada, fecha_venta,
        estado, tipo_componente, modelo, marca, serial, dias_resolucion, es_danesa, recibido_en_deposito)
       VALUES ?`,
      [values]
    );
  }
}

export async function seedRecepcionTable(pool: mysql.Pool): Promise<void> {
  const CHUNK_SIZE = 300;
  for (let i = 0; i < INITIAL_RECEPCION_DATA.length; i += CHUNK_SIZE) {
    const chunk = INITIAL_RECEPCION_DATA.slice(i, i + CHUNK_SIZE);
    const values = chunk.map((t) => [
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
      t.serial || "S/N",
    ]);
    await pool.query(
      `INSERT IGNORE INTO recepcion_tickets
       (id_orden, codigo_producto, cliente, mensaje, fecha_ingreso, fecha_entregada, fecha_venta, estado, tipo_componente, marca, modelo, serial)
       VALUES ?`,
      [values]
    );
  }
}

export async function seedReparacionesTable(pool: mysql.Pool): Promise<void> {
  const ticketsTaller = INITIAL_RECEPCION_DATA.filter(
    (t) =>
      t.estado.toLowerCase().includes("reparación") ||
      t.estado.toLowerCase().includes("asignad") ||
      t.estado.toLowerCase().includes("asignacion") ||
      t.estado.toLowerCase().includes("repuesto") ||
      t.estado.toUpperCase() === "QC" ||
      t.estado.toLowerCase().includes("reparada")
  );

  const ordenes: OrdenReparacion[] = ticketsTaller.map((t) => {
    const estadoRaw = t.estado.toLowerCase();
    let estado: "SIN_ASIGNAR" | "EN_REPARACION" | "FINALIZADA" = "SIN_ASIGNAR";
    let tecnicoAsignado: string | undefined = undefined;
    let asignadoPor: string | undefined = undefined;
    let fechaAsignacion: string | undefined = undefined;
    let fechaFinalizacion: string | undefined = undefined;
    let dictamenFinal: "REPARADO" | "SIN_DEFECTO" | "NO_REPARADO" | undefined = undefined;
    let repuestosUtilizados: string | undefined = undefined;

    const numId = parseInt((t.idOrden || "0").replace(/\D/g, ""), 10) || 0;
    const asignadoPrevio = LISTA_TECNICOS[numId % LISTA_TECNICOS.length].nombre;
    const { detalleReparacion, observaciones } = clasificarMensajeCSV(t.mensaje, t.estado);

    if (estadoRaw.includes("reparada") || estadoRaw === "qc") {
      estado = "FINALIZADA";
      tecnicoAsignado = asignadoPrevio;
      asignadoPor = "Admin";
      fechaAsignacion = t.fechaIngreso || "19/06/2026";
      fechaFinalizacion = t.fechaEntregada || t.fechaIngreso || "20/06/2026";

      const msgUpper = (t.mensaje || "").toUpperCase();
      if (msgUpper.includes("SIN DEFECTO") || msgUpper.includes("NO PRESENTA FALLA")) {
        dictamenFinal = "SIN_DEFECTO";
      } else if (
        msgUpper.includes("SIN REPARO") ||
        msgUpper.includes("NC") ||
        msgUpper.includes("CAMBIO POR NUEVO") ||
        msgUpper.includes("RECHAZA") ||
        (!detalleReparacion && observaciones)
      ) {
        dictamenFinal = "NO_REPARADO";
      } else {
        dictamenFinal = "REPARADO";
      }

      if (detalleReparacion) {
        if (msgUpper.includes("BATERIA")) repuestosUtilizados = "Reemplazo de batería original";
        else if (msgUpper.includes("PLACA")) repuestosUtilizados = "Sustitución / Reparación de placa de circuito";
        else if (msgUpper.includes("DISPLAY") || msgUpper.includes("PANTALLA"))
          repuestosUtilizados = "Reemplazo de módulo de pantalla";
      }
    }

    return {
      idOrden: t.idOrden,
      codigoProducto: t.codigoProducto,
      cliente: t.cliente,
      equipo: `${t.marca} ${t.modelo}`.trim(),
      marca: t.marca,
      modelo: t.modelo,
      tipoComponente: t.tipoComponente || "GENERAL",
      serial: t.serial || "S/N",
      mensajeSATI: t.mensaje || "",
      fallaReportada: "",
      detalleReparacion,
      observaciones,
      fechaIngreso: t.fechaIngreso || "19/06/2026",
      fechaAsignacion,
      fechaFinalizacion,
      estado,
      tecnicoAsignado,
      asignadoPor,
      dictamenFinal,
      repuestosUtilizados,
    };
  });

  const CHUNK_SIZE = 200;
  for (let i = 0; i < ordenes.length; i += CHUNK_SIZE) {
    const chunk = ordenes.slice(i, i + CHUNK_SIZE);
    const values = chunk.map((o) => [
      o.idOrden,
      o.codigoProducto || "",
      o.cliente,
      o.equipo,
      o.marca,
      o.modelo,
      o.tipoComponente,
      o.serial,
      o.fallaReportada || "",
      o.detalleReparacion || "",
      o.observaciones || "",
      o.mensajeSATI || "",
      o.fechaIngreso,
      o.fechaAsignacion || null,
      o.fechaFinalizacion || null,
      o.estado,
      o.tecnicoAsignado || null,
      o.asignadoPor || null,
      o.dictamenFinal || null,
      o.repuestosUtilizados || null,
    ]);
    await pool.query(
      `INSERT IGNORE INTO taller_reparaciones
       (id_orden, codigo_producto, cliente, equipo, marca, modelo, tipo_componente, serial,
        falla_reportada, detalle_reparacion, observaciones, mensaje_sati, fecha_ingreso,
        fecha_asignacion, fecha_finalizacion, estado, tecnico_asignado, asignado_por,
        dictamen_final, repuestos_utilizados)
       VALUES ?`,
      [values]
    );
  }
}

export async function seedMontajesTable(pool: mysql.Pool): Promise<void> {
  if (INITIAL_MONTAJES_REALES.length === 0) return;
  const values = INITIAL_MONTAJES_REALES.map((m) => [
    m.id,
    m.nro_reg,
    m.cliente,
    m.fecha_facturacion,
    m.fecha_montaje,
    m.vendedor,
    m.canal,
    m.estado,
    m.tipo_servicio,
    m.cantidadEquipos || 1,
    m.tecnico,
    m.etapa,
    m.progreso,
    m.prioridad,
    m.consumoEstimado || "450W",
    m.observaciones || "",
    JSON.stringify(m.componentes || []),
  ]);

  await pool.query(
    `INSERT IGNORE INTO ordenes_montaje
     (id, nro_reg, cliente, fecha_facturacion, fecha_montaje, vendedor, canal, estado,
      tipo_servicio, cantidad_equipos, tecnico, etapa, progreso, prioridad,
      consumo_estimado, observaciones, componentes_json)
     VALUES ?`,
    [values]
  );
}

// ============================================================================
// LECTURAS DESDE MYSQL
// ============================================================================

export async function dbGetReparaciones(): Promise<OrdenReparacion[]> {
  await ensureDatabaseInitialized();
  const pool = getPool();
  const [rows] = await pool.query<mysql.RowDataPacket[]>(
    "SELECT * FROM taller_reparaciones ORDER BY CAST(id_orden AS UNSIGNED) ASC"
  );
  return rows.map((r) => ({
    idOrden: r.id_orden,
    codigoProducto: r.codigo_producto || "",
    cliente: r.cliente,
    equipo: r.equipo,
    marca: r.marca,
    modelo: r.modelo,
    tipoComponente: r.tipo_componente,
    serial: r.serial,
    fallaReportada: r.falla_reportada || "",
    detalleReparacion: r.detalle_reparacion || "",
    observaciones: r.observaciones || "",
    mensajeSATI: r.mensaje_sati || "",
    fechaIngreso: r.fecha_ingreso,
    fechaAsignacion: r.fecha_asignacion || undefined,
    fechaFinalizacion: r.fecha_finalizacion || undefined,
    estado: r.estado,
    tecnicoAsignado: r.tecnico_asignado || undefined,
    asignadoPor: r.asignado_por || undefined,
    dictamenFinal: r.dictamen_final || undefined,
    repuestosUtilizados: r.repuestos_utilizados || undefined,
  }));
}

export async function dbGetRecepcionTickets(): Promise<RecepcionTicket[]> {
  await ensureDatabaseInitialized();
  const pool = getPool();
  const [rows] = await pool.query<mysql.RowDataPacket[]>(
    "SELECT * FROM recepcion_tickets ORDER BY CAST(id_orden AS UNSIGNED) DESC"
  );
  return rows.map((r) => ({
    idOrden: r.id_orden,
    codigoProducto: r.codigo_producto || "",
    cliente: r.cliente,
    mensaje: r.mensaje || "",
    fechaIngreso: r.fecha_ingreso,
    fechaEntregada: r.fecha_entregada || undefined,
    fechaVenta: r.fecha_venta || undefined,
    estado: r.estado,
    tipoComponente: r.tipo_componente,
    marca: r.marca,
    modelo: r.modelo,
    serial: r.serial,
    accesorios:
      r.accesorios ||
      (String(r.mensaje || "").includes("Accesorios:")
        ? String(r.mensaje).split(/Accesorios:/i)[1]?.trim()
        : undefined),
    esNuevoIngreso:
      r.origen === "NUEVO_INGRESO" ||
      String(r.mensaje || "").includes("Accesorios:"),
    esEstadoCambiadoReciente:
      r.origen === "ESTADO_CAMBIADO" ||
      r.origen === "RECIEN_ENTREGADO",
    esEntregadoReciente:
      r.origen === "RECIEN_ENTREGADO" ||
      (r.origen === "NUEVO_INGRESO" &&
        String(r.estado || "").toLowerCase() === "entregada"),
    recibidoEnDeposito: Boolean(r.recibido_en_deposito),
    fechaRecibidoDeposito: r.fecha_recibido_deposito || undefined,
  }));
}

export async function dbGetMontajes(): Promise<OrdenMontajeReal[]> {
  await ensureDatabaseInitialized();
  const pool = getPool();
  const [rows] = await pool.query<mysql.RowDataPacket[]>(
    "SELECT * FROM ordenes_montaje ORDER BY updated_at DESC"
  );
  return rows.map((r) => {
    let componentes = [];
    try {
      componentes = JSON.parse(r.componentes_json || "[]");
    } catch {
      componentes = [];
    }
    return {
      id: r.id,
      nro_reg: r.nro_reg,
      cliente: r.cliente,
      fecha_facturacion: r.fecha_facturacion,
      fecha_montaje: r.fecha_montaje,
      vendedor: r.vendedor,
      canal: r.canal,
      estado: r.estado,
      tipo_servicio: r.tipo_servicio,
      cantidadEquipos: Number(r.cantidad_equipos || 1),
      tecnico: r.tecnico,
      etapa: r.etapa,
      progreso: Number(r.progreso || 0),
      prioridad: r.prioridad,
      consumoEstimado: r.consumo_estimado || "450W",
      observaciones: r.observaciones || "",
      componentes,
    };
  });
}

export async function dbGetUsuarios(): Promise<UserProfile[]> {
  await ensureDatabaseInitialized();
  const pool = getPool();
  const [rows] = await pool.query<mysql.RowDataPacket[]>(
    "SELECT id, nombre, role, default_route, avatar, badge, descripcion FROM usuarios"
  );
  return rows.map((r) => ({
    id: r.id,
    nombre: r.nombre,
    role: r.role,
    password: "•••••••• (SHA-256)",
    passwordHash: "PROTECTED",
    defaultRoute: r.default_route,
    avatar: r.avatar,
    badge: r.badge,
    descripcion: r.descripcion || "",
  }));
}

export async function dbGetCdeTickets(): Promise<RecepcionCdeTicket[]> {
  await ensureDatabaseInitialized();
  const pool = getPool();
  const [rows] = await pool.query<mysql.RowDataPacket[]>(
    "SELECT * FROM recepcion_cde_tickets WHERE CAST(id_orden AS UNSIGNED) >= 100000 ORDER BY CAST(id_orden AS UNSIGNED) DESC"
  );
  return rows.map((r) => ({
    idOrden: r.id_orden,
    codigoProducto: r.codigo_producto || "",
    cliente: r.cliente,
    mensaje: r.mensaje || "",
    fechaIngreso: r.fecha_ingreso,
    fechaEntregada: r.fecha_entregada || undefined,
    fechaVenta: r.fecha_venta || undefined,
    estado: r.estado,
    tipoComponente: r.tipo_componente,
    modelo: r.modelo,
    marca: r.marca,
    serial: r.serial,
    diasResolucion: r.dias_resolucion,
    esDanesa: Boolean(r.es_danesa),
    recibidoEnDeposito: Boolean(r.recibido_en_deposito),
    fechaRecibidoDeposito: r.fecha_recibido_deposito || undefined,
  }));
}

export async function getMysqlStats() {
  await ensureDatabaseInitialized();
  const pool = getPool();
  const [rec] = await pool.query<mysql.RowDataPacket[]>("SELECT COUNT(*) as count FROM recepcion_tickets");
  const [rep] = await pool.query<mysql.RowDataPacket[]>("SELECT COUNT(*) as count FROM taller_reparaciones");
  const [mnt] = await pool.query<mysql.RowDataPacket[]>("SELECT COUNT(*) as count FROM ordenes_montaje");
  const [cde] = await pool.query<mysql.RowDataPacket[]>("SELECT COUNT(*) as count FROM recepcion_cde_tickets");
  const [usr] = await pool.query<mysql.RowDataPacket[]>("SELECT COUNT(*) as count FROM usuarios");
  return {
    recepcion: rec[0]?.count || 0,
    reparaciones: rep[0]?.count || 0,
    montajes: mnt[0]?.count || 0,
    cde: cde[0]?.count || 0,
    usuarios: usr[0]?.count || 0,
  };
}
