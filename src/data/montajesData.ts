// Base de datos oficial de Órdenes de Montaje & Ensambles de PC NISSEI CDE
// Construida a partir de la tabla real de servicios y componentes de taller

export interface ComponenteMontaje {
  sku: string;
  upc?: string;
  descripcion: string;
  seriales: string;
  categoria:
    | "PROCESADOR"
    | "PLACA_MADRE"
    | "RAM"
    | "GPU"
    | "ALMACENAMIENTO"
    | "FUENTE"
    | "GABINETE"
    | "REFRIGERACION"
    | "NOTEBOOK"
    | "OTROS";
}

export interface OrdenMontajeReal {
  id: string; // Ej: "MNT-966565"
  nro_reg: string; // Nro. Registro / Interno
  cliente: string;
  fecha_facturacion: string;
  fecha_montaje: string;
  vendedor: string;
  canal: "Tienda" | "Ecommerce - Web" | "Empresas / Coorporativo";
  estado: "Entregado" | "Rev. Cerrado" | "En Proceso" | "Pendiente";
  tipo_servicio: "Montaje" | "Expansion";
  cantidadEquipos: number; // 1 o 2 PCs completas para el cliente (ej. Prychen Wei 2, J.W.F. 2, Opalo 2)
  tecnico: string;
  etapa: "PENDIENTE_PIEZAS" | "ARMADO_MECANICO" | "ESTRES_TERMICO" | "LISTO_ENTREGA";
  progreso: number;
  prioridad: "NORMAL" | "EXPRESS" | "URGENTE";
  consumoEstimado?: string;
  observaciones: string;
  componentes: ComponenteMontaje[];
}

import {
  LISTA_VENDEDORES_REALES,
  VENDEDORES_CORP_BASE,
  VENDEDORES_TIENDA_BASE,
  VENDEDORES_STORAGE_KEY,
  VENDEDORES_CON_AREA_STORAGE_KEY,
  getStoredVendedoresConArea,
  addCustomVendedorConArea,
  getStoredVendedores,
  addCustomVendedor,
} from "@/data/vendedoresData";
import type { AreaVendedor, VendedorItem } from "@/data/vendedoresData";

export {
  LISTA_VENDEDORES_REALES,
  VENDEDORES_CORP_BASE,
  VENDEDORES_TIENDA_BASE,
  VENDEDORES_STORAGE_KEY,
  VENDEDORES_CON_AREA_STORAGE_KEY,
  getStoredVendedoresConArea,
  addCustomVendedorConArea,
  getStoredVendedores,
  addCustomVendedor,
};
export type { AreaVendedor, VendedorItem };

// Técnicos responsables oficiales (solo nombres sin bancos)
export const LISTA_TECNICOS_MONTAJE = [
  "Nicolas Solis",
  "Magaly Yegros",
  "Juan Ronnebeck"
];

export const TECNICOS_STORAGE_KEY = "nissei_tecnicos_montajes_v1";

export function getStoredTecnicos(): string[] {
  if (typeof window === "undefined") return [...LISTA_TECNICOS_MONTAJE];
  try {
    const raw = localStorage.getItem(TECNICOS_STORAGE_KEY);
    if (!raw) return [...LISTA_TECNICOS_MONTAJE];
    const list = JSON.parse(raw);
    if (Array.isArray(list) && list.length > 0) {
      const merged = Array.from(
        new Set([...LISTA_TECNICOS_MONTAJE, ...list.map((t) => String(t).trim()).filter(Boolean)])
      );
      return merged;
    }
  } catch (e) {
    console.warn("Error leyendo técnicos de localStorage:", e);
  }
  return [...LISTA_TECNICOS_MONTAJE];
}

export function addCustomTecnico(nuevoTecnico: string): string[] {
  const clean = nuevoTecnico.trim();
  if (!clean || clean.toUpperCase() === "OTRO") return getStoredTecnicos();
  const current = getStoredTecnicos();
  const exists = current.some((t) => t.toLowerCase() === clean.toLowerCase());
  if (!exists) {
    const updated = [...current, clean];
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(TECNICOS_STORAGE_KEY, JSON.stringify(updated));
      } catch (e) {
        console.warn("Error guardando nuevo técnico:", e);
      }
    }
    return updated;
  }
  return current;
}

