import mysql from "mysql2/promise";
import { INITIAL_RECEPCION_DATA, RecepcionTicket } from "@/data/recepcionData";
import {
  CATALOGO_HARDWARE_REAL,
  INITIAL_MONTAJES_REALES,
  OrdenMontajeReal,
  SkuCatalogItem,
  isRealSku,
  mergeSkuCatalogItems,
  normalizeCategoriaSku,
} from "@/data/montajesData";
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

function cleanEnvValue(value?: string): string {
  if (!value) return "";
  return value.trim().replace(/^['"]|['"]$/g, "");
}

function firstNonEmptyEnv(keys: string[]): { key: string; value: string } | null {
  for (const key of keys) {
    const val = cleanEnvValue(process.env[key]);
    if (val) return { key, value: val };
  }
  return null;
}

export function resolveMysqlConfig(): MysqlConfig {
  const isRailway = Boolean(
    process.env.RAILWAY_ENVIRONMENT ||
    process.env.RAILWAY_SERVICE_NAME ||
    process.env.RAILWAY_PROJECT_ID
  );

  const envPassword =
    firstNonEmptyEnv([
      "MYSQL_PASSWORD",
      "MYSQLPASSWORD",
      "MYSQL_ROOT_PASSWORD",
      "MYSQLROOTPASSWORD",
      "MYSQL_PASS",
      "MYSQL_PWD",
      "DB_PASSWORD",
      "DB_PASS",
    ])?.value || "";

  const urlMatch = firstNonEmptyEnv([
    "MYSQL_PRIVATE_URL",
    "MYSQL_URL",
    "DATABASE_URL",
    "MYSQL_PUBLIC_URL",
    "RAILWAY_MYSQL_URL",
    "DB_URL",
  ]);

  if (urlMatch) {
    try {
      const parsed = new URL(urlMatch.value);
      const parsedDb = parsed.pathname.replace(/^\//, "");
      const parsedPassword = parsed.password ? decodeURIComponent(parsed.password) : "";
      return {
        host: parsed.hostname || (isRailway ? "mysql.railway.internal" : "localhost"),
        port: Number(parsed.port || 3306),
        user: decodeURIComponent(parsed.username || "root"),
        password: parsedPassword || envPassword,
        database: parsedDb || (isRailway ? "railway" : "nissei_portal"),
        source: `URL:${urlMatch.key}`,
        isRailway,
      };
    } catch {
      // Fallback a variables individuales si la URL no es válida
    }
  }

  const defaultHost = isRailway ? "mysql.railway.internal" : "localhost";
  const defaultDatabase = isRailway ? "railway" : "nissei_portal";

  const host =
    firstNonEmptyEnv(["MYSQL_HOST", "MYSQLHOST", "MYSQL_PRIVATE_HOST", "DB_HOST"])?.value ||
    defaultHost;
  const port = Number(
    firstNonEmptyEnv(["MYSQL_PORT", "MYSQLPORT", "DB_PORT"])?.value || 3306
  );
  const user =
    firstNonEmptyEnv(["MYSQL_USER", "MYSQLUSER", "DB_USER"])?.value || "root";
  const database =
    firstNonEmptyEnv([
      "MYSQL_DATABASE",
      "MYSQLDATABASE",
      "MYSQL_DB",
      "DB_DATABASE",
      "DB_NAME",
    ])?.value || defaultDatabase;

  return {
    host,
    port,
    user,
    password: envPassword,
    database,
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
    hasPassword: Boolean(config.password),
  };
}

export function formatMysqlError(err: unknown): string {
  const info = getMysqlInfo();
  const code =
    err && typeof err === "object" && "code" in err
      ? String((err as { code?: unknown }).code || "")
      : "";
  const rawMessage = err instanceof Error ? err.message : String(err || "Error desconocido de MySQL");

  const isAccessDenied =
    code === "ER_ACCESS_DENIED_ERROR" ||
    rawMessage.toLowerCase().includes("access denied");

  if (isAccessDenied && !info.hasPassword && info.isRailway) {
    return (
      `MySQL en Railway rechazó la conexión (using password: NO). ` +
      `En Railway -> servicio nissei-portal-operativo -> Variables, agregue Reference Variable desde MySQL ` +
      `(MYSQL_URL o MYSQLPASSWORD / MYSQL_ROOT_PASSWORD) y vuelva a desplegar.`
    );
  }

  if (isAccessDenied) {
    return `Acceso denegado a MySQL (${info.user}@${info.host}:${info.port}). Verifique las credenciales de MySQL en las variables de entorno.`;
  }

  if (code === "ECONNREFUSED" || code === "ENOTFOUND" || code === "ETIMEDOUT") {
    return `No se pudo conectar a MySQL (${info.host}:${info.port}): ${rawMessage}`;
  }

  return rawMessage;
}

declare global {
  // eslint-disable-next-line no-var
  var __nisseiMysqlPool: mysql.Pool | undefined;
  // eslint-disable-next-line no-var
  var __nisseiMysqlPoolKey: string | undefined;
  // eslint-disable-next-line no-var
  var __nisseiMysqlInitialized: boolean | undefined;
  // eslint-disable-next-line no-var
  var __nisseiMysqlInitPromise: Promise<void> | undefined;
}

export function getPool(): mysql.Pool {
  const config = resolveMysqlConfig();
  const poolKey = `${config.host}:${config.port}:${config.user}:${config.database}:${config.password ? "1" : "0"}`;
  if (!global.__nisseiMysqlPool || global.__nisseiMysqlPoolKey !== poolKey) {
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
    global.__nisseiMysqlPoolKey = poolKey;
    global.__nisseiMysqlInitialized = false;
    global.__nisseiMysqlInitPromise = undefined;
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

      // Tabla de cruces manuales de órdenes SATI (ASU ↔ CDE) confirmados por el usuario
      await pool.query(`
        CREATE TABLE IF NOT EXISTS sati_cross_matches (
          id_orden_asu VARCHAR(50) NOT NULL,
          id_orden_cde VARCHAR(50) NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (id_orden_asu, id_orden_cde),
          INDEX idx_cde (id_orden_cde),
          INDEX idx_asu (id_orden_asu)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);

      // Tabla de confirmaciones de recepción física en depósito (Checkins legítimos de operarios)
      await pool.query(`
        CREATE TABLE IF NOT EXISTS sati_checkins (
          id_orden VARCHAR(50) PRIMARY KEY,
          id_orden_asu VARCHAR(50),
          id_orden_cde VARCHAR(50),
          recibido TINYINT(1) DEFAULT 1,
          fecha_recibido VARCHAR(50) NOT NULL,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_chk_asu (id_orden_asu),
          INDEX idx_chk_cde (id_orden_cde)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);

      // Catálogo maestro dinámico de SKUs de hardware (aprendido de órdenes, ingresos manuales y CSV)
      await pool.query(`
        CREATE TABLE IF NOT EXISTS catalogo_sku (
          sku VARCHAR(80) PRIMARY KEY,
          descripcion VARCHAR(350) NOT NULL,
          categoria VARCHAR(50) NOT NULL DEFAULT 'OTROS',
          fuente VARCHAR(30) NOT NULL DEFAULT 'OFICIAL',
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_sku_categoria (categoria)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);

      // Limpieza preventiva: recepcion_cde_tickets solo debe contener órdenes reales de CDE (>= 100000)
      await pool.query(
        "DELETE FROM recepcion_cde_tickets WHERE CAST(id_orden AS UNSIGNED) < 100000"
      ).catch(() => {});

      // Sincronizar estado de recibido: solo las confirmadas en sati_checkins son recibidas;
      // las órdenes con despacho por transportadora permanecen en camino hasta confirmarse físicamente.
      await pool.query(`
        UPDATE recepcion_cde_tickets
        SET recibido_en_deposito = 0, fecha_recibido_deposito = NULL
        WHERE id_orden NOT IN (SELECT id_orden FROM sati_checkins WHERE recibido = 1)
          AND id_orden NOT IN (SELECT id_orden_cde FROM sati_checkins WHERE recibido = 1 AND id_orden_cde IS NOT NULL)
      `).catch(() => {});

      await pool.query(`
        UPDATE recepcion_tickets
        SET recibido_en_deposito = 0, fecha_recibido_deposito = NULL
        WHERE id_orden NOT IN (SELECT id_orden FROM sati_checkins WHERE recibido = 1)
          AND id_orden NOT IN (SELECT id_orden_asu FROM sati_checkins WHERE recibido = 1 AND id_orden_asu IS NOT NULL)
      `).catch(() => {});

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

      // 8. Seed inicial del Catálogo de SKUs (oficial + SKUs históricos de ordenes_montaje) si está vacío
      const [skuCountRows] = await pool.query<mysql.RowDataPacket[]>(
        "SELECT COUNT(*) as count FROM catalogo_sku"
      );
      if ((skuCountRows[0]?.count || 0) === 0) {
        await seedCatalogoSkuTable(pool);
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

/**
 * Inserta o actualiza SKUs de hardware reales en `catalogo_sku`.
 */
export async function upsertSkusToMySQL(
  pool: mysql.Pool,
  items: { sku: string; descripcion: string; categoria?: string; fuente?: string }[],
  options?: { overwrite?: boolean }
): Promise<number> {
  const dedup = new Map<string, [string, string, string, string]>();

  for (const raw of items || []) {
    const sku = String(raw?.sku || "").trim().slice(0, 80);
    const descripcion = String(raw?.descripcion || "").trim().slice(0, 350);
    if (!isRealSku(sku) || !descripcion) continue;
    const categoria = normalizeCategoriaSku(raw?.categoria, descripcion);
    const fuente = String(raw?.fuente || "MANUAL").trim().slice(0, 30);
    dedup.set(sku.toLowerCase(), [sku, descripcion, categoria, fuente]);
  }

  const values = Array.from(dedup.values());
  if (values.length === 0) return 0;

  const CHUNK_SIZE = 200;
  const sql = options?.overwrite
    ? `INSERT INTO catalogo_sku (sku, descripcion, categoria, fuente)
       VALUES ?
       ON DUPLICATE KEY UPDATE
         descripcion = VALUES(descripcion),
         categoria = IF(VALUES(categoria) <> 'OTROS', VALUES(categoria), categoria),
         fuente = VALUES(fuente)`
    : `INSERT INTO catalogo_sku (sku, descripcion, categoria, fuente)
       VALUES ?
       ON DUPLICATE KEY UPDATE
         descripcion = IF(LENGTH(descripcion) = 0, VALUES(descripcion), descripcion),
         categoria = IF(categoria = 'OTROS' AND VALUES(categoria) <> 'OTROS', VALUES(categoria), categoria)`;

  for (let i = 0; i < values.length; i += CHUNK_SIZE) {
    const chunk = values.slice(i, i + CHUNK_SIZE);
    await pool.query(sql, [chunk]);
  }

  return values.length;
}

export async function seedCatalogoSkuTable(pool: mysql.Pool): Promise<void> {
  const officialItems: SkuCatalogItem[] = CATALOGO_HARDWARE_REAL.map((c) => ({
    sku: c.sku,
    descripcion: c.descripcion,
    categoria: c.categoria,
    fuente: "OFICIAL",
  }));

  const fromSavedOrders: SkuCatalogItem[] = [];
  try {
    const [orderRows] = await pool.query<mysql.RowDataPacket[]>(
      "SELECT tipo_servicio, componentes_json FROM ordenes_montaje"
    );
    for (const r of orderRows) {
      let comps: { sku?: string; descripcion?: string; categoria?: string }[] = [];
      try {
        comps = JSON.parse(r.componentes_json || "[]");
      } catch {
        comps = [];
      }
      if (!Array.isArray(comps)) continue;
      for (const c of comps) {
        const sku = String(c?.sku || "").trim();
        const desc = String(c?.descripcion || "").trim();
        if (!isRealSku(sku) || !desc) continue;
        fromSavedOrders.push({
          sku,
          descripcion: desc,
          categoria: normalizeCategoriaSku(
            c.categoria,
            desc,
            r.tipo_servicio === "Expansion" ? "Expansion" : "Montaje"
          ),
          fuente: "ORDEN",
        });
      }
    }
  } catch {
    // Si aún no existen órdenes guardadas, continuar con el catálogo oficial
  }

  const combined = mergeSkuCatalogItems(fromSavedOrders, officialItems);
  await upsertSkusToMySQL(pool, combined, { overwrite: false });
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

export async function dbGetCatalogoSku(): Promise<SkuCatalogItem[]> {
  await ensureDatabaseInitialized();
  const pool = getPool();
  const [rows] = await pool.query<mysql.RowDataPacket[]>(
    "SELECT sku, descripcion, categoria, fuente, updated_at FROM catalogo_sku ORDER BY updated_at DESC, sku ASC"
  );

  const dbItems: SkuCatalogItem[] = rows.map((r) => ({
    sku: String(r.sku || "").trim(),
    descripcion: String(r.descripcion || "").trim(),
    categoria: normalizeCategoriaSku(String(r.categoria || ""), String(r.descripcion || "")),
    fuente: (r.fuente as SkuCatalogItem["fuente"]) || "OFICIAL",
    updated_at: r.updated_at ? new Date(r.updated_at).toISOString() : undefined,
  }));

  const officialItems: SkuCatalogItem[] = CATALOGO_HARDWARE_REAL.map((c) => ({
    sku: c.sku,
    descripcion: c.descripcion,
    categoria: c.categoria,
    fuente: "OFICIAL",
  }));

  return mergeSkuCatalogItems(officialItems, dbItems);
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

export interface SatiCrossMatchRecord {
  idOrdenAsu: string;
  idOrdenCde: string;
}

export async function dbGetSatiCrossMatches(): Promise<SatiCrossMatchRecord[]> {
  await ensureDatabaseInitialized();
  const pool = getPool();
  const [rows] = await pool.query<mysql.RowDataPacket[]>(
    "SELECT id_orden_asu, id_orden_cde FROM sati_cross_matches"
  );
  return rows.map((r) => ({
    idOrdenAsu: String(r.id_orden_asu),
    idOrdenCde: String(r.id_orden_cde),
  }));
}

export async function dbSaveSatiCrossMatch(idOrdenAsu: string, idOrdenCde: string): Promise<void> {
  await ensureDatabaseInitialized();
  const pool = getPool();
  await pool.query(
    `INSERT INTO sati_cross_matches (id_orden_asu, id_orden_cde)
     VALUES (?, ?)
     ON DUPLICATE KEY UPDATE created_at = CURRENT_TIMESTAMP`,
    [idOrdenAsu.trim(), idOrdenCde.trim()]
  );
}

export async function dbDeleteSatiCrossMatch(idOrdenAsu: string, idOrdenCde: string): Promise<void> {
  await ensureDatabaseInitialized();
  const pool = getPool();
  await pool.query(
    "DELETE FROM sati_cross_matches WHERE id_orden_asu = ? AND id_orden_cde = ?",
    [idOrdenAsu.trim(), idOrdenCde.trim()]
  );
}

export async function dbGetSatiCheckins(): Promise<Record<string, { recibido: boolean; fecha: string }>> {
  await ensureDatabaseInitialized();
  const pool = getPool();
  const [rows] = await pool.query<mysql.RowDataPacket[]>(
    "SELECT id_orden, id_orden_asu, id_orden_cde, recibido, fecha_recibido FROM sati_checkins"
  );
  const result: Record<string, { recibido: boolean; fecha: string }> = {};
  for (const r of rows) {
    const val = { recibido: Boolean(r.recibido), fecha: r.fecha_recibido || "" };
    if (r.id_orden) result[r.id_orden] = val;
    if (r.id_orden_asu) result[r.id_orden_asu] = val;
    if (r.id_orden_cde) result[r.id_orden_cde] = val;
  }
  return result;
}

export async function dbSaveSatiCheckin(
  idOrden: string,
  recibido: boolean,
  fecha: string,
  idOrdenAsu?: string,
  idOrdenCde?: string
): Promise<void> {
  await ensureDatabaseInitialized();
  const pool = getPool();
  await pool.query(
    `INSERT INTO sati_checkins (id_orden, id_orden_asu, id_orden_cde, recibido, fecha_recibido)
     VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       recibido = VALUES(recibido),
       fecha_recibido = VALUES(fecha_recibido)`,
    [idOrden.trim(), idOrdenAsu ? idOrdenAsu.trim() : null, idOrdenCde ? idOrdenCde.trim() : null, recibido ? 1 : 0, fecha]
  );
}

