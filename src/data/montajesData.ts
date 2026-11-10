// Base de datos oficial de Órdenes de Montaje & Ensambles de PC NISSEI CDE
// Construida a partir de la tabla real de servicios y componentes de taller

export interface ComponenteMontaje {
  sku: string;
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
  tecnico: "Nicolas Solis" | "Magaly Yegros" | "Juan Ronnebeck" | "Sin Asignar";
  etapa: "PENDIENTE_PIEZAS" | "ARMADO_MECANICO" | "ESTRES_TERMICO" | "LISTO_ENTREGA";
  progreso: number;
  prioridad: "NORMAL" | "EXPRESS" | "URGENTE";
  consumoEstimado?: string;
  observaciones: string;
  componentes: ComponenteMontaje[];
}

export const LISTA_VENDEDORES_REALES = [
  "Helen Rivarola",
  "Diego Vera",
  "Fabiola Patiño",
  "Sabrina Bogarin",
  "Emilio Lopez",
  "Kamila Guarie",
  "Camila Fleytas",
  "Guillermo Perez",
  "Ruth Rolon",
  "Matias Fleitas",
  "Jose Gomez",
  "Ecommerce - Web",
  "Sebastian Alcaraz",
  "Patricia Martinez"
];

export const VENDEDORES_STORAGE_KEY = "nissei_vendedores_montajes_v1";

export function getStoredVendedores(): string[] {
  if (typeof window === "undefined") return LISTA_VENDEDORES_REALES;
  try {
    const raw = localStorage.getItem(VENDEDORES_STORAGE_KEY);
    if (!raw) return LISTA_VENDEDORES_REALES;
    const list = JSON.parse(raw);
    if (Array.isArray(list) && list.length > 0) {
      const merged = Array.from(new Set([...LISTA_VENDEDORES_REALES, ...list]));
      return merged;
    }
  } catch (e) {
    console.warn("Error leyendo vendedores de localStorage:", e);
  }
  return LISTA_VENDEDORES_REALES;
}

export function addCustomVendedor(nuevoVendedor: string): string[] {
  const clean = nuevoVendedor.trim();
  if (!clean || clean.toUpperCase() === "OTRO") return getStoredVendedores();
  const current = getStoredVendedores();
  const exists = current.some((v) => v.toLowerCase() === clean.toLowerCase());
  if (!exists) {
    const updated = [...current, clean];
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(VENDEDORES_STORAGE_KEY, JSON.stringify(updated));
      } catch (e) {
        console.warn("Error guardando nuevo vendedor:", e);
      }
    }
    return updated;
  }
  return current;
}

// Técnicos responsables oficiales (solo nombres sin bancos)
export const LISTA_TECNICOS_MONTAJE = [
  "Nicolas Solis",
  "Magaly Yegros",
  "Juan Ronnebeck"
] as const;

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

const STORAGE_KEY = "nissei_taller_montajes_v4_real";

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

export async function fetchMontajesFromMySQL(): Promise<OrdenMontajeReal[]> {
  try {
    const res = await fetch("/api/db?module=montajes", { cache: "no-store" });
    const json = await res.json();
    if (json.ok && Array.isArray(json.data) && json.data.length > 0) {
      saveMontajes(json.data);
      return json.data;
    }
  } catch (err) {
    console.warn("[MySQL Sync Montajes] Usando caché local:", err);
  }
  return getStoredMontajes();
}

export function addMontaje(newOrden: OrdenMontajeReal): OrdenMontajeReal[] {
  const current = getStoredMontajes();
  const updated = [newOrden, ...current];
  saveMontajes(updated);

  if (typeof window !== "undefined") {
    fetch("/api/db", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "ADD_MONTAJE", orden: newOrden }),
    }).catch((err) => console.error("[MySQL Error Add Montaje]", err));
  }

  return updated;
}

export function updateMontajeTecnico(id: string, tecnico: string): OrdenMontajeReal[] {
  const current = getStoredMontajes();
  const updated = current.map((ord) => (ord.id === id ? { ...ord, tecnico: tecnico as any } : ord));
  saveMontajes(updated);

  if (typeof window !== "undefined") {
    fetch("/api/db", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "UPDATE_MONTAJE_TECNICO", id, tecnico }),
    }).catch((err) => console.error("[MySQL Error Update Montaje Tecnico]", err));
  }

  return updated;
}

export function updateMontajeStage(
  id: string,
  etapa: "PENDIENTE_PIEZAS" | "ARMADO_MECANICO" | "ESTRES_TERMICO" | "LISTO_ENTREGA",
  progreso: number
): OrdenMontajeReal[] {
  const current = getStoredMontajes();
  const updated = current.map((ord) => (ord.id === id ? { ...ord, etapa, progreso } : ord));
  saveMontajes(updated);

  if (typeof window !== "undefined") {
    fetch("/api/db", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "UPDATE_MONTAJE_STAGE", id, etapa, progreso }),
    }).catch((err) => console.error("[MySQL Error Update Montaje Stage]", err));
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

  if (typeof window !== "undefined") {
    fetch("/api/db", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "UPDATE_MONTAJE_ESTADO", id, estado }),
    }).catch((err) => console.error("[MySQL Error Update Montaje Estado]", err));
  }

  return updated;
}

export function resetMontajes(): OrdenMontajeReal[] {
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_MONTAJES_REALES));
    fetch("/api/db", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "RESET_MONTAJES" }),
    }).catch((err) => console.error("[MySQL Error Reset Montajes]", err));
  }
  return INITIAL_MONTAJES_REALES;
}