// Catálogo específico para MONTAJE DE PC COMPLETA (CPU, Placa Madre, RAM Desktop, GPU, Fuente, Gabinete, Cooler, SSD)
export const CATALOGO_MONTAJE_PC: ComponenteMontaje[] = [
  // Procesadores Desktop
  { sku: "774198", descripcion: "CPU INTEL I5-12400 2.5GHZ LGA1700 18MB C/COOLER", seriales: "U5SY357100789", categoria: "PROCESADOR" },
  { sku: "102643", descripcion: "CPU AMD AM5 RYZEN R7-7700X 4.5GHZ/40MB S/COOLER", seriales: "9MQ0713Q50166", categoria: "PROCESADOR" },
  { sku: "119157", descripcion: "CPU INTEL I9-14900 2.0GHZ LGA1700 36MB", seriales: "U5DN443202000", categoria: "PROCESADOR" },
  { sku: "120078", descripcion: "CPU AMD AM4 RYZEN R5-5600GT 3.6GHZ/19MB", seriales: "9MW2689X50472", categoria: "PROCESADOR" },
  { sku: "119664", descripcion: "CPU INTEL I5-14400F 2.5GHZ/20MB LGA1700", seriales: "U69Y8D0603958", categoria: "PROCESADOR" },
  { sku: "867488", descripcion: "CPU AMD AM4 RYZEN R7-5700G RADEON GRAPHICS 3.8GHZ 20MB", seriales: "9MU1877W50384", categoria: "PROCESADOR" },
  { sku: "127768", descripcion: "CPU AMD AM5 RYZEN R5-9600X 3.9GHZ/38MB S/COOLER", seriales: "9MU7668W50433", categoria: "PROCESADOR" },
  { sku: "120080", descripcion: "CPU AMD AM5 RYZEN R5-8500G 3.5GHZ/22MB", seriales: "9ACA507X30120", categoria: "PROCESADOR" },
  { sku: "116808", descripcion: "CPU INTEL I7-14700KF 2.6GHZ LGA1700 33MB", seriales: "U5J5D93100802", categoria: "PROCESADOR" },
  { sku: "106487", descripcion: "CPU AMD AM5 RYZEN R9-7900 5.4GHZ/12C24T/76MB", seriales: "9MJ2517W40145", categoria: "PROCESADOR" },
  { sku: "777081", descripcion: "CPU INTEL I3-12100 3.3GHZ LGA1700 12MB C/COOLER", seriales: "U65V1L6600188", categoria: "PROCESADOR" },
  { sku: "157442", descripcion: "CPU INTEL ULTRA 5-250K PLUS 5.3GHZ LGA1851 30MB", seriales: "86ES581602159", categoria: "PROCESADOR" },
  { sku: "774507", descripcion: "CPU INTEL I7-12700 2.1GHZ LGA1700 25MB C/COOLER", seriales: "U60H0N5803453", categoria: "PROCESADOR" },

  // Placas Madre
  { sku: "879268", descripcion: "MB ASUS 1700 PRIME H610M-D D4 HDMI/VGA/M.2/USB3.2/LAN/DDR4/MATX", seriales: "TAM0KC013814HT4", categoria: "PLACA_MADRE" },
  { sku: "154683", descripcion: "MB GIGABYTE AM5 X870E EAGLE X3D WIFI7 HDMI/USB3.2/4M.2/DDR5/ATX", seriales: "SN260600000506", categoria: "PLACA_MADRE" },
  { sku: "879076", descripcion: "MB ASUS 1700 H610M-K D4 HDMI/M.2/USB3.2/DDR4/MATX", seriales: "TCM0KK01B004HD6", categoria: "PLACA_MADRE" },
  { sku: "113586", descripcion: "MB GIGABYTE AM4 A520M DS3H V2 S/R/HDMI/DP/M.2/DDR4/USB3.2/MATX", seriales: "SN252060059972", categoria: "PLACA_MADRE" },
  { sku: "152744", descripcion: "MB ASUS 1700 B760M-AYW WIFI II HDMI/USB3.2/2M.2./DDR5/MATX", seriales: "W3M0KC012066NYE", categoria: "PLACA_MADRE" },
  { sku: "145723", descripcion: "MB ASUS AM4 A520M-R PRIME HDMI/USB3.2/2M.2/DDR4/MATX", seriales: "TAM0KK03S3555LF", categoria: "PLACA_MADRE" },
  { sku: "119606", descripcion: "MB GIGABYTE 1700 H610M K HDMI/M.2/DDR4/LAN/USB3.2", seriales: "SN26225A009253", categoria: "PLACA_MADRE" },
  { sku: "151405", descripcion: "MB MSI AM5 B840 GAMING PLUS WIFI HDMI/USB3.2/2M.2/DDR5/ATX", seriales: "601-7E57-020B2505000510", categoria: "PLACA_MADRE" },
  { sku: "119612", descripcion: "MB GIGABYTE AM5 A620M S2H V/S/R/HDMI/DP/M.2/DDR5/LAN/USB3.2/MATX", seriales: "SN251150032119", categoria: "PLACA_MADRE" },
  { sku: "150816", descripcion: "MB ASUS 1700 H610M-R PRIME HDMI/DP/M.2/USB3.2/MATX", seriales: "TAM0CS036344WGY", categoria: "PLACA_MADRE" },
  { sku: "117746", descripcion: "MB MSI AM5 B650M-P PRO HDMI/DP/VGA/USB3.2/2M.2/DDR5/MATX", seriales: "601-7E27-010B2506015600", categoria: "PLACA_MADRE" },
  { sku: "101512", descripcion: "MB MSI 1700 H610M-G PRO HDMI/VGA/DP/M.2/USB3.2/LAN/DDR4/MATX", seriales: "601-7D46-600B2602008205", categoria: "PLACA_MADRE" },
  { sku: "128699", descripcion: "MB GIGABYTE 1700 H610M K V2 HDMI/DP/USB3.2/M.2/DDR5/MATX", seriales: "SN254950058575", categoria: "PLACA_MADRE" },
  { sku: "139699", descripcion: "MB ASUS 1851 B860M-A PRIME/HDMI/DP/USB 3.2/2M.2/DDR5/MATX", seriales: "T1M0CS057245YLM", categoria: "PLACA_MADRE" },
  { sku: "164293", descripcion: "MB ASROCK 1700 B760M PRO-A/D4 WIFI HDMI/DP/USB 3.2/2M.2/MATX", seriales: "K3M0XB123513", categoria: "PLACA_MADRE" },

  // Tarjetas Gráficas (GPU)
  { sku: "138249", descripcion: "VGA GIGABYTE RTX5070 GAMING OC BLACK 12GB/GDDR7/2512MHZ/3FAN", seriales: "SN254401039701", categoria: "GPU" },
  { sku: "153654", descripcion: "VGA GIGABYTE RTX5060 TI EAGLE MAX OC 16G 16GB/GDDR7/2572MHZ/3FAN", seriales: "SN2254601038718", categoria: "GPU" },
  { sku: "141273", descripcion: "VGA GIGABYTE RTX5060 GAMING OC 8GB/GDDR7/2497MHZ/3FAN", seriales: "SN261641011850", categoria: "GPU" },
  { sku: "162762", descripcion: "VGA GIGABYTE RTX5050 LOW PROFILE OC 8GB/GDDR6/2572MHZ/3FAN", seriales: "SN261741004663", categoria: "GPU" },
  { sku: "161802", descripcion: "VGA ZOTAC RTX3060 TWIN EDGE 12GB/GDDR6/1777MHZ/2FAN", seriales: "B262500001835", categoria: "GPU" },
  { sku: "136821", descripcion: "VGA KEEPDATA RADEON RX580 DRAGONFLY GAMING 8GB/GDDR5/256BITS/2FAN", seriales: "804229", categoria: "GPU" },

  // Memoria RAM Desktop (DIMM DDR4 / DDR5)
  { sku: "158216", descripcion: "MEM DDR5 32GB (2X16G)/6000MHZ KLEVV HYNIX FIT V BLACK KD5AGU880-60A300L", seriales: "D2641687903709", categoria: "RAM" },
  { sku: "156275", descripcion: "MEM DDR5 32GB(2X16GB)/6000MHZ KINGSTON FURY BEAST KF560C36BBE2K2-32 BLACK", seriales: "0000010979089-O001750", categoria: "RAM" },
  { sku: "868176", descripcion: "MEM DDR4 32GB/3200MHZ KINGSTON FURY KF432C16BB/32 BLACK", seriales: "0198082549003E1CA3", categoria: "RAM" },
  { sku: "769941", descripcion: "MEM DDR4 16GB/2666MHZ CRUCIAL CT16G4DFRA266", seriales: "E66F31D8", categoria: "RAM" },
  { sku: "152617", descripcion: "MEM DDR5 16GB/5600MHZ ADATA XPG ARMAX AX5U5600C4616G-SAMB", seriales: "1Q0200674399", categoria: "RAM" },
  { sku: "150130", descripcion: "MEM DDR5 16GB/5600MHZ ADATA XPG LANCER BLADE AX5U5600C4616G-SLABBK", seriales: "1Q0101133954", categoria: "RAM" },
  { sku: "164143", descripcion: "MEM DDR5 16GB/5600MHZ KLEVV BLACK KD5AGUA80-56G460A", seriales: "D2641671600623", categoria: "RAM" },
  { sku: "115445", descripcion: "MEM DDR4 16GB/3600MHZ KINGSTON FURY BEAST KF436C18BB/16", seriales: "18243188", categoria: "RAM" },
  { sku: "125933", descripcion: "MEM DDR4 16GB/3200MHZ ADATA XPG GAMMIX D35 AX4U320016G16A-SBKD35 BLACK", seriales: "1Q0400293559", categoria: "RAM" },
  { sku: "747774", descripcion: "MEM DDR5 16GB/5200MHZ KINGSTON FURY BEAST KF552C40BB-16 BLACK", seriales: "01980826030057C3B3", categoria: "RAM" },
  { sku: "152710", descripcion: "MEM DDR4 8GB/3200MHZ CORSAIR VENGEANCE LPX BLACK CMK8GX4M1E3200C16", seriales: "A506T6214G29BY", categoria: "RAM" },
  { sku: "868175", descripcion: "MEM DDR4 8GB/3200MHZ KINGSTON FURY BEAST KF432C16BB/8 BLACK", seriales: "2509 0000010751085-O008647", categoria: "RAM" },

  // Almacenamiento (SSD)
  { sku: "153053", descripcion: "SSD 1TB M.2 NVME SANDISK OPTIMUS GX PRO 8100 PCIE GEN 5X4 14900-11000", seriales: "260658800828", categoria: "ALMACENAMIENTO" },
  { sku: "868531", descripcion: "SSD 1TB M.2 NVME WD GREEN SN350 PCIE GEN3X4 3200-2500MB/S WDS100T3G0C", seriales: "25255E805421", categoria: "ALMACENAMIENTO" },
  { sku: "132446", descripcion: "SSD 1TB M.2 NVME WD GREEN SN3000 NVME PCIE GEN4X4 5000-4200MB/S WDS100T4G0E", seriales: "25396C806202", categoria: "ALMACENAMIENTO" },
  { sku: "132953", descripcion: "SSD 1TB M.2 NVME KINGSTON NV3 PCIE 4X4 6000-4000MB/S SNV3S/1000G", seriales: "50026B7283940A9D", categoria: "ALMACENAMIENTO" },
  { sku: "116550", descripcion: "SSD 1TB M.2 NVME SANDISK PLUS PCIE GEN3X4 3200-3200MB/S SDSSDA3N-1T00-G26", seriales: "25332V801805", categoria: "ALMACENAMIENTO" },
  { sku: "143357", descripcion: "SSD 2TB 2.5\" SANDISK PLUS G28 SATA 545-515MB/S SDSSDA-2T00-G28", seriales: "2529E3D00150", categoria: "ALMACENAMIENTO" },
  { sku: "153027", descripcion: "SSD 500GB M.2 NVME SANDISK OPTIMUS 5100 PCIE GEN4X4 6600-5600MB/S", seriales: "26175A400980", categoria: "ALMACENAMIENTO" },
  { sku: "132955", descripcion: "SSD M.2 KINGSTON SNV3S/500G 5000/3000 MB/S 500 GB", seriales: "50026B768757A294", categoria: "ALMACENAMIENTO" },
  { sku: "151042", descripcion: "SSD 512GB 2.5\" LEXAR NQ100 SATA 550MB/S LNQ100X512G", seriales: "QKD799R0130490S31A", categoria: "ALMACENAMIENTO" },
  { sku: "723983", descripcion: "SSD 480GB 2.5\" SANDISK PLUS G26 SATA 535-445MB/S SDSSDA-480G-G26", seriales: "UBE12AF18W00109", categoria: "ALMACENAMIENTO" },
  { sku: "130707", descripcion: "SSD 240GB 2.5\" FTX SATA 530-400MB/S", seriales: "SSDST324025080110112", categoria: "ALMACENAMIENTO" },

  // Fuentes de Poder
  { sku: "141174", descripcion: "FUENTE BE QUIET! PURE POWER 12 850W / 80 PLUS GOLD / BLACK (BP004U2)", seriales: "004U2L6140000007", categoria: "FUENTE" },
  { sku: "116311", descripcion: "FUENTE GIGABYTE 850W GP-UD850GM 80 PLUS GOLD FULL MODULAR 3GTA.BR-PY", seriales: "SN24423G017519", categoria: "FUENTE" },
  { sku: "139610", descripcion: "FUENTE GAMDIAS HELIOS M2-850B 850W 80 PLUS SILVER 1GTA.BR", seriales: "B81426400015", categoria: "FUENTE" },
  { sku: "135270", descripcion: "FUENTE GIGABYTE 750W GP-UD750GM PG5 80 PLUS GOLD FULL MODULAR BLACK 3GTA.BR-PY", seriales: "SN25123G006171", categoria: "FUENTE" },
  { sku: "141354", descripcion: "FUENTE BE QUIET! SYSTEM POWER 11 U 750W / 80 PLUS BRONZE / BLACK (BP012U2)", seriales: "012U2H6140000100", categoria: "FUENTE" },
  { sku: "108532", descripcion: "FUENTE MSI MPG A650BN 650W BRONZE 80PLUS", seriales: "3067ZP2B23CE010601003803", categoria: "FUENTE" },
  { sku: "152753", descripcion: "FUENTE CORSAIR ATX 650W CX650M SEMI MODULAR CYBENETICS BRONZE", seriales: "AAVMF531Q0HZ2X", categoria: "FUENTE" },
  { sku: "161123", descripcion: "FUENTE GIGABYTE 650W GP-P650G PG5 80 PLUS GOLD BLACK 3GTA.BR-PY", seriales: "SN26042Q017098", categoria: "FUENTE" },
  { sku: "161010", descripcion: "FUENTE BE QUIET! SYSTEM POWER 11 M 650W / 80 PLUS GOLD / BLACK (BP016EU)", seriales: "016EUS5410001659", categoria: "FUENTE" },
  { sku: "163272", descripcion: "FUENTE ADATA XPG PROBE 600W 80 PLUS BRONZE BLACK 3GTA.BR", seriales: "4P1681618008", categoria: "FUENTE" },
  { sku: "159652", descripcion: "FUENTE GAMDIAS HELIOS M2-550B 550W 80 PLUS BRONCE 1GTA.BR", seriales: "B51426400030", categoria: "FUENTE" },
  { sku: "164052", descripcion: "FUENTE MSI 500W MAG A500DN II 80 PLUS STANDARD (306-7ZPVC23-CE0)", seriales: "3067ZPVC23CE010613001837", categoria: "FUENTE" },

  // Gabinetes
  { sku: "141342", descripcion: "GABINETE BE QUIET! LIGHT BASE 900 FX ARGB/PWM/BLACK/4 FAN (BGW71) 1GTA.BR", seriales: "W71H6130000082", categoria: "GABINETE" },
  { sku: "141341", descripcion: "GABINETE BE QUIET! PURE BASE 501 /AIRFLOW WINDOW BLACK/2 FAN (BGW74) 1GTA.BR", seriales: "W74Q6140004007", categoria: "GABINETE" },
  { sku: "141346", descripcion: "GABINETE BE QUIET! PURE BASE 501 LX ARGB/PWM/WHITE/4 FAN (BGW79) 1GTA.BR", seriales: "W79Q5160002220", categoria: "GABINETE" },
  { sku: "158760", descripcion: "GABINETE GAMER COUGAR MX230 RGB E-ATX MID TOWER - BLACK", seriales: "42BF03M23RB00076", categoria: "GABINETE" },
  { sku: "131853", descripcion: "GABINETE COUGAR FV150 RGB 4 FAN BLACK", seriales: "UBF04FV5RB00355", categoria: "GABINETE" },
  { sku: "159075", descripcion: "GABINETE COUGAR AIRFACE 180 MID-TOWER/3FAN/ARGB/WHITE", seriales: "UBE12AF18W00109", categoria: "GABINETE" },
  { sku: "145879", descripcion: "GABINETE COUGAR AIRFACE 180 MID-TOWER/3FAN/ARGB/BLACK", seriales: "UBF03AF18B00400", categoria: "GABINETE" },
  { sku: "109731", descripcion: "GABINETE COUGAR AIRFACE PRO RGB 4 FAN WHITE (AIRFLOW)", seriales: "UBD03AIFRW00139", categoria: "GABINETE" },
  { sku: "109733", descripcion: "GABINETE COUGAR AIRFACE 1 FAN BLACK (AIRFLOW)", seriales: "UBF02AIFAC00194", categoria: "GABINETE" },
  { sku: "100673", descripcion: "GABINETE SATELLITE GAMER 1103K 1 FAN ATX RGB", seriales: "Sin serial visible", categoria: "GABINETE" },
  { sku: "100674", descripcion: "GABINETE SATELLITE GAMER 1102K 1 FAN ATX RGB", seriales: "N/A", categoria: "GABINETE" },
  { sku: "855310", descripcion: "GABINETE KIT SATELLITE K761 TEC.ESP+MOUSE+SPEAKER+FUENTE", seriales: "N/A", categoria: "GABINETE" },
  { sku: "855308", descripcion: "GABINETE KIT SATELLITE K701 TEC.ESP+MOUSE+SPEAKER+FUENTE", seriales: "N/A", categoria: "GABINETE" },

  // Refrigeración / Coolers
  { sku: "159675", descripcion: "COOLER LIQUID GAMDIAS AURA GL240 LCD IPS 4\" ARGB 240MM PWM/2FAN/BLACK", seriales: "3325600680", categoria: "REFRIGERACION" },
  { sku: "151363", descripcion: "COOLER LIQUID THERMALRIGHT AQUA ELITE 360 ARGB V6 BLACK", seriales: "BL25L12AE360V6ARGBCB0574", categoria: "REFRIGERACION" },
  { sku: "109717", descripcion: "COOLER LIQUID COUGAR POSEIDON GT 360 INTEL LGA1700/AMD AM5", seriales: "19BD03PGT360088", categoria: "REFRIGERACION" },
  { sku: "117942", descripcion: "COOLER P/CPU THERMALRIGHT PEERLESS ASSASSIN 120 SE 2 FAN LGA1700/AM5", seriales: "N/A", categoria: "REFRIGERACION" },
  { sku: "117936", descripcion: "COOLER P/CPU THERMALRIGHT ASSASSIN X 120 REFINED SE WHITE ARGB", seriales: "N/A", categoria: "REFRIGERACION" },
  { sku: "117934", descripcion: "COOLER P/CPU THERMALRIGHT ASSASSIN X 120 REFINED SE ARGB", seriales: "N/A", categoria: "REFRIGERACION" },
  { sku: "130383", descripcion: "COOLER CPU THERMALRIGHT ASSASSIN X 120 REFINED SE BLACK LGA1700/AM5", seriales: "N/A", categoria: "REFRIGERACION" },
  { sku: "152189", descripcion: "COOLER P/CPU JONSBO CR-1000 EVO ARGB 120MM BLACK", seriales: "YXCG1A051000EVOA0633", categoria: "REFRIGERACION" },
  { sku: "159679", descripcion: "COOLER GAMDIAS NOTUS M1-1203 120MM BLACK (3FAN)", seriales: "132225800132", categoria: "REFRIGERACION" },
  { sku: "139625", descripcion: "COOLER GAMDIAS NOTUS M1-1203 ARGB PWM 120MM BLACK (3FAN)", seriales: "1E2225800017", categoria: "REFRIGERACION" }
];

// Catálogo específico para EXPANSIÓN / UPGRADE DE NOTEBOOK (Notebooks + RAM SODIMM + Almacenamiento SSD)
export const CATALOGO_EXPANSION_NOTEBOOK: ComponenteMontaje[] = [
  // Notebooks del Cliente
  { sku: "157947", descripcion: "NB GIGABYTE A16 CVHI3US894SH I7-13620H 4.9/16GBD5/1TBSSD/16/IPS/165HZ/RTX5060 8GB/W11", seriales: "SN2538014J017373", categoria: "NOTEBOOK" },
  { sku: "157347", descripcion: "NB GIGABYTE A16 CVHI3US894SH I7-13620H 4.9/16GBD5/1TBSSD/16\"/IPS/165HZ/RTX5060 8GB", seriales: "SN25384J016937", categoria: "NOTEBOOK" },
  { sku: "119592", descripcion: "NB ASUS VIVOBOOK F1605ZA-WS74 I7-1255U/16GB/512SSD/16\"/FHD/ING/W11/BLACK", seriales: "RAN0CV10V63843B", categoria: "NOTEBOOK" },
  { sku: "159185", descripcion: "NB ACER NITRO V ANV16-72-789X I7-240H/ 16GBD5/ 512SSD/ 16\"/ IPS/ 180HZ/ RTX5050/ W11/ ING", seriales: "NHQZLAA006603266912P00", categoria: "NOTEBOOK" },
  { sku: "151656", descripcion: "NB GIGABYTE A16 CVHI3LA894PH I7-13620H 4.9/16GBD5/1TBSSD/16\"/IPS/165HZ/RTX5060/W11", seriales: "SN25444J003601", categoria: "NOTEBOOK" },

  // Memorias RAM SODIMM para Notebook
  { sku: "114543", descripcion: "MEM NB DDR5 16GB/4800MHZ CRUCIAL CT16G48C40S5 (SODIMM)", seriales: "EB8161E8", categoria: "RAM" },
  { sku: "136347", descripcion: "MEM NB DDR5 16GB/4800MHZ ADATA PREMIER AD5S480016G-S (SODIMM)", seriales: "7P3708011986", categoria: "RAM" },
  { sku: "125928", descripcion: "MEM NB DDR4 16GB/3200MHZ ADATA PREMIER AD4S320016G22-SGN (SODIMM)", seriales: "7P4500013865", categoria: "RAM" },
  { sku: "136351", descripcion: "MEM NB DDR5 16GB/5600MHZ ADATA PREMIER AD5S560016G-S (SODIMM)", seriales: "1Q3200853921", categoria: "RAM" },

  // SSD de Expansión
  { sku: "116550", descripcion: "SSD 1TB M.2 NVME SANDISK PLUS PCIE GEN3X4 3200-3200MB/S SDSSDA3N-1T00-G26", seriales: "25332V801805", categoria: "ALMACENAMIENTO" },
  { sku: "132446", descripcion: "SSD 1TB M.2 NVME WD GREEN SN3000 NVME PCIE GEN4X4 5000-4200MB/S", seriales: "25396C806202", categoria: "ALMACENAMIENTO" },
  { sku: "132953", descripcion: "SSD 1TB M.2 NVME KINGSTON NV3 PCIE 4X4 6000-4000MB/S SNV3S/1000G", seriales: "50026B7283940A9D", categoria: "ALMACENAMIENTO" },
  { sku: "153027", descripcion: "SSD 500GB M.2 NVME SANDISK OPTIMUS 5100 PCIE GEN4X4 6600-5600MB/S", seriales: "26175A400980", categoria: "ALMACENAMIENTO" },
  { sku: "151042", descripcion: "SSD 512GB 2.5\" LEXAR NQ100 SATA 550MB/S LNQ100X512G", seriales: "QKD799R0130490S31A", categoria: "ALMACENAMIENTO" }
];

