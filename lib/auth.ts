// Acceso al panel con una sola clave (CLAVE_PANEL). Sin usuarios.
// Usa Web Crypto para que funcione igual en el proxy y en el servidor.

export const COOKIE_SESION = "contesta_sesion";

async function firma(clave: string): Promise<string> {
  const llave = await crypto.subtle.importKey("raw", new TextEncoder().encode(clave), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const bytes = new Uint8Array(await crypto.subtle.sign("HMAC", llave, new TextEncoder().encode("contesta-panel-v1")));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function iguales(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let dif = 0;
  for (let i = 0; i < a.length; i++) dif |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return dif === 0;
}

export const clavePanel = () => (process.env.CLAVE_PANEL || "").trim();

/** Valor que se guarda en la cookie cuando la clave es correcta. */
export async function fichaDeSesion(): Promise<string | null> {
  const clave = clavePanel();
  return clave ? firma(clave) : null;
}

export async function claveCorrecta(intento: string): Promise<boolean> {
  const clave = clavePanel();
  if (!clave) return false;
  return iguales(await firma(intento.trim()), await firma(clave));
}

export async function sesionValida(cookie: string | undefined): Promise<boolean> {
  const esperada = await fichaDeSesion();
  return !!esperada && !!cookie && iguales(cookie, esperada);
}

export function secretoCronValido(recibido: string | null): boolean {
  const secreto = (process.env.CRON_SECRETO || "").trim();
  return !!secreto && !!recibido && iguales(recibido.replace(/^Bearer\s+/i, ""), secreto);
}
