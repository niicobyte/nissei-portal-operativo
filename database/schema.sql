-- ============================================================================
-- ESQUEMA OFICIAL MYSQL - PORTAL OPERATIVO NISSEI S.A. (CDE)
-- Base de datos: nissei_portal
-- ============================================================================

CREATE DATABASE IF NOT EXISTS nissei_portal
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE nissei_portal;

-- 1. Tabla de Usuarios y Perfiles de Acceso
CREATE TABLE IF NOT EXISTS usuarios (
  id VARCHAR(50) PRIMARY KEY,
  nombre VARCHAR(120) NOT NULL,
  role ENUM('ADMIN', 'TECNICO', 'RECEPCION', 'MONTAJES') NOT NULL,
  password VARCHAR(120) NOT NULL,
  default_route VARCHAR(100) NOT NULL,
  avatar VARCHAR(10) NOT NULL,
  badge VARCHAR(100) NOT NULL,
  descripcion TEXT,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Tabla de Recepción Post-Venta & Retornos SATI
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
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_recepcion_estado (estado),
  INDEX idx_recepcion_cliente (cliente)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Tabla de Taller de Reparaciones (con separación de Fallas a Asignar, Detalle de Reparación y Observaciones)
CREATE TABLE IF NOT EXISTS taller_reparaciones (
  id_orden VARCHAR(50) PRIMARY KEY,
  codigo_producto VARCHAR(80) DEFAULT '',
  cliente VARCHAR(200) NOT NULL,
  equipo VARCHAR(255) NOT NULL,
  marca VARCHAR(100) NOT NULL,
  modelo VARCHAR(200) NOT NULL,
  tipo_componente VARCHAR(100) NOT NULL,
  serial VARCHAR(150) NOT NULL,
  falla_reportada TEXT,          -- Columna: Fallas a Asignar (detallada por Admin al asignar técnico)
  detalle_reparacion TEXT,       -- Columna: Detalle de la Reparación (solo equipos efectivamente reparados)
  observaciones TEXT,            -- Columna: Observaciones (NC, cambio por nuevo, sin reparo, rechazo, etc.)
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

-- 4. Tabla de Órdenes de Montaje & Ensamble de PCs
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