// Catálogo general
export const CATALOGO_HARDWARE_REAL: ComponenteMontaje[] = [
  ...CATALOGO_MONTAJE_PC,
  ...CATALOGO_EXPANSION_NOTEBOOK
];

// Órdenes reales agrupadas desde el archivo de tabla de montajes NISSEI
// Refleja exactamente:
// - Los 3 técnicos autorizados: Nicolas Solis, Magaly Yegros, Juan Ronnebeck
// - Las órdenes con 2 montajes (2 gabinetes, 2 placas, 2 CPUs)
// - Los servicios de Montaje de PC Completa vs Expansión de Notebook
export const INITIAL_MONTAJES_REALES: OrdenMontajeReal[] = [
  {
    id: "MNT-966565",
    nro_reg: "966.565",
    cliente: "Prychen Wei",
    fecha_facturacion: "07/08/2026",
    fecha_montaje: "10/08/2026",
    vendedor: "Helen Rivarola",
    canal: "Tienda",
    estado: "Entregado",
    tipo_servicio: "Montaje",
    cantidadEquipos: 2, // 2 Montajes de PC completos (2x CPU, 2x MB, 2x Gabinete, 2x Fuente, 2x SSD, 2x RAM)
    tecnico: "Sin Asignar",
    etapa: "LISTO_ENTREGA",
    progreso: 100,
    prioridad: "NORMAL",
    consumoEstimado: "380W x 2",
    observaciones: "2 Montajes completos en lote: 2x Intel i5-12400, 2x Asus H610M, 2x RAM Crucial 16GB, 2x SSD 1TB WD Green, 2x Gabinete Satellite 1103K y 2x Fuente MSI 650W.",
    componentes: [
      { sku: "774198", descripcion: "CPU INTEL I5-12400 2.5GHZ LGA1700 18MB C/COOLER (PC 1)", seriales: "U5SY357100789", categoria: "PROCESADOR" },
      { sku: "774198", descripcion: "CPU INTEL I5-12400 2.5GHZ LGA1700 18MB C/COOLER (PC 2)", seriales: "U5SY357100620", categoria: "PROCESADOR" },
      { sku: "879268", descripcion: "MB ASUS 1700 PRIME H610M-D D4 HDMI/VGA/M.2/DDR4 (PC 1)", seriales: "TAM0KC013814HT4", categoria: "PLACA_MADRE" },
      { sku: "150048", descripcion: "MB ASUS 1700 PRIME H610M-K D4-CSM HDMI/M.2/DDR4 (PC 2)", seriales: "SAM0CS060767R9M", categoria: "PLACA_MADRE" },
      { sku: "769941", descripcion: "MEM DDR4 16GB/2666MHZ CRUCIAL CT16G4DFRA266 (PC 1)", seriales: "E66F31D8", categoria: "RAM" },
      { sku: "769941", descripcion: "MEM DDR4 16GB/2666MHZ CRUCIAL CT16G4DFRA266 (PC 2)", seriales: "E66F3601", categoria: "RAM" },
      { sku: "868531", descripcion: "SSD 1TB M.2 NVME WD GREEN SN350 (PC 1)", seriales: "25255E805421", categoria: "ALMACENAMIENTO" },
      { sku: "868531", descripcion: "SSD 1TB M.2 NVME WD GREEN SN350 (PC 2)", seriales: "25255E806298", categoria: "ALMACENAMIENTO" },
      { sku: "108532", descripcion: "FUENTE MSI MPG A650BN 650W BRONZE (PC 1)", seriales: "3067ZP2B23CE010601003803", categoria: "FUENTE" },
      { sku: "108532", descripcion: "FUENTE MSI MPG A650BN 650W BRONZE (PC 2)", seriales: "3067ZP2B23CE010601003804", categoria: "FUENTE" },
      { sku: "100673", descripcion: "GABINETE SATELLITE GAMER 1103K 1 FAN ATX (PC 1)", seriales: "Sin serial visible", categoria: "GABINETE" },
      { sku: "100673", descripcion: "GABINETE SATELLITE GAMER 1103K 1 FAN ATX (PC 2)", seriales: "Sin serial visible", categoria: "GABINETE" }
    ]
  },
  {
    id: "MNT-602532",
    nro_reg: "602.532",
    cliente: "Mariano Cano",
    fecha_facturacion: "08/08/2026",
    fecha_montaje: "12/08/2026",
    vendedor: "Ecommerce - Web",
    canal: "Ecommerce - Web",
    estado: "Rev. Cerrado",
    tipo_servicio: "Montaje",
    cantidadEquipos: 1, // 1 Montaje High-End (con kit 2x RAM de 16GB y 2 coolers)
    tecnico: "Sin Asignar",
    etapa: "LISTO_ENTREGA",
    progreso: 100,
    prioridad: "URGENTE",
    consumoEstimado: "580W",
    observaciones: "Configuración High-End: Ryzen 7 7700X AM5, Gigabyte X870E Eagle X3D, RTX 5070 12GB GDDR7, fuente Be Quiet! Pure Power 12 850W Gold y AIO LCD Gamdias Aura GL240.",
    componentes: [
      { sku: "102643", descripcion: "CPU AMD AM5 RYZEN R7-7700X 4.5GHZ/40MB S/COOLER", seriales: "9MQ0713Q50166", categoria: "PROCESADOR" },
      { sku: "154683", descripcion: "MB GIGABYTE AM5 X870E EAGLE X3D WIFI7 HDMI/USB3.2/4M.2/DDR5/ATX", seriales: "SN260600000506", categoria: "PLACA_MADRE" },
      { sku: "138249", descripcion: "VGA GIGABYTE RTX5070 GAMING OC BLACK 12GB/GDDR7/2512MHZ/3FAN", seriales: "SN254401039701", categoria: "GPU" },
      { sku: "158216", descripcion: "MEM DDR5 32GB (2X16G)/6000MHZ KLEVV HYNIX FIT V BLACK (Módulo A)", seriales: "D2641687903709", categoria: "RAM" },
      { sku: "158216", descripcion: "MEM DDR5 32GB (2X16G)/6000MHZ KLEVV HYNIX FIT V BLACK (Módulo B)", seriales: "D2641687903708", categoria: "RAM" },
      { sku: "153053", descripcion: "SSD 1TB M.2 NVME SANDISK OPTIMUS GX PRO 8100 PCIE GEN 5X4 14900-11000", seriales: "260658800828", categoria: "ALMACENAMIENTO" },
      { sku: "141174", descripcion: "FUENTE BE QUIET! PURE POWER 12 850W / 80 PLUS GOLD", seriales: "004U2L6140000007", categoria: "FUENTE" },
      { sku: "141342", descripcion: "GABINETE BE QUIET! LIGHT BASE 900 FX ARGB/PWM/BLACK/4 FAN", seriales: "W71H6130000082", categoria: "GABINETE" },
      { sku: "159675", descripcion: "COOLER LIQUID GAMDIAS AURA GL240 LCD IPS 4\" ARGB 240MM", seriales: "3325600680", categoria: "REFRIGERACION" },
      { sku: "159679", descripcion: "COOLER GAMDIAS NOTUS M1-1203 120MM BLACK (3FAN)", seriales: "132225800132", categoria: "REFRIGERACION" }
    ]
  },
  {
    id: "MNT-970943",
    nro_reg: "970.943",
    cliente: "J.W.F. SA",
    fecha_facturacion: "13/08/2026",
    fecha_montaje: "14/08/2026",
    vendedor: "Diego Vera",
    canal: "Empresas / Coorporativo",
    estado: "Entregado",
    tipo_servicio: "Montaje",
    cantidadEquipos: 2, // 2 Workstations completas i9-14900 (con 4 memorias de 32GB = 64GB cada una)
    tecnico: "Sin Asignar",
    etapa: "LISTO_ENTREGA",
    progreso: 100,
    prioridad: "NORMAL",
    consumoEstimado: "650W x 2",
    observaciones: "2 Workstations de Alto Rendimiento: 2x Intel i9-14900, 2x Asus H610M-K, 4x Kingston Fury 32GB (64GB por estación), 2x SSD 1TB WD SN3000, 2x Liquid Cooler 360, 2x Be Quiet! Pure Base 501 y 2x Fuente Gamdias 850W Silver.",
    componentes: [
      { sku: "119157", descripcion: "CPU INTEL I9-14900 2.0GHZ LGA1700 36MB (PC 1)", seriales: "U5DN443202000", categoria: "PROCESADOR" },
      { sku: "119157", descripcion: "CPU INTEL I9-14900 2.0GHZ LGA1700 36MB (PC 2)", seriales: "U5MG281302832", categoria: "PROCESADOR" },
      { sku: "879076", descripcion: "MB ASUS 1700 H610M-K D4 HDMI/M.2/DDR4 (PC 1)", seriales: "TCM0KK01B004HD6", categoria: "PLACA_MADRE" },
      { sku: "879076", descripcion: "MB ASUS 1700 H610M-K D4 HDMI/M.2/DDR4 (PC 2)", seriales: "TAM0CS04358265V", categoria: "PLACA_MADRE" },
      { sku: "868176", descripcion: "MEM DDR4 32GB/3200MHZ KINGSTON FURY (PC 1 - Mod 1)", seriales: "0198082549003E1CA3", categoria: "RAM" },
      { sku: "868176", descripcion: "MEM DDR4 32GB/3200MHZ KINGSTON FURY (PC 1 - Mod 2)", seriales: "2520-O002723", categoria: "RAM" },
      { sku: "868176", descripcion: "MEM DDR4 32GB/3200MHZ KINGSTON FURY (PC 2 - Mod 1)", seriales: "2520-O002722", categoria: "RAM" },
      { sku: "868176", descripcion: "MEM DDR4 32GB/3200MHZ KINGSTON FURY (PC 2 - Mod 2)", seriales: "2520-O002721", categoria: "RAM" },
      { sku: "132446", descripcion: "SSD 1TB M.2 NVME WD GREEN SN3000 (PC 1)", seriales: "25396C806202", categoria: "ALMACENAMIENTO" },
      { sku: "132446", descripcion: "SSD 1TB M.2 NVME WD GREEN SN3000 (PC 2)", seriales: "25396C806760", categoria: "ALMACENAMIENTO" },
      { sku: "141341", descripcion: "GABINETE BE QUIET! PURE BASE 501 BLACK (PC 1)", seriales: "W74Q6140004007", categoria: "GABINETE" },
      { sku: "141341", descripcion: "GABINETE BE QUIET! PURE BASE 501 BLACK (PC 2)", seriales: "W74Q6140004006", categoria: "GABINETE" },
      { sku: "151363", descripcion: "COOLER LIQUID THERMALRIGHT AQUA ELITE 360 (PC 1)", seriales: "BL25L12AE360V6ARGBCB0574", categoria: "REFRIGERACION" },
      { sku: "151363", descripcion: "COOLER LIQUID THERMALRIGHT AQUA ELITE 360 (PC 2)", seriales: "BL25L12AE360V6ARGBCB0576", categoria: "REFRIGERACION" },
      { sku: "139610", descripcion: "FUENTE GAMDIAS HELIOS M2-850B 850W SILVER (PC 1)", seriales: "B81426400015", categoria: "FUENTE" },
      { sku: "139610", descripcion: "FUENTE GAMDIAS HELIOS M2-850B 850W SILVER (PC 2)", seriales: "B81426400014", categoria: "FUENTE" }
    ]
  },
  {
    id: "EXP-607682",
    nro_reg: "607.682",
    cliente: "Hard & Soft SA",
    fecha_facturacion: "24/08/2026",
    fecha_montaje: "28/08/2026",
    vendedor: "Ecommerce - Web",
    canal: "Ecommerce - Web",
    estado: "Entregado",
    tipo_servicio: "Expansion",
    cantidadEquipos: 1,
    tecnico: "Sin Asignar",
    etapa: "LISTO_ENTREGA",
    progreso: 100,
    prioridad: "NORMAL",
    observaciones: "Expansión de memoria RAM en Notebook Gamer Gigabyte A16: Instalación y test de módulo Crucial 16GB DDR5 4800MHz SODIMM. MemTest superado sin fallas.",
    componentes: [
      { sku: "157947", descripcion: "NB GIGABYTE A16 CVHI3US894SH I7-13620H 16GBD5/1TBSSD/RTX5060 8GB", seriales: "SN2538014J017373", categoria: "NOTEBOOK" },
      { sku: "114543", descripcion: "MEM NB DDR5 16GB/4800MHZ CRUCIAL CT16G48C40S5 (SODIMM)", seriales: "EB8161E8", categoria: "RAM" }
    ]
  },
  {
    id: "MNT-973616",
    nro_reg: "973.616",
    cliente: "Carolina Martinez",
    fecha_facturacion: "15/08/2026",
    fecha_montaje: "19/08/2026",
    vendedor: "Fabiola Patiño",
    canal: "Tienda",
    estado: "Entregado",
    tipo_servicio: "Montaje",
    cantidadEquipos: 1,
    tecnico: "Sin Asignar",
    etapa: "LISTO_ENTREGA",
    progreso: 100,
    prioridad: "NORMAL",
    consumoEstimado: "410W",
    observaciones: "Montaje Gamer Budget: Ryzen 5 5600GT, Gigabyte A520M, Radeon RX 580 8GB, 8GB Corsair LPX, SSD 480GB Sandisk, Fuente Be Quiet! 750W y gabinete Cougar Airface White.",
    componentes: [
      { sku: "120078", descripcion: "CPU AMD AM4 RYZEN R5-5600GT 3.6GHZ/19MB", seriales: "9MW2689X50472", categoria: "PROCESADOR" },
      { sku: "113586", descripcion: "MB GIGABYTE AM4 A520M DS3H V2 S/R/HDMI/DP/M.2/DDR4", seriales: "SN252060059972", categoria: "PLACA_MADRE" },
      { sku: "136821", descripcion: "VGA KEEPDATA RADEON RX580 DRAGONFLY 8GB/GDDR5", seriales: "804229", categoria: "GPU" },
      { sku: "152710", descripcion: "MEM DDR4 8GB/3200MHZ CORSAIR VENGEANCE LPX BLACK", seriales: "A506T6214G29BY", categoria: "RAM" },
      { sku: "723983", descripcion: "SSD 480GB 2.5\" SANDISK PLUS G26 SATA 535-445MB/S", seriales: "UBE12AF18W00109", categoria: "ALMACENAMIENTO" },
      { sku: "141354", descripcion: "FUENTE BE QUIET! SYSTEM POWER 11 U 750W BRONZE", seriales: "012U2H6140000100", categoria: "FUENTE" },
      { sku: "159075", descripcion: "GABINETE COUGAR AIRFACE 180 MID-TOWER/3FAN/WHITE", seriales: "UBE12AF18W00109", categoria: "GABINETE" }
    ]
  },
  {
    id: "MNT-978975",
    nro_reg: "978.975",
    cliente: "Ana Maria Zanotti",
    fecha_facturacion: "24/08/2026",
    fecha_montaje: "25/08/2026",
    vendedor: "Diego Vera",
    canal: "Tienda",
    estado: "Entregado",
    tipo_servicio: "Montaje",
    cantidadEquipos: 1,
    tecnico: "Sin Asignar",
    etapa: "LISTO_ENTREGA",
    progreso: 100,
    prioridad: "EXPRESS",
    consumoEstimado: "460W",
    observaciones: "Montaje Diseño & Gaming: Intel i5-14400F, Asus B760M-AYW WiFi, Zotac RTX 3060 12GB, 32GB RAM DDR5 (2x16GB) Adata XPG, Fuente Be Quiet! 650W Gold y gabinete Cougar FV150.",
    componentes: [
      { sku: "119664", descripcion: "CPU INTEL I5-14400F 2.5GHZ/20MB LGA1700", seriales: "U69Y8D0603958", categoria: "PROCESADOR" },
      { sku: "152744", descripcion: "MB ASUS 1700 B760M-AYW WIFI II HDMI/USB3.2/2M.2/DDR5", seriales: "W3M0KC012066NYE", categoria: "PLACA_MADRE" },
      { sku: "161802", descripcion: "VGA ZOTAC RTX3060 TWIN EDGE 12GB/GDDR6/2FAN", seriales: "B262500001835", categoria: "GPU" },
      { sku: "152617", descripcion: "MEM DDR5 16GB/5600MHZ ADATA XPG ARMAX (Módulo 1)", seriales: "1Q0200674399", categoria: "RAM" },
      { sku: "152617", descripcion: "MEM DDR5 16GB/5600MHZ ADATA XPG ARMAX (Módulo 2)", seriales: "1Q0200674401", categoria: "RAM" },
      { sku: "152189", descripcion: "COOLER P/CPU JONSBO CR-1000 EVO ARGB 120MM BLACK", seriales: "YXCG1A051000EVOA0633", categoria: "REFRIGERACION" },
      { sku: "161010", descripcion: "FUENTE BE QUIET! SYSTEM POWER 11 M 650W GOLD", seriales: "016EUS5410001659", categoria: "FUENTE" },
      { sku: "131853", descripcion: "GABINETE COUGAR FV150 RGB 4 FAN BLACK", seriales: "UBF04FV5RB00355", categoria: "GABINETE" }
    ]
  },
  {
    id: "EXP-985825",
    nro_reg: "985.825",
    cliente: "Lilian Ferreira",
    fecha_facturacion: "07/09/2026",
    fecha_montaje: "07/09/2026",
    vendedor: "Patricia Martinez",
    canal: "Tienda",
    estado: "Entregado",
    tipo_servicio: "Expansion",
    cantidadEquipos: 1,
    tecnico: "Sin Asignar",
    etapa: "LISTO_ENTREGA",
    progreso: 100,
    prioridad: "URGENTE",
    observaciones: "Upgrade de memoria RAM en Notebook Gigabyte A16: Incorporación de 16GB DDR5 4800MHz Adata Premier SODIMM con entrega en el día.",
    componentes: [
      { sku: "157347", descripcion: "NB GIGABYTE A16 CVHI3US894SH I7-13620H RTX5060 8GB", seriales: "SN25384J016937", categoria: "NOTEBOOK" },
      { sku: "136347", descripcion: "MEM NB DDR5 16GB/4800MHZ ADATA PREMIER (SODIMM)", seriales: "7P3708011986", categoria: "RAM" }
    ]
  },
  {
    id: "MNT-982209",
    nro_reg: "982.209",
    cliente: "Park Avenue SA",
    fecha_facturacion: "28/08/2026",
    fecha_montaje: "01/09/2026",
    vendedor: "Sabrina Bogarin",
    canal: "Empresas / Coorporativo",
    estado: "Entregado",
    tipo_servicio: "Montaje",
    cantidadEquipos: 1,
    tecnico: "Sin Asignar",
    etapa: "LISTO_ENTREGA",
    progreso: 100,
    prioridad: "NORMAL",
    consumoEstimado: "340W",
    observaciones: "PC de Oficina Corporativa: Ryzen 7 5700G con gráficos Radeon Vega, Asus A520M-R Prime, 16GB Kingston Fury 3600MHz, SSD 1TB Sandisk Plus, fuente Gamdias 550W y gabinete Cougar Airface Black.",
    componentes: [
      { sku: "867488", descripcion: "CPU AMD AM4 RYZEN R7-5700G RADEON GRAPHICS 3.8GHZ", seriales: "9MU1877W50384", categoria: "PROCESADOR" },
      { sku: "145723", descripcion: "MB ASUS AM4 A520M-R PRIME HDMI/USB3.2/2M.2/DDR4", seriales: "TAM0KK03S3555LF", categoria: "PLACA_MADRE" },
      { sku: "115445", descripcion: "MEM DDR4 16GB/3600MHZ KINGSTON FURY BEAST", seriales: "18243188", categoria: "RAM" },
      { sku: "116550", descripcion: "SSD 1TB M.2 NVME SANDISK PLUS PCIE GEN3X4", seriales: "25332V801805", categoria: "ALMACENAMIENTO" },
      { sku: "159652", descripcion: "FUENTE GAMDIAS HELIOS M2-550B 550W BRONCE", seriales: "B51426400030", categoria: "FUENTE" },
      { sku: "145879", descripcion: "GABINETE COUGAR AIRFACE 180 MID-TOWER/3FAN/BLACK", seriales: "UBF03AF18B00400", categoria: "GABINETE" }
    ]
  },
  {
    id: "MNT-983171",
    nro_reg: "983.171",
    cliente: "Walter Saracho",
    fecha_facturacion: "29/06/2026",
    fecha_montaje: "02/09/2026",
    vendedor: "Emilio Lopez",
    canal: "Tienda",
    estado: "Entregado",
    tipo_servicio: "Montaje",
    cantidadEquipos: 1,
    tecnico: "Sin Asignar",
    etapa: "LISTO_ENTREGA",
    progreso: 100,
    prioridad: "NORMAL",
    consumoEstimado: "420W",
    observaciones: "PC Completa: Intel i5-12400, Gigabyte H610M K, 16GB Dual Channel (2x8GB) Kingston Fury 3200MHz, SSD 1TB Kingston NV3, Fuente Gigabyte 750W Gold y gabinete Cougar Airface Pro White.",
    componentes: [
      { sku: "774198", descripcion: "CPU INTEL I5-12400 2.5GHZ LGA1700 18MB C/COOLER", seriales: "U638PL4702250", categoria: "PROCESADOR" },
      { sku: "119606", descripcion: "MB GIGABYTE 1700 H610M K HDMI/M.2/DDR4/LAN", seriales: "SN26225A009253", categoria: "PLACA_MADRE" },
      { sku: "868175", descripcion: "MEM DDR4 8GB/3200MHZ KINGSTON FURY (Mod 1)", seriales: "2509-O008647", categoria: "RAM" },
      { sku: "868175", descripcion: "MEM DDR4 8GB/3200MHZ KINGSTON FURY (Mod 2)", seriales: "2509-O008669", categoria: "RAM" },
      { sku: "132953", descripcion: "SSD 1TB M.2 NVME KINGSTON NV3 PCIE 4X4 6000MB/S", seriales: "50026B7283940A9D", categoria: "ALMACENAMIENTO" },
      { sku: "135270", descripcion: "FUENTE GIGABYTE 750W GP-UD750GM 80 PLUS GOLD", seriales: "SN25123G006171", categoria: "FUENTE" },
      { sku: "109731", descripcion: "GABINETE COUGAR AIRFACE PRO RGB 4 FAN WHITE", seriales: "UBD03AIFRW00139", categoria: "GABINETE" }
    ]
  },
  {
    id: "MNT-611696",
    nro_reg: "611.696",
    cliente: "Juan Ezequiel Argüello",
    fecha_facturacion: "01/09/2026",
    fecha_montaje: "03/09/2026",
    vendedor: "Ecommerce - Web",
    canal: "Ecommerce - Web",
    estado: "Entregado",
    tipo_servicio: "Montaje",
    cantidadEquipos: 1,
    tecnico: "Sin Asignar",
    etapa: "LISTO_ENTREGA",
    progreso: 100,
    prioridad: "URGENTE",
    consumoEstimado: "520W",
    observaciones: "Plataforma AMD AM5 Zen 5: Ryzen 5 9600X, MSI B840 Gaming Plus WiFi, Gigabyte RTX 5060 Ti Eagle Max OC 16GB GDDR7, Cooler Thermalright Assassin X 120 White y fuente Gigabyte 750W Gold.",
    componentes: [
      { sku: "127768", descripcion: "CPU AMD AM5 RYZEN R5-9600X 3.9GHZ/38MB S/COOLER", seriales: "9MU7668W50433", categoria: "PROCESADOR" },
      { sku: "151405", descripcion: "MB MSI AM5 B840 GAMING PLUS WIFI HDMI/USB3.2/DDR5", seriales: "601-7E57-020B2505000510", categoria: "PLACA_MADRE" },
      { sku: "153654", descripcion: "VGA GIGABYTE RTX5060 TI EAGLE MAX OC 16GB GDDR7", seriales: "SN2254601038718", categoria: "GPU" },
      { sku: "47774", descripcion: "MEM RAM DDR5 KINGSTON FURY BEAST 16 GB 5200 MHZ", seriales: "01980826030057C3B1", categoria: "RAM" },
      { sku: "132955", descripcion: "SSD M.2 KINGSTON SNV3S/500G 5000/3000 MB/S 500GB", seriales: "50026B768757A294", categoria: "ALMACENAMIENTO" },
      { sku: "117936", descripcion: "COOLER P/CPU THERMALRIGHT ASSASSIN X 120 WHITE ARGB", seriales: "N/A", categoria: "REFRIGERACION" },
      { sku: "135270", descripcion: "FUENTE GIGABYTE 750W GP-UD750GM 80 PLUS GOLD", seriales: "SN25123G006181", categoria: "FUENTE" },
      { sku: "158760", descripcion: "GABINETE GAMER COUGAR MX230 RGB E-ATX BLACK", seriales: "42BF03M23RB00076", categoria: "GABINETE" }
    ]
  },
  {
    id: "MNT-1009622",
    nro_reg: "1.009.622",
    cliente: "Opalo SA",
    fecha_facturacion: "02/10/2026",
    fecha_montaje: "05/10/2026",
    vendedor: "Ruth Rolon",
    canal: "Empresas / Coorporativo",
    estado: "Entregado",
    tipo_servicio: "Montaje",
    cantidadEquipos: 2, // 2 Montajes de oficina completos (2x CPU, 2x MB, 2x RAM DDR5, 2x SSD, 2x Cooler, 2x Gabinete, 2x Fuente)
    tecnico: "Sin Asignar",
    etapa: "LISTO_ENTREGA",
    progreso: 100,
    prioridad: "NORMAL",
    consumoEstimado: "360W x 2",
    observaciones: "2 Montajes completos para oficinas: 2x Intel i5-12400, 2x Gigabyte H610M K V2 DDR5, 2x Kingston Fury 16GB DDR5, 2x SSD WD Green 500GB, 2x Cooler Assassin X 120 y 2x Fuente Adata XPG 600W Bronze.",
    componentes: [
      { sku: "774198", descripcion: "CPU INTEL I5-12400 2.5GHZ LGA1700 (PC 1)", seriales: "U638PL4701033", categoria: "PROCESADOR" },
      { sku: "774198", descripcion: "CPU INTEL I5-12400 2.5GHZ LGA1700 (PC 2)", seriales: "U642XT5400708", categoria: "PROCESADOR" },
      { sku: "128699", descripcion: "MB GIGABYTE 1700 H610M K V2 DDR5 (PC 1)", seriales: "SN254950058575", categoria: "PLACA_MADRE" },
      { sku: "128699", descripcion: "MB GIGABYTE 1700 H610M K V2 DDR5 (PC 2)", seriales: "SN254950058574", categoria: "PLACA_MADRE" },
      { sku: "747774", descripcion: "MEM DDR5 16GB/5200MHZ KINGSTON FURY BEAST (PC 1)", seriales: "01980826030057C3B3", categoria: "RAM" },
      { sku: "747774", descripcion: "MEM DDR5 16GB/5200MHZ KINGSTON FURY BEAST (PC 2)", seriales: "01980826030057C3D8", categoria: "RAM" },
      { sku: "148467", descripcion: "SSD 500GB 2.5\" WD GREEN SATA (PC 1)", seriales: "25272MD01274", categoria: "ALMACENAMIENTO" },
      { sku: "148467", descripcion: "SSD 500GB 2.5\" WD GREEN SATA (PC 2)", seriales: "25272MD02970", categoria: "ALMACENAMIENTO" },
      { sku: "117934", descripcion: "COOLER P/CPU THERMALRIGHT ASSASSIN X 120 (PC 1)", seriales: "N/A", categoria: "REFRIGERACION" },
      { sku: "117934", descripcion: "COOLER P/CPU THERMALRIGHT ASSASSIN X 120 (PC 2)", seriales: "N/A", categoria: "REFRIGERACION" },
      { sku: "163272", descripcion: "FUENTE ADATA XPG PROBE 600W BRONZE (PC 1)", seriales: "4P1681618008", categoria: "FUENTE" },
      { sku: "163272", descripcion: "FUENTE ADATA XPG PROBE 600W BRONZE (PC 2)", seriales: "4P1681617936", categoria: "FUENTE" },
      { sku: "855308", descripcion: "GABINETE KIT SATELLITE K701 (PC 1)", seriales: "N/A", categoria: "GABINETE" },
      { sku: "855308", descripcion: "GABINETE KIT SATELLITE K701 (PC 2)", seriales: "N/A", categoria: "GABINETE" }
    ]
  },
  {
    id: "EXP-1014339",
    nro_reg: "1.014.339",
    cliente: "Oscar Zelada",
    fecha_facturacion: "09/10/2026",
    fecha_montaje: "06/10/2026",
    vendedor: "Diego Vera",
    canal: "Tienda",
    estado: "Entregado",
    tipo_servicio: "Expansion",
    cantidadEquipos: 1,
    tecnico: "Sin Asignar",
    etapa: "LISTO_ENTREGA",
    progreso: 100,
    prioridad: "NORMAL",
    observaciones: "Expansión en Notebook Asus Vivobook F1605ZA: Instalación de módulo SODIMM 16GB DDR4 3200MHz Adata Premier.",
    componentes: [
      { sku: "119592", descripcion: "NB ASUS VIVOBOOK F1605ZA I7-1255U 16GB/512SSD", seriales: "RAN0CV10V63843B", categoria: "NOTEBOOK" },
      { sku: "125928", descripcion: "MEM NB DDR4 16GB/3200MHZ ADATA PREMIER (SODIMM)", seriales: "7P4500013865", categoria: "RAM" }
    ]
  },
  {
    id: "EXP-1006040",
    nro_reg: "1.006.040",
    cliente: "Jose Fernando Cespedes",
    fecha_facturacion: "07/10/2026",
    fecha_montaje: "07/10/2026",
    vendedor: "Sebastian Alcaraz",
    canal: "Tienda",
    estado: "Entregado",
    tipo_servicio: "Expansion",
    cantidadEquipos: 1,
    tecnico: "Sin Asignar",
    etapa: "LISTO_ENTREGA",
    progreso: 100,
    prioridad: "URGENTE",
    observaciones: "Expansión de Almacenamiento en Notebook Acer Nitro V (i7 13va gen + RTX 5050): Instalación de segundo SSD 1TB M.2 NVMe Sandisk Plus.",
    componentes: [
      { sku: "159185", descripcion: "NB ACER NITRO V ANV16-72 I7-240H 16GBD5/512SSD/RTX5050", seriales: "NHQZLAA006603266912P00", categoria: "NOTEBOOK" },
      { sku: "116550", descripcion: "SSD 1TB M.2 NVME SANDISK PLUS PCIE GEN3X4 (Expansión Slot 2)", seriales: "253450800175", categoria: "ALMACENAMIENTO" }
    ]
  },
  {
    id: "EXP-1021961",
    nro_reg: "1.021.961",
    cliente: "Leonardo Bergonzi",
    fecha_facturacion: "19/10/2026",
    fecha_montaje: "19/10/2026",
    vendedor: "Matias Fleitas",
    canal: "Tienda",
    estado: "Entregado",
    tipo_servicio: "Expansion",
    cantidadEquipos: 1,
    tecnico: "Sin Asignar",
    etapa: "LISTO_ENTREGA",
    progreso: 100,
    prioridad: "NORMAL",
    observaciones: "Expansión de RAM en Notebook Gigabyte A16: Inserción de 16GB DDR5 5600MHz Adata Premier SODIMM.",
    componentes: [
      { sku: "151656", descripcion: "NB GIGABYTE A16 CVHI3LA894PH I7-13620H 16GBD5/1TBSSD/RTX5060", seriales: "SN25444J003601", categoria: "NOTEBOOK" },
      { sku: "136351", descripcion: "MEM NB DDR5 16GB/5600MHZ ADATA PREMIER (SODIMM)", seriales: "1Q3200853921", categoria: "RAM" }
    ]
  },
  {
    id: "MNT-1025094",
    nro_reg: "1.025.094",
    cliente: "Prodato EAS",
    fecha_facturacion: "23/10/2026",
    fecha_montaje: "24/10/2026",
    vendedor: "Jose Gomez",
    canal: "Empresas / Coorporativo",
    estado: "Entregado",
    tipo_servicio: "Montaje",
    cantidadEquipos: 1,
    tecnico: "Sin Asignar",
    etapa: "LISTO_ENTREGA",
    progreso: 100,
    prioridad: "NORMAL",
    consumoEstimado: "420W",
    observaciones: "Socket LGA1851: Intel Core Ultra 5-250K Plus, Asus B860M-A Prime, 32GB RAM DDR5 (2x16GB Klevv), Cooler Thermalright Peerless Assassin 120 SE y fuente Corsair 650W Bronze.",
    componentes: [
      { sku: "157442", descripcion: "CPU INTEL ULTRA 5-250K PLUS 5.3GHZ LGA1851 30MB", seriales: "86ES581602159", categoria: "PROCESADOR" },
      { sku: "139699", descripcion: "MB ASUS 1851 B860M-A PRIME HDMI/DP/DDR5/MATX", seriales: "T1M0CS057245YLM", categoria: "PLACA_MADRE" },
      { sku: "164143", descripcion: "MEM DDR5 16GB/5600MHZ KLEVV BLACK (Mod 1)", seriales: "D2641671600623", categoria: "RAM" },
      { sku: "164143", descripcion: "MEM DDR5 16GB/5600MHZ KLEVV BLACK (Mod 2)", seriales: "D2641671600348", categoria: "RAM" },
      { sku: "153027", descripcion: "SSD 500GB M.2 NVME SANDISK OPTIMUS 5100 GEN4X4", seriales: "26175A400980", categoria: "ALMACENAMIENTO" },
      { sku: "152753", descripcion: "FUENTE CORSAIR ATX 650W CX650M SEMI MODULAR", seriales: "AAVMF531Q0HZ2X", categoria: "FUENTE" },
      { sku: "117942", descripcion: "COOLER P/CPU THERMALRIGHT PEERLESS ASSASSIN 120 SE 2 FAN", seriales: "N/A", categoria: "REFRIGERACION" },
      { sku: "109733", descripcion: "GABINETE COUGAR AIRFACE 1 FAN BLACK (AIRFLOW)", seriales: "UBF02AIFAC00194", categoria: "GABINETE" }
    ]
  },
  {
    id: "MNT-1033354",
    nro_reg: "1.033.354",
    cliente: "Mirtha Galeano",
    fecha_facturacion: "03/11/2026",
    fecha_montaje: "04/11/2026",
    vendedor: "Guillermo Perez",
    canal: "Tienda",
    estado: "Entregado",
    tipo_servicio: "Montaje",
    cantidadEquipos: 1,
    tecnico: "Sin Asignar",
    etapa: "LISTO_ENTREGA",
    progreso: 100,
    prioridad: "NORMAL",
    consumoEstimado: "390W",
    observaciones: "Core i7-12700 LGA1700, ASRock B760M Pro-A WiFi, 16GB Adata Gammix D35, SSD 1TB WD Green, Fuente Gigabyte 650W Gold y gabinete Be Quiet! Pure Base 501 LX White.",
    componentes: [
      { sku: "774507", descripcion: "CPU INTEL I7-12700 2.1GHZ LGA1700 25MB C/COOLER", seriales: "U60H0N5803453", categoria: "PROCESADOR" },
      { sku: "164293", descripcion: "MB ASROCK 1700 B760M PRO-A/D4 WIFI HDMI/DP/DDR4", seriales: "K3M0XB123513", categoria: "PLACA_MADRE" },
      { sku: "125933", descripcion: "MEM DDR4 16GB/3200MHZ ADATA XPG GAMMIX D35", seriales: "1Q0400293559", categoria: "RAM" },
      { sku: "113321", descripcion: "SSD 1TB M.2 NVME WD GREEN SN350 2400MB/S", seriales: "25185P803839", categoria: "ALMACENAMIENTO" },
      { sku: "161123", descripcion: "FUENTE GIGABYTE 650W GP-P650G 80 PLUS GOLD", seriales: "SN26042Q017098", categoria: "FUENTE" },
      { sku: "141346", descripcion: "GABINETE BE QUIET! PURE BASE 501 LX ARGB WHITE", seriales: "W79Q5160002220", categoria: "GABINETE" }
    ]
  }
];

