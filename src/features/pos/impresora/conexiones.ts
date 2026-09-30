/**
 * Conexion directa con la impresora de tickets, sin la ventana de impresion:
 *
 *   bluetooth  Web Bluetooth (BLE): Chrome en Android, Windows y Mac.
 *   serie      Web Serial: Bluetooth clasico emparejado (puerto COM) o
 *              USB-serie, en Chrome/Edge de escritorio.
 *   usb        WebUSB, clase impresora: Android, Mac y Linux. En Windows el
 *              driver de la impresora lo impide (ver la guia del dialogo).
 *
 * Safari (iPhone/iPad) no tiene ninguna de las tres: ahi sigue la ventana de
 * impresion de siempre.
 *
 * Los tipos de estas API no vienen con TypeScript; se declaran aqui los
 * minimos que se usan, sin tipos globales ni dependencias nuevas.
 */

export type TipoConexion = "bluetooth" | "serie" | "usb";

export interface Conexion {
  tipo: TipoConexion;
  nombre: string;
  escribir: (datos: Uint8Array) => Promise<void>;
  cerrar: () => Promise<void>;
}

// --- Tipos minimos -----------------------------------------------------------

interface BtCaracteristica {
  properties: { write: boolean; writeWithoutResponse: boolean };
  writeValueWithoutResponse?: (d: Uint8Array) => Promise<void>;
  writeValueWithResponse?: (d: Uint8Array) => Promise<void>;
  writeValue: (d: Uint8Array) => Promise<void>;
}
interface BtServicio {
  getCharacteristics: () => Promise<BtCaracteristica[]>;
}
interface BtServidor {
  connected: boolean;
  getPrimaryServices: () => Promise<BtServicio[]>;
  disconnect: () => void;
}
interface BtDispositivo {
  id: string;
  name?: string;
  gatt?: { connect: () => Promise<BtServidor>; connected: boolean };
}
interface ApiBluetooth {
  requestDevice: (opciones: unknown) => Promise<BtDispositivo>;
  getDevices?: () => Promise<BtDispositivo[]>;
}

interface PuertoSerie {
  open: (o: { baudRate: number }) => Promise<void>;
  close: () => Promise<void>;
  writable: WritableStream<Uint8Array> | null;
  getInfo: () => { usbVendorId?: number; bluetoothServiceClassId?: number | string };
}
interface ApiSerie {
  requestPort: (o?: unknown) => Promise<PuertoSerie>;
  getPorts: () => Promise<PuertoSerie[]>;
}

interface UsbEndpoint {
  endpointNumber: number;
  direction: "in" | "out";
  type: string;
}
interface UsbInterfaz {
  interfaceNumber: number;
  alternate: { interfaceClass: number; endpoints: UsbEndpoint[] };
}
interface UsbDispositivo {
  productName?: string;
  opened: boolean;
  configuration: { interfaces: UsbInterfaz[] } | null;
  open: () => Promise<void>;
  close: () => Promise<void>;
  selectConfiguration: (n: number) => Promise<void>;
  claimInterface: (n: number) => Promise<void>;
  transferOut: (endpoint: number, datos: Uint8Array) => Promise<unknown>;
}
interface ApiUsb {
  requestDevice: (o: unknown) => Promise<UsbDispositivo>;
  getDevices: () => Promise<UsbDispositivo[]>;
}

const nav = () =>
  (typeof navigator === "undefined" ? {} : navigator) as {
    bluetooth?: ApiBluetooth;
    serial?: ApiSerie;
    usb?: ApiUsb;
  };

/** Que conexiones soporta ESTE navegador. */
export function conexionesDisponibles(): TipoConexion[] {
  const n = nav();
  const tipos: TipoConexion[] = [];
  if (n.bluetooth) tipos.push("bluetooth");
  if (n.serial) tipos.push("serie");
  if (n.usb) tipos.push("usb");
  return tipos;
}

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

// --- Bluetooth ----------------------------------------------------------------

/** Servicios de las termicas BLE mas comunes (genericas chinas, Xprinter, Epson...). */
const SERVICIOS_IMPRESORA = [
  0x18f0,
  0xff00,
  0xffe0,
  0xae30,
  0xfee7,
  "e7810a71-73ae-499d-8c15-faa9aef0c3f2",
  "49535343-fe7d-4ae5-8fa9-9fafd205e455",
  "0000ff00-0000-1000-8000-00805f9b34fb",
];
const BLOQUE_BLE = 180;