export const MONTAJES_STORAGE_KEY = "nissei_taller_montajes_v4_real";
const STORAGE_KEY = MONTAJES_STORAGE_KEY;
const MONTAJES_DIRTY_KEY = "nissei_taller_montajes_dirty_ids_v1";

function getDirtyMontajeIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(MONTAJES_DIRTY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function markDirtyMontajeId(id: string): void {
  if (typeof window === "undefined" || !id) return;
  try {
    const next = Array.from(new Set([...getDirtyMontajeIds(), id]));
    localStorage.setItem(MONTAJES_DIRTY_KEY, JSON.stringify(next));
  } catch {
    // Ignore storage quota issues
  }
}

function clearDirtyMontajeIds(ids?: string[]): void {
  if (typeof window === "undefined") return;
  try {
    if (!ids) {
      localStorage.removeItem(MONTAJES_DIRTY_KEY);
      return;
    }
    const removeSet = new Set(ids);
    const next = getDirtyMontajeIds().filter((d) => !removeSet.has(d));
    if (next.length === 0) {
      localStorage.removeItem(MONTAJES_DIRTY_KEY);
    } else {
      localStorage.setItem(MONTAJES_DIRTY_KEY, JSON.stringify(next));
    }
  } catch {
    // Ignore
  }
}

export function getStoredMontajes(): OrdenMontajeReal[] {
  if (typeof window === "undefined") return INITIAL_MONTAJES_REALES;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_MONTAJES_REALES));
      return INITIAL_MONTAJES_REALES;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : INITIAL_MONTAJES_REALES;
  } catch {
    return INITIAL_MONTAJES_REALES;
  }
}

export function saveMontajes(list: OrdenMontajeReal[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch (err) {
    console.error("Error guardando montajes en localStorage:", err);
  }
}

export function getPendingDirtyMontajeIds(): string[] {
  return getDirtyMontajeIds();
}

export function syncVendedoresFromMontajes(list: OrdenMontajeReal[]): void {
  if (typeof window === "undefined" || !Array.isArray(list)) return;
  for (const m of list) {
    const vendor = String(m?.vendedor || "").trim();
    if (!vendor || vendor === "Salón CDE" || vendor === "Sin Asignar" || vendor.toUpperCase() === "OTRO") {
      continue;
    }
    addCustomVendedor(vendor);
  }
}

export function mergeAndSaveCloudMontajes(cloudList: OrdenMontajeReal[]): OrdenMontajeReal[] {
  const localList = getStoredMontajes();
  const dirtySet = new Set(getDirtyMontajeIds());
  const localMap = new Map<string, OrdenMontajeReal>(localList.map((m) => [m.id, m]));

  const mergedMap = new Map<string, OrdenMontajeReal>();
  for (const cloudOrd of cloudList) {
    if (dirtySet.has(cloudOrd.id) && localMap.has(cloudOrd.id)) {
      mergedMap.set(cloudOrd.id, localMap.get(cloudOrd.id)!);
    } else {
      mergedMap.set(cloudOrd.id, cloudOrd);
    }
  }
  // Mantener órdenes nuevas locales aún no confirmadas en MySQL
  for (const localOrd of localList) {
    if (!mergedMap.has(localOrd.id) && dirtySet.has(localOrd.id)) {
      mergedMap.set(localOrd.id, localOrd);
    }
  }

  const merged = Array.from(mergedMap.values());
  saveMontajes(merged);
  syncVendedoresFromMontajes(merged);
  return merged;
}

export async function pushPendingDirtyMontajes(): Promise<number> {
  if (typeof window === "undefined") return 0;
  const dirtyIds = getDirtyMontajeIds();
  if (dirtyIds.length === 0) return 0;

  const dirtySet = new Set(dirtyIds);
  const localList = getStoredMontajes();
  const toPush = localList.filter((m) => dirtySet.has(m.id));
  if (toPush.length === 0) {
    clearDirtyMontajeIds();
    return 0;
  }

  const res = await fetch("/api/db", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "SYNC_ALL_MONTAJES_TO_MYSQL",
      ordenes: toPush,
    }),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.ok) {
    throw new Error(json?.error || "Error al subir montajes pendientes a MySQL.");
  }

  clearDirtyMontajeIds(dirtyIds);
  if (Array.isArray(json.data) && json.data.length > 0) {
    const merged = mergeAndSaveCloudMontajes(json.data as OrdenMontajeReal[]);
    saveMontajes(merged);
  }
  return toPush.length;
}