async function abrirBluetooth(dispositivo: BtDispositivo): Promise<Conexion> {
  if (!dispositivo.gatt) throw new Error("El dispositivo no admite Bluetooth LE");
  const servidor = await dispositivo.gatt.connect();
  let caracteristica: BtCaracteristica | null = null;
  for (const servicio of await servidor.getPrimaryServices()) {
    for (const c of await servicio.getCharacteristics()) {
      if (c.properties.writeWithoutResponse || c.properties.write) {
        caracteristica = c;
        break;
      }
    }
    if (caracteristica) break;
  }
  if (!caracteristica) {
    servidor.disconnect();
    throw new Error("La impresora no expone un canal de escritura");
  }
  const c = caracteristica;
  return {
    tipo: "bluetooth",
    nombre: dispositivo.name || "Impresora Bluetooth",
    escribir: async (datos) => {
      if (!servidor.connected) await dispositivo.gatt?.connect();
      for (let i = 0; i < datos.length; i += BLOQUE_BLE) {
        const bloque = datos.slice(i, i + BLOQUE_BLE);
        if (c.properties.writeWithoutResponse && c.writeValueWithoutResponse) {
          await c.writeValueWithoutResponse(bloque);
          // Sin respuesta no hay control de flujo: una pausa corta evita
          // desbordar el buffer de las portatiles baratas.
          await esperar(15);
        } else if (c.writeValueWithResponse) {
          await c.writeValueWithResponse(bloque);
        } else {
          await c.writeValue(bloque);
        }
      }
    },
    cerrar: async () => servidor.disconnect(),
  };
}

// --- Puerto serie ---------------------------------------------------------------

async function abrirSerie(puerto: PuertoSerie, baudios: number): Promise<Conexion> {
  try {
    await puerto.open({ baudRate: baudios });
  } catch (e) {
    // Ya estaba abierto (otra pestaña o reconexion): se intenta usar igual.
    if (!(e instanceof Error) || !/already open/i.test(e.message)) throw e;
  }
  const info = puerto.getInfo();
  return {
    tipo: "serie",
    nombre: info.bluetoothServiceClassId ? "Impresora Bluetooth (puerto)" : "Impresora (puerto serie)",
    escribir: async (datos) => {
      if (!puerto.writable) throw new Error("El puerto no esta disponible");
      const writer = puerto.writable.getWriter();
      try {
        await writer.write(datos);
      } finally {
        writer.releaseLock();
      }
    },
    cerrar: async () => puerto.close(),
  };
}

// --- USB ------------------------------------------------------------------------

const CLASE_IMPRESORA = 7;

async function abrirUsb(dispositivo: UsbDispositivo): Promise<Conexion> {
  if (!dispositivo.opened) await dispositivo.open();
  if (!dispositivo.configuration) await dispositivo.selectConfiguration(1);
  const interfaces = dispositivo.configuration?.interfaces ?? [];
  // La de clase impresora; si no hay, la primera con salida bulk.
  const candidata =
    interfaces.find((i) => i.alternate.interfaceClass === CLASE_IMPRESORA) ??
    interfaces.find((i) => i.alternate.endpoints.some((e) => e.direction === "out" && e.type === "bulk"));
  const salida = candidata?.alternate.endpoints.find((e) => e.direction === "out");
  if (!candidata || !salida) throw new Error("No se encontró la salida de impresión del USB");
  await dispositivo.claimInterface(candidata.interfaceNumber);
  return {
    tipo: "usb",
    nombre: dispositivo.productName || "Impresora USB",
    escribir: async (datos) => {
      await dispositivo.transferOut(salida.endpointNumber, datos);
    },
    cerrar: async () => dispositivo.close(),
  };
}

// --- API publica ---------------------------------------------------------------

/**
 * Pide al usuario elegir la impresora (el navegador EXIGE un toque para esto)
 * y la abre.
 */
export async function elegirImpresora(tipo: TipoConexion, baudios = 9600): Promise<Conexion> {
  const n = nav();
  if (tipo === "bluetooth" && n.bluetooth) {
    const dispositivo = await n.bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: SERVICIOS_IMPRESORA,
    });
    return abrirBluetooth(dispositivo);
  }
  if (tipo === "serie" && n.serial) {
    return abrirSerie(await n.serial.requestPort(), baudios);
  }
  if (tipo === "usb" && n.usb) {
    return abrirUsb(await n.usb.requestDevice({ filters: [] }));
  }
  throw new Error("Este navegador no permite esa conexión");
}

/**
 * Reabre SIN preguntar una impresora a la que ya se dio permiso (al recargar
 * la pagina). `null` si el navegador no lo permite o ya no esta: entonces hace
 * falta un toque en "Reconectar".
 */
export async function reconectarImpresora(
  tipo: TipoConexion,
  nombre: string | null,
  baudios = 9600
): Promise<Conexion | null> {
  const n = nav();
  try {
    if (tipo === "bluetooth" && n.bluetooth?.getDevices) {
      const dispositivos = await n.bluetooth.getDevices();
      const d = dispositivos.find((x) => x.name === nombre) ?? dispositivos[0];
      return d ? await abrirBluetooth(d) : null;
    }
    if (tipo === "serie" && n.serial) {
      const [puerto] = await n.serial.getPorts();
      return puerto ? await abrirSerie(puerto, baudios) : null;
    }
    if (tipo === "usb" && n.usb) {
      const dispositivos = await n.usb.getDevices();
      const d = dispositivos.find((x) => x.productName === nombre) ?? dispositivos[0];
      return d ? await abrirUsb(d) : null;
    }
  } catch {
    return null;
  }
  return null;
}