export async function fetchMontajesFromMySQL(options?: {
  throwOnError?: boolean;
}): Promise<OrdenMontajeReal[]> {
  try {
    const res = await fetch("/api/db?module=montajes", { cache: "no-store" });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.ok) {
      throw new Error(json?.error || `Error MySQL (HTTP ${res.status})`);
    }
    if (Array.isArray(json.data) && json.data.length > 0) {
      const merged = mergeAndSaveCloudMontajes(json.data as OrdenMontajeReal[]);
      if (getDirtyMontajeIds().length > 0) {
        try {
          await pushPendingDirtyMontajes();
          return getStoredMontajes();
        } catch {
          return merged;
        }
      }
      return merged;
    }
  } catch (err) {
    console.warn("[MySQL Sync Montajes] Usando caché local:", err);
    if (options?.throwOnError) {
      throw err instanceof Error ? err : new Error("Error al conectar con MySQL.");
    }
  }
  return getStoredMontajes();
}

export function addMontaje(newOrden: OrdenMontajeReal): OrdenMontajeReal[] {
  const current = getStoredMontajes();
  const updated = [newOrden, ...current.filter((m) => m.id !== newOrden.id)];
  saveMontajes(updated);
  markDirtyMontajeId(newOrden.id);

  if (typeof window !== "undefined") {
    fetch("/api/db", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "ADD_MONTAJE", orden: newOrden }),
    })
      .then((res) => {
        if (res.ok) clearDirtyMontajeIds([newOrden.id]);
      })
      .catch((err) => console.error("[MySQL Error Add Montaje]", err));
  }

  return updated;
}

export async function addMontajeAsync(newOrden: OrdenMontajeReal): Promise<OrdenMontajeReal[]> {
  const current = getStoredMontajes();
  const updated = [newOrden, ...current.filter((m) => m.id !== newOrden.id)];
  saveMontajes(updated);
  markDirtyMontajeId(newOrden.id);

  if (typeof window !== "undefined") {
    try {
      const res = await fetch("/api/db", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "ADD_MONTAJE", orden: newOrden }),
      });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.ok) {
        clearDirtyMontajeIds([newOrden.id]);
        if (Array.isArray(json.catalogoSku)) {
          mergeAndSaveCloudSkuCatalog(json.catalogoSku as SkuCatalogItem[]);
        }
        if (Array.isArray(json.data) && json.data.length > 0) {
          saveMontajes(json.data);
          return json.data;
        }
      }
    } catch (err) {
      console.error("[MySQL Error Add Montaje]", err);
    }
  }

  return updated;
}

export function updateMontajeTecnico(id: string, tecnico: string): OrdenMontajeReal[] {
  const current = getStoredMontajes();
  const updated = current.map((ord) => (ord.id === id ? { ...ord, tecnico: tecnico as any } : ord));
  saveMontajes(updated);
  markDirtyMontajeId(id);

  if (typeof window !== "undefined") {
    fetch("/api/db", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "UPDATE_MONTAJE_TECNICO", id, tecnico }),
    })
      .then((res) => {
        if (res.ok) clearDirtyMontajeIds([id]);
      })
      .catch((err) => console.error("[MySQL Error Update Montaje Tecnico]", err));
  }

  return updated;
}

export function updateMontajeStage(
  id: string,
  etapa: "PENDIENTE_PIEZAS" | "ARMADO_MECANICO" | "ESTRES_TERMICO" | "LISTO_ENTREGA",
  progreso: number
): OrdenMontajeReal[] {
  const current = getStoredMontajes();
  const nextEstado: OrdenMontajeReal["estado"] = etapa === "LISTO_ENTREGA" ? "Rev. Cerrado" : "En Proceso";
  const updated: OrdenMontajeReal[] = current.map((ord): OrdenMontajeReal =>
    ord.id === id ? { ...ord, etapa, progreso, estado: ord.estado === "Entregado" ? "Entregado" : nextEstado } : ord
  );
  saveMontajes(updated);
  markDirtyMontajeId(id);

  if (typeof window !== "undefined") {
    fetch("/api/db", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "UPDATE_MONTAJE_STAGE", id, etapa, progreso }),
    })
      .then((res) => {
        if (res.ok) clearDirtyMontajeIds([id]);
      })
      .catch((err) => console.error("[MySQL Error Update Montaje Stage]", err));
  }

  return updated;
}

export function updateMontajeEstado(
  id: string,
  estado: "Entregado" | "Rev. Cerrado" | "En Proceso" | "Pendiente"
): OrdenMontajeReal[] {
  const current = getStoredMontajes();
  const isDelivered = estado === "Entregado";
  const updated = current.map((ord) =>
    ord.id === id
      ? {
          ...ord,
          estado,
          etapa: isDelivered ? ("LISTO_ENTREGA" as const) : ord.etapa,
          progreso: isDelivered ? 100 : ord.progreso,
        }
      : ord
  );
  saveMontajes(updated);
  markDirtyMontajeId(id);

  if (typeof window !== "undefined") {
    fetch("/api/db", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "UPDATE_MONTAJE_ESTADO", id, estado }),
    })
      .then((res) => {
        if (res.ok) clearDirtyMontajeIds([id]);
      })
      .catch((err) => console.error("[MySQL Error Update Montaje Estado]", err));
  }

  return updated;
}

export function resetMontajes(): OrdenMontajeReal[] {
  if (typeof window !== "undefined") {
    clearDirtyMontajeIds();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_MONTAJES_REALES));
    fetch("/api/db", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "RESET_MONTAJES" }),
    }).catch((err) => console.error("[MySQL Error Reset Montajes]", err));
  }
  return INITIAL_MONTAJES_REALES;
}

export async function syncMontajesToCloud(
  currentList?: OrdenMontajeReal[]
): Promise<{ data: OrdenMontajeReal[]; totalSubidos: number }> {
  const localList = currentList && currentList.length > 0 ? currentList : getStoredMontajes();
  const dirtyIds = new Set(getDirtyMontajeIds());

  // 1. Consultar estado actual en la nube para detectar faltantes o cambios pendientes
  const getRes = await fetch("/api/db?module=montajes", { cache: "no-store" });
  const getJson = await getRes.json().catch(() => null);
  if (!getRes.ok || !getJson?.ok) {
    throw new Error(getJson?.error || `No se pudo conectar con MySQL (HTTP ${getRes.status}).`);
  }

  const cloudList: OrdenMontajeReal[] = Array.isArray(getJson.data) ? getJson.data : [];
  const cloudIds = new Set(cloudList.map((m) => m.id));

  // Subir órdenes nuevas locales, órdenes modificadas (dirty) o todas si la nube aún no tiene registros
  const toUpload =
    cloudList.length === 0
      ? localList
      : localList.filter((m) => dirtyIds.has(m.id) || !cloudIds.has(m.id));

  if (toUpload.length > 0) {
    const postRes = await fetch("/api/db", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "SYNC_ALL_MONTAJES_TO_MYSQL",
        ordenes: toUpload,
      }),
    });
    const postJson = await postRes.json().catch(() => null);
    if (!postRes.ok || !postJson?.ok) {
      throw new Error(postJson?.error || "Error al guardar órdenes de montaje en MySQL.");
    }
    clearDirtyMontajeIds();
    const syncedData: OrdenMontajeReal[] = Array.isArray(postJson.data) && postJson.data.length > 0
      ? postJson.data
      : localList;
    saveMontajes(syncedData);
    syncVendedoresFromMontajes(syncedData);
    return { data: syncedData, totalSubidos: toUpload.length };
  }

  // Sin cambios locales pendientes: consolidar con lo último descargado desde MySQL
  clearDirtyMontajeIds();
  if (cloudList.length > 0) {
    saveMontajes(cloudList);
    syncVendedoresFromMontajes(cloudList);
    return { data: cloudList, totalSubidos: 0 };
  }

  return { data: localList, totalSubidos: 0 };
}

export interface CambioEstadoMontaje {
  id: string;
  nro_reg: string;
  cliente: string;
  accion: "ACTUALIZADA" | "NUEVA";
  estadoAnterior?: string;
  estadoNuevo: string;
  tecnico?: string;
}

export interface ResultadoCargaMontajesCSV {
  updatedList: OrdenMontajeReal[];
  totalFilasLeidas: number;
  totalActualizadas: number;
  totalNuevas: number;
  totalSinCambios: number;
  cambios: CambioEstadoMontaje[];
  toSyncToCloud: OrdenMontajeReal[];
}

function parseMontajesCSVText(csvText: string): string[][] {
  const cleanText = csvText.replace(/^\uFEFF/, "");
  const firstLineEnd = cleanText.indexOf("\n");
  const firstLine = firstLineEnd !== -1 ? cleanText.slice(0, firstLineEnd) : cleanText;
  const tabCount = (firstLine.match(/\t/g) || []).length;
  const semicolonCount = (firstLine.match(/;/g) || []).length;
  const commaCount = (firstLine.match(/,/g) || []).length;
  const delimiter =
    tabCount >= semicolonCount && tabCount >= commaCount && tabCount > 0
      ? "\t"
      : semicolonCount > commaCount
        ? ";"
        : ",";

  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = "";
  let inQuotes = false;

  for (let i = 0; i < cleanText.length; i++) {
    const char = cleanText[i];
    const nextChar = cleanText[i + 1];

    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        currentCell += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        currentCell += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === delimiter) {
      currentRow.push(currentCell.trim());
      currentCell = "";
    } else if (char === "\r" && nextChar === "\n") {
      currentRow.push(currentCell.trim());
      if (currentRow.some((cell) => cell !== "")) rows.push(currentRow);
      currentRow = [];
      currentCell = "";
      i++;
    } else if (char === "\n" || char === "\r") {
      currentRow.push(currentCell.trim());
      if (currentRow.some((cell) => cell !== "")) rows.push(currentRow);
      currentRow = [];
      currentCell = "";
    } else {
      currentCell += char;
    }
  }

  if (currentCell !== "" || currentRow.length > 0) {
    currentRow.push(currentCell.trim());
    if (currentRow.some((cell) => cell !== "")) rows.push(currentRow);
  }

  return rows;
}

function normalizeMontajeHeader(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function inferCategoriaComponente(desc: string, tipoServicio: "Montaje" | "Expansion"): ComponenteMontaje["categoria"] {
  const up = desc.toUpperCase();
  if (up.includes("NOTEBOOK") || up.startsWith("NB ")) return "NOTEBOOK";
  if (up.includes("CPU") || up.includes("RYZEN") || up.includes("CORE I") || up.includes("ULTRA ")) return "PROCESADOR";
  if (up.includes("MB ") || up.includes("PLACA") || up.includes("MOTHER")) return "PLACA_MADRE";
  if (up.includes("VGA") || up.includes("RTX") || up.includes("RADEON") || up.includes("GTX")) return "GPU";
  if (up.includes("MEM ") || up.includes("DDR4") || up.includes("DDR5") || up.includes("SODIMM") || up.includes("RAM")) return "RAM";
  if (up.includes("SSD") || up.includes("NVME") || up.includes("HDD") || up.includes("M.2")) return "ALMACENAMIENTO";
  if (up.includes("FUENTE") || up.includes("PSU")) return "FUENTE";
  if (up.includes("GABINETE") || up.includes("CASE")) return "GABINETE";
  if (up.includes("COOLER") || up.includes("LIQUID") || up.includes("FAN")) return "REFRIGERACION";
  return tipoServicio === "Expansion" ? "NOTEBOOK" : "OTROS";
}

function normalizeEstadoMontaje(raw: string): OrdenMontajeReal["estado"] {
  const low = raw.trim().toLowerCase();
  if (low.includes("entregad") || low.includes("retirad")) return "Entregado";
  if (low.includes("cerrad") || low.includes("terminad") || low.includes("finalizad") || low.includes("listo")) {
    return "Rev. Cerrado";
  }
  if (low.includes("pendiente") || low.includes("asignacion")) return "Pendiente";
  return "En Proceso";
}

function normalizeTecnicoMontaje(raw: string): OrdenMontajeReal["tecnico"] {
  const low = raw.trim().toLowerCase();
  if (low.includes("nicolas") || low.includes("solis")) return "Nicolas Solis";
  if (low.includes("magaly") || low.includes("yegros")) return "Magaly Yegros";
  if (low.includes("juan") || low.includes("ronnebeck")) return "Juan Ronnebeck";
  return "Sin Asignar";
}

function normalizeCanalMontaje(raw: string): OrdenMontajeReal["canal"] {
  const low = raw.trim().toLowerCase();
  if (low.includes("web") || low.includes("ecom")) return "Ecommerce - Web";
  if (low.includes("empres") || low.includes("corp")) return "Empresas / Coorporativo";
  return "Tienda";
}

export function procesarActualizacionMontajesCSV(
  csvText: string,
  currentList?: OrdenMontajeReal[]
): ResultadoCargaMontajesCSV {
  const baseList = currentList ? [...currentList] : [...getStoredMontajes()];
  const rows = parseMontajesCSVText(csvText);

  if (rows.length < 2) {
    return {
      updatedList: baseList,
      totalFilasLeidas: 0,
      totalActualizadas: 0,
      totalNuevas: 0,
      totalSinCambios: 0,
      cambios: [],
      toSyncToCloud: [],
    };
  }

  const headers = rows[0].map(normalizeMontajeHeader);
  const findCol = (aliases: string[]) =>
    headers.findIndex((h) => aliases.some((a) => h === a || h.includes(a)));

  const idxReg = findCol(["nroreg", "registro", "reginterno", "nroorden", "orden", "id"]);
  const idxIdExplicit = findCol(["idorden", "idmontaje"]);
  const idxCliente = findCol(["cliente", "razonsocial", "nombrecliente"]);
  const idxFechaFact = findCol(["fechafacturacion", "facturacion", "fechafact"]);
  const idxFechaMontaje = findCol(["fechamontaje", "fechaingreso", "fecha"]);
  const idxVendedor = findCol(["vendedor", "asesor", "comercial"]);
  const idxCanal = findCol(["canal", "origen"]);
  const idxEstado = findCol(["estado", "status", "situacion"]);
  const idxTipo = findCol(["tiposervicio", "modalidad", "servicio", "tipo"]);
  const idxCantidad = findCol(["cantidadequipos", "equipos", "cantidad"]);
  const idxTecnico = findCol(["tecnicoasignado", "tecnico", "responsable"]);
  const idxObs = findCol(["observaciones", "observacion", "detalle", "mensaje"]);
  const idxSku = findCol(["sku", "codigoproducto", "codigo"]);
  const idxDesc = findCol(["descripcion", "componente", "hardware", "producto", "equipo"]);
  const idxSerial = findCol(["seriales", "serial", "nroserie", "serie"]);

  // Agrupar filas CSV por registro u orden
  const grouped = new Map<
    string,
    {
      explicitId?: string;
      nro_reg: string;
      cliente: string;
      fecha_facturacion: string;
      fecha_montaje: string;
      vendedor: string;
      canalRaw: string;
      estadoRaw: string;
      tipoRaw: string;
      cantidadRaw: string;
      tecnicoRaw: string;
      observaciones: string;
      componentes: ComponenteMontaje[];
    }
  >();

  let totalFilasLeidas = 0;

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const regVal = (idxReg >= 0 ? r[idxReg] : idxIdExplicit >= 0 ? r[idxIdExplicit] : "").trim();
    const idExp = idxIdExplicit >= 0 ? (r[idxIdExplicit] || "").trim() : "";
    const clienteVal = idxCliente >= 0 ? (r[idxCliente] || "").trim() : "";

    if (!regVal && !idExp && !clienteVal) continue;
    totalFilasLeidas++;

    const cleanNum = (idExp || regVal).replace(/[^0-9A-Za-z-]/g, "") || `ROW${i}`;
    const groupKey = idExp || cleanNum;

    const descVal = idxDesc >= 0 ? (r[idxDesc] || "").trim() : "";
    const skuVal = idxSku >= 0 ? (r[idxSku] || "").trim() : "";
    const serialVal = idxSerial >= 0 ? (r[idxSerial] || "").trim() : "";

    if (!grouped.has(groupKey)) {
      grouped.set(groupKey, {
        explicitId: idExp || undefined,
        nro_reg: regVal || cleanNum,
        cliente: clienteVal || "Cliente NISSEI",
        fecha_facturacion: idxFechaFact >= 0 ? (r[idxFechaFact] || "").trim() : "",
        fecha_montaje: idxFechaMontaje >= 0 ? (r[idxFechaMontaje] || "").trim() : "",
        vendedor: idxVendedor >= 0 ? (r[idxVendedor] || "").trim() : "",
        canalRaw: idxCanal >= 0 ? (r[idxCanal] || "").trim() : "",
        estadoRaw: idxEstado >= 0 ? (r[idxEstado] || "").trim() : "",
        tipoRaw: idxTipo >= 0 ? (r[idxTipo] || "").trim() : "",
        cantidadRaw: idxCantidad >= 0 ? (r[idxCantidad] || "").trim() : "",
        tecnicoRaw: idxTecnico >= 0 ? (r[idxTecnico] || "").trim() : "",
        observaciones: idxObs >= 0 ? (r[idxObs] || "").trim() : "",
        componentes: [],
      });
    }

    const entry = grouped.get(groupKey)!;
    if (descVal) {
      const inferredTipo: "Montaje" | "Expansion" = entry.tipoRaw.toLowerCase().includes("expan")
        ? "Expansion"
        : "Montaje";
      entry.componentes.push({
        sku: skuVal || `SKU-${cleanNum}`,
        descripcion: descVal,
        seriales: serialVal || "Sin serial visible",
        categoria: inferCategoriaComponente(descVal, inferredTipo),
      });
    }
  }

  const byId = new Map<string, OrdenMontajeReal>(baseList.map((m) => [m.id, m]));
  const byCleanReg = new Map<string, OrdenMontajeReal>();
  baseList.forEach((m) => {
    const cr = (m.nro_reg || "").replace(/\D/g, "");
    if (cr) byCleanReg.set(cr, m);
  });

  const cambios: CambioEstadoMontaje[] = [];
  const updatedMap = new Map<string, OrdenMontajeReal>(baseList.map((m) => [m.id, m]));
  const toSyncToCloud: OrdenMontajeReal[] = [];
  let totalActualizadas = 0;
  let totalNuevas = 0;
  let totalSinCambios = 0;

  const todayDisplay = new Date().toLocaleDateString("es-PY", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  for (const [, g] of grouped.entries()) {
    const cleanDigits = (g.nro_reg || "").replace(/\D/g, "");
    const tipoServicio: "Montaje" | "Expansion" = g.tipoRaw.toLowerCase().includes("expan")
      ? "Expansion"
      : "Montaje";
    const generatedId =
      g.explicitId || `${tipoServicio === "Expansion" ? "EXP" : "MNT"}-${cleanDigits || g.nro_reg}`;

    const existing =
      byId.get(generatedId) ||
      (cleanDigits ? byCleanReg.get(cleanDigits) : undefined);

    if (existing) {
      const newEstado = g.estadoRaw ? normalizeEstadoMontaje(g.estadoRaw) : existing.estado;
      const newTecnico = g.tecnicoRaw ? normalizeTecnicoMontaje(g.tecnicoRaw) : existing.tecnico;
      const isDelivered = newEstado === "Entregado";
      const isClosed = newEstado === "Rev. Cerrado";
      const nextEtapa: OrdenMontajeReal["etapa"] =
        isDelivered || isClosed ? "LISTO_ENTREGA" : existing.etapa;
      const nextProgreso = isDelivered || isClosed ? 100 : existing.progreso;

      const changedEstado = newEstado !== existing.estado;
      const changedTecnico = Boolean(g.tecnicoRaw && newTecnico !== existing.tecnico && newTecnico !== "Sin Asignar");
      const changedComps = g.componentes.length > existing.componentes.length;
      const changedObs = Boolean(g.observaciones && g.observaciones !== existing.observaciones);

      if (changedEstado || changedTecnico || changedComps || changedObs) {
        const mergedOrder: OrdenMontajeReal = {
          ...existing,
          cliente: g.cliente && g.cliente !== "Cliente NISSEI" ? g.cliente : existing.cliente,
          vendedor: g.vendedor || existing.vendedor,
          canal: g.canalRaw ? normalizeCanalMontaje(g.canalRaw) : existing.canal,
          estado: newEstado,
          tecnico: changedTecnico ? newTecnico : existing.tecnico,
          etapa: nextEtapa,
          progreso: nextProgreso,
          observaciones: g.observaciones || existing.observaciones,
          componentes: changedComps ? g.componentes : existing.componentes,
        };
        updatedMap.set(existing.id, mergedOrder);
        toSyncToCloud.push(mergedOrder);
        totalActualizadas++;
        cambios.push({
          id: existing.id,
          nro_reg: existing.nro_reg,
          cliente: mergedOrder.cliente,
          accion: "ACTUALIZADA",
          estadoAnterior: existing.estado,
          estadoNuevo: mergedOrder.estado,
          tecnico: mergedOrder.tecnico,
        });
      } else {
        totalSinCambios++;
      }
    } else {
      const estadoNuevo = g.estadoRaw ? normalizeEstadoMontaje(g.estadoRaw) : "En Proceso";
      const tecnicoNuevo = g.tecnicoRaw ? normalizeTecnicoMontaje(g.tecnicoRaw) : "Sin Asignar";
      const isDone = estadoNuevo === "Entregado" || estadoNuevo === "Rev. Cerrado";
      const newOrder: OrdenMontajeReal = {
        id: generatedId,
        nro_reg: g.nro_reg,
        cliente: g.cliente,
        fecha_facturacion: g.fecha_facturacion || todayDisplay,
        fecha_montaje: g.fecha_montaje || todayDisplay,
        vendedor: g.vendedor || "Salón CDE",
        canal: g.canalRaw ? normalizeCanalMontaje(g.canalRaw) : "Tienda",
        estado: estadoNuevo,
        tipo_servicio: tipoServicio,
        cantidadEquipos: Math.max(1, parseInt(g.cantidadRaw, 10) || 1),
        tecnico: tecnicoNuevo,
        etapa: isDone ? "LISTO_ENTREGA" : "ARMADO_MECANICO",
        progreso: isDone ? 100 : 35,
        prioridad: "NORMAL",
        consumoEstimado: tipoServicio === "Montaje" ? "450W" : undefined,
        observaciones: g.observaciones || "",
        componentes: g.componentes,
      };
      updatedMap.set(newOrder.id, newOrder);
      toSyncToCloud.push(newOrder);
      totalNuevas++;
      cambios.push({
        id: newOrder.id,
        nro_reg: newOrder.nro_reg,
        cliente: newOrder.cliente,
        accion: "NUEVA",
        estadoNuevo: newOrder.estado,
        tecnico: newOrder.tecnico,
      });
    }
  }

  return {
    updatedList: Array.from(updatedMap.values()),
    totalFilasLeidas,
    totalActualizadas,
    totalNuevas,
    totalSinCambios,
    cambios,
    toSyncToCloud,
  };
}

export async function sincronizarMontajesCsvOnline(
  csvText: string,
  currentList?: OrdenMontajeReal[]
): Promise<ResultadoCargaMontajesCSV> {
  // 1. Obtener siempre primero la base viva en MySQL para cruzar contra la verdad de la nube en cualquier máquina
  let cloudBase: OrdenMontajeReal[] = currentList && currentList.length > 0 ? currentList : getStoredMontajes();
  const dirtyBefore = new Set(getDirtyMontajeIds());

  if (typeof window !== "undefined") {
    const getRes = await fetch("/api/db?module=montajes", { cache: "no-store" });
    const getJson = await getRes.json().catch(() => null);
    if (!getRes.ok || !getJson?.ok) {
      throw new Error(
        getJson?.error || "No se pudo conectar con MySQL en la nube antes de procesar el CSV."
      );
    }
    if (Array.isArray(getJson.data) && getJson.data.length > 0) {
      cloudBase = mergeAndSaveCloudMontajes(getJson.data as OrdenMontajeReal[]);
    }
  }

  const resultado = procesarActualizacionMontajesCSV(csvText, cloudBase);

  if (resultado.totalFilasLeidas === 0) {
    throw new Error(
      "No se detectaron órdenes válidas en el archivo CSV. Verifique que contenga columnas de Registro / Cliente."
    );
  }

  saveMontajes(resultado.updatedList);
  syncVendedoresFromMontajes(resultado.updatedList);

  if (typeof window !== "undefined") {
    const extraDirty = resultado.updatedList.filter(
      (m) => dirtyBefore.has(m.id) && !resultado.toSyncToCloud.some((s) => s.id === m.id)
    );
    const ordenesParaSubir = [...resultado.toSyncToCloud, ...extraDirty];

    if (ordenesParaSubir.length > 0) {
      const resp = await fetch("/api/db", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "BULK_UPDATE_MONTAJES_CSV",
          ordenes: ordenesParaSubir,
        }),
      });
      const json = await resp.json().catch(() => null);
      if (!resp.ok || !json?.ok) {
        throw new Error(json?.error || "Error al subir el CSV de montajes a MySQL en la nube.");
      }
      clearDirtyMontajeIds();
      if (Array.isArray(json.catalogoSku)) {
        mergeAndSaveCloudSkuCatalog(json.catalogoSku as SkuCatalogItem[]);
      }
      if (Array.isArray(json.data) && json.data.length > 0) {
        saveMontajes(json.data);
        syncVendedoresFromMontajes(json.data);
        return { ...resultado, updatedList: json.data };
      }
    }
  }

  return resultado;
}

// ============================================================================
// CATÁLOGO DINÁMICO DE SKUs (PERSISTIDO EN MYSQL + APRENDIZAJE DE ÓRDENES + CSV)
// ============================================================================

export interface SkuCatalogItem {
  sku: string;
  upc?: string;
  descripcion: string;
  categoria: ComponenteMontaje["categoria"];
  fuente?: "OFICIAL" | "ORDEN" | "MANUAL" | "CSV";
  updated_at?: string;
}

export const SKU_CATALOG_STORAGE_KEY = "nissei_catalogo_sku_v1";

const VALID_COMPONENT_CATEGORIES: ComponenteMontaje["categoria"][] = [
  "PROCESADOR",
  "PLACA_MADRE",
  "RAM",
  "GPU",
  "ALMACENAMIENTO",
  "FUENTE",
  "GABINETE",
  "REFRIGERACION",
  "NOTEBOOK",
  "OTROS",
];

/**
 * Determina si un código SKU es real y reutilizable en el catálogo
 * (descarta placeholders autogenerados tipo SKU-XXXXXX o sin código).
 */
export function isRealSku(sku: string | undefined | null): boolean {
  const clean = String(sku || "").trim();
  if (clean.length < 2) return false;
  if (/^SKU-\d{5,7}$/i.test(clean)) return false;
  if (/^(n\/a|s\/n|na|sin\s*sku|-+)$/i.test(clean)) return false;
  return true;
}

/**
 * Normaliza un código UPC/EAN descartando placeholders inválidos.
 */
export function normalizeUpcCode(upc: string | undefined | null): string {
  const clean = String(upc || "").trim();
  if (clean.length < 4) return "";
  if (/^(n\/a|s\/n|na|sin\s*upc|-+)$/i.test(clean)) return "";
  return clean;
}

/**
 * Busca en el catálogo un SKU cuyo UPC coincida exactamente o por equivalencia UPC-A (12 dígitos) / EAN-13 (0 + 12 dígitos).
 */
export function findSkuByUpc(
  catalog: SkuCatalogItem[],
  rawUpc: string | undefined | null
): SkuCatalogItem | undefined {
  const clean = normalizeUpcCode(rawUpc);
  if (!clean) return undefined;

  const lower = clean.toLowerCase();
  const exact = catalog.find(
    (c) => normalizeUpcCode(c.upc).toLowerCase() === lower
  );
  if (exact) return exact;

  if (/^\d{12,13}$/.test(clean)) {
    const padded = clean.padStart(13, "0");
    return catalog.find((c) => {
      const candidate = normalizeUpcCode(c.upc);
      return /^\d{12,13}$/.test(candidate) && candidate.padStart(13, "0") === padded;
    });
  }

  return undefined;
}

export function normalizeCategoriaSku(
  rawCat: string | undefined,
  descripcion: string,
  fallbackTipo: "Montaje" | "Expansion" = "Montaje"
): ComponenteMontaje["categoria"] {
  const upper = String(rawCat || "").trim().toUpperCase().replace(/\s+/g, "_");
  if ((VALID_COMPONENT_CATEGORIES as string[]).includes(upper)) {
    return upper as ComponenteMontaje["categoria"];
  }
  if (upper.includes("PROC") || upper === "CPU") return "PROCESADOR";
  if (upper.includes("PLACA") || upper.includes("MOTHER") || upper === "MB") return "PLACA_MADRE";
  if (upper.includes("RAM") || upper.includes("MEM")) return "RAM";
  if (upper.includes("GPU") || upper.includes("VGA") || upper.includes("VIDEO") || upper.includes("GRAFICA")) return "GPU";
  if (upper.includes("ALM") || upper.includes("SSD") || upper.includes("HDD") || upper.includes("NVME") || upper.includes("DISCO")) return "ALMACENAMIENTO";
  if (upper.includes("FUENTE") || upper === "PSU") return "FUENTE";
  if (upper.includes("GAB") || upper === "CASE") return "GABINETE";
  if (upper.includes("REFRIG") || upper.includes("COOLER") || upper.includes("LIQ")) return "REFRIGERACION";
  if (upper.includes("NOTE") || upper === "NB" || upper.includes("LAPTOP")) return "NOTEBOOK";
  return inferCategoriaComponente(descripcion, fallbackTipo);
}

/**
 * Extrae todos los SKUs reales utilizados en órdenes históricas o recientes de montaje.
 */
export function extractSkusFromOrders(orders: OrdenMontajeReal[]): SkuCatalogItem[] {
  const extracted: SkuCatalogItem[] = [];
  for (const ord of orders) {
    if (!Array.isArray(ord.componentes)) continue;
    for (const c of ord.componentes) {
      const sku = String(c.sku || "").trim();
      const desc = String(c.descripcion || "").trim();
      const upc = normalizeUpcCode(c.upc);
      if (!isRealSku(sku) || !desc) continue;
      extracted.push({
        sku,
        ...(upc ? { upc } : {}),
        descripcion: desc,
        categoria: normalizeCategoriaSku(c.categoria, desc, ord.tipo_servicio === "Expansion" ? "Expansion" : "Montaje"),
        fuente: "ORDEN",
      });
    }
  }
  return extracted;
}

/**
 * Unifica múltiples listas de SKUs conservando un único registro por SKU (case-insensitive).
 * Las listas posteriores tienen mayor prioridad para enriquecer descripción/categoría/UPC.
 */
export function mergeSkuCatalogItems(...lists: SkuCatalogItem[][]): SkuCatalogItem[] {
  const map = new Map<string, SkuCatalogItem>();
  for (const list of lists) {
    if (!Array.isArray(list)) continue;
    for (const item of list) {
      const sku = String(item?.sku || "").trim();
      const desc = String(item?.descripcion || "").trim();
      if (!isRealSku(sku) || !desc) continue;
      const key = sku.toLowerCase();
      const existing = map.get(key);
      const upc = normalizeUpcCode(item?.upc) || normalizeUpcCode(existing?.upc);
      map.set(key, {
        sku: existing?.sku || sku,
        ...(upc ? { upc } : {}),
        descripcion: desc || existing?.descripcion || "",
        categoria: normalizeCategoriaSku(item.categoria, desc),
        fuente: item.fuente || existing?.fuente || "OFICIAL",
        updated_at: item.updated_at || existing?.updated_at,
      });
    }
  }
  return Array.from(map.values());
}

const OFFICIAL_SKU_ITEMS: SkuCatalogItem[] = CATALOGO_HARDWARE_REAL.map((c) => ({
  sku: c.sku,
  descripcion: c.descripcion,
  categoria: c.categoria,
  fuente: "OFICIAL",
}));

export function getStoredSkuCatalog(): SkuCatalogItem[] {
  const fromOrders = extractSkusFromOrders([
    ...INITIAL_MONTAJES_REALES,
    ...(typeof window !== "undefined" ? getStoredMontajes() : []),
  ]);
  if (typeof window === "undefined") {
    return mergeSkuCatalogItems(OFFICIAL_SKU_ITEMS, fromOrders);
  }
  try {
    const raw = localStorage.getItem(SKU_CATALOG_STORAGE_KEY);
    const localItems: SkuCatalogItem[] = raw ? JSON.parse(raw) : [];
    return mergeSkuCatalogItems(OFFICIAL_SKU_ITEMS, fromOrders, Array.isArray(localItems) ? localItems : []);
  } catch {
    return mergeSkuCatalogItems(OFFICIAL_SKU_ITEMS, fromOrders);
  }
}

export function saveSkuCatalog(items: SkuCatalogItem[]): void {
  if (typeof window === "undefined") return;
  try {
    const merged = mergeSkuCatalogItems(OFFICIAL_SKU_ITEMS, items);
    localStorage.setItem(SKU_CATALOG_STORAGE_KEY, JSON.stringify(merged));
  } catch (err) {
    console.warn("Error guardando catálogo de SKU en localStorage:", err);
  }
}

export function mergeAndSaveCloudSkuCatalog(cloudItems: SkuCatalogItem[]): SkuCatalogItem[] {
  const current = getStoredSkuCatalog();
  const merged = mergeSkuCatalogItems(current, cloudItems);
  saveSkuCatalog(merged);
  return merged;
}

export async function fetchSkuCatalogFromMySQL(): Promise<SkuCatalogItem[]> {
  const fallback = getStoredSkuCatalog();
  if (typeof window === "undefined") return fallback;
  try {
    const res = await fetch("/api/db?module=catalogo_sku", { cache: "no-store" });
    const json = await res.json().catch(() => null);
    if (res.ok && json?.ok && Array.isArray(json.data)) {
      return mergeAndSaveCloudSkuCatalog(json.data as SkuCatalogItem[]);
    }
  } catch (err) {
    console.warn("[MySQL Sync SKU] Usando caché local:", err);
  }
  return fallback;
}

/**
 * Guarda uno o más SKUs nuevos/actualizados localmente y los sincroniza hacia MySQL (`catalogo_sku`).
 */
export async function saveSkusToCatalogOnline(
  items: SkuCatalogItem[]
): Promise<{ ok: boolean; items: SkuCatalogItem[]; totalGuardados: number; error?: string }> {
  const validItems = items
    .map((it) => {
      const upc = normalizeUpcCode(it.upc);
      return {
        sku: String(it.sku || "").trim(),
        ...(upc ? { upc } : {}),
        descripcion: String(it.descripcion || "").trim(),
        categoria: normalizeCategoriaSku(it.categoria, String(it.descripcion || "")),
        fuente: it.fuente || ("MANUAL" as const),
      };
    })
    .filter((it) => isRealSku(it.sku) && it.descripcion.length > 0);

  if (validItems.length === 0) {
    return {
      ok: false,
      items: getStoredSkuCatalog(),
      totalGuardados: 0,
      error: "No se detectaron SKUs válidos para guardar.",
    };
  }

  const mergedLocal = mergeSkuCatalogItems(getStoredSkuCatalog(), validItems);
  saveSkuCatalog(mergedLocal);

  if (typeof window === "undefined") {
    return { ok: true, items: mergedLocal, totalGuardados: validItems.length };
  }

  try {
    const res = await fetch("/api/db", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "UPSERT_CATALOGO_SKU",
        items: validItems,
      }),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.ok) {
      return {
        ok: false,
        items: mergedLocal,
        totalGuardados: validItems.length,
        error: json?.error || "No se pudo sincronizar el SKU con MySQL.",
      };
    }
    const cloudMerged = Array.isArray(json.data)
      ? mergeAndSaveCloudSkuCatalog(json.data as SkuCatalogItem[])
      : mergedLocal;
    return {
      ok: true,
      items: cloudMerged,
      totalGuardados: Number(json.totalGuardados ?? validItems.length),
    };
  } catch (err) {
    return {
      ok: false,
      items: mergedLocal,
      totalGuardados: validItems.length,
      error: err instanceof Error ? err.message : "Error de red guardando SKU en MySQL.",
    };
  }
}

/**
 * Parsea un CSV, TSV o lista pegada con columnas de SKU, Descripción y Categoría (opcional).
 * Soporta tanto archivos con cabecera como listas directas sin encabezado.
 */
export function parseSkuImportText(rawText: string): SkuCatalogItem[] {
  const rows = parseMontajesCSVText(rawText);
  if (rows.length === 0) return [];

  const firstHeaders = rows[0].map(normalizeMontajeHeader);
  const idxSkuH = firstHeaders.findIndex((h) => h === "sku" || h === "codigo" || h === "codigoproducto" || h === "cod");
  const idxUpcH = firstHeaders.findIndex((h) => h === "upc" || h === "ean" || h === "gtin" || h === "codigobarras" || h === "barcode");
  const idxDescH = firstHeaders.findIndex((h) => h.includes("desc") || h.includes("producto") || h.includes("hardware") || h.includes("nombre") || h.includes("equipo"));
  const idxCatH = firstHeaders.findIndex((h) => h.includes("categ") || h === "tipo" || h === "rubro");

  const hasHeader = idxSkuH !== -1 && idxDescH !== -1;
  const startIdx = hasHeader ? 1 : 0;
  const idxSku = hasHeader ? idxSkuH : 0;
  const idxDesc = hasHeader ? idxDescH : 1;
  const idxCat = hasHeader ? idxCatH : 2;
  const idxUpc = hasHeader ? idxUpcH : 3;

  const parsed: SkuCatalogItem[] = [];
  for (let i = startIdx; i < rows.length; i++) {
    const cells = rows[i];
    if (cells.length < 2) continue;
    const sku = (cells[idxSku] || "").trim();
    const descripcion = (cells[idxDesc] || "").trim();
    const rawCat = idxCat >= 0 ? (cells[idxCat] || "").trim() : "";
    const upc = idxUpc >= 0 ? normalizeUpcCode(cells[idxUpc]) : "";
    if (!isRealSku(sku) || !descripcion) continue;

    parsed.push({
      sku,
      ...(upc ? { upc } : {}),
      descripcion,
      categoria: normalizeCategoriaSku(rawCat, descripcion),
      fuente: "CSV",
    });
  }

  return mergeSkuCatalogItems(parsed);
}

export const MONTAJES_WHATSAPP_GROUP_ID = "GRUPO_MONTAJES_SATI";

export function formatMontajeWhatsAppMessage(params: {
  cliente: string;
  nro_reg: string;
  vendedor: string;
  canal: string;
  tipo_servicio: "Montaje" | "Expansion";
  cantidadEquipos: number;
  tecnico: string;
  prioridad: string;
  fecha_montaje: string;
  componentes: ComponenteMontaje[];
  observaciones?: string;
}): string {
  const cant = Math.max(1, Number(params.cantidadEquipos) || 1);
  const clienteNombre = (params.cliente || "").trim() || "Cliente Sin Asignar";
  const servicioNombre =
    params.tipo_servicio === "Montaje"
      ? "Montaje de PC Completa"
      : "Expansión / Upgrade de Notebook";

  // Formatear fecha prometida a formato local DD/MM/AAAA si viene en YYYY-MM-DD
  const rawFecha = params.fecha_montaje || "";
  const partsFecha = rawFecha.split("-");
  const fechaFormateada =
    partsFecha.length === 3 && partsFecha[0].length === 4
      ? `${partsFecha[2]}/${partsFecha[1]}/${partsFecha[0]}`
      : rawFecha || "A definir";

  // Formato visual y ordenado para la prioridad operativa
  const prioUpper = (params.prioridad || "NORMAL").toUpperCase();
  const prioBadge =
    prioUpper === "URGENTE"
      ? "🔴 URGENTE (Despacho en el día)"
      : prioUpper === "EXPRESS"
      ? "🟡 EXPRESS (Prioridad 24h)"
      : "🟢 NORMAL (Cola estándar 48h)";

  // Lista de componentes limpia: sin números de serie, agrupada con categoría y SKU
  const compCount = params.componentes?.length || 0;
  const compText = (params.componentes || [])
    .map((c) => {
      const catLabel = (c.categoria || "ITEM").replace(/_/g, " ").toUpperCase();
      const skuLabel = c.sku ? `(SKU: ${c.sku})` : "";
      return `  ▫️ [${catLabel}] ${c.descripcion} ${skuLabel}`.trimEnd();
    })
    .join("\n");

  const obs = (params.observaciones || "").trim();

  return `🛠️ *NISSEI TALLER DE MONTAJES · NUEVO INGRESO*
Se ha registrado el ingreso a taller para el cliente *${clienteNombre}*:

📋 *Nro. Registro / Interno:* ${params.nro_reg || "Pendiente"}
👤 *Cliente:* ${clienteNombre}
💼 *Vendedor Responsable:* ${params.vendedor || "No asignado"} (${params.canal || "Tienda"})
⚙️ *Servicio:* ${servicioNombre}
📦 *Cantidad:* ${cant} ${cant === 1 ? "equipo" : "equipos"}
👨‍🔧 *Técnico Asignado:* ${params.tecnico || "Taller de Laboratorio"}
⚡ *Prioridad:* ${prioBadge}
📅 *Fecha Prometida de Entrega:* ${fechaFormateada}

🧩 *Componentes de Hardware (${compCount} ${compCount === 1 ? "pieza" : "piezas"}):*
${compText || "  (Sin componentes cargados aún)"}${
    obs
      ? `\n\n📝 *Observaciones / Instrucciones del Vendedor:*\n${obs}`
      : ""
  }`;
}
