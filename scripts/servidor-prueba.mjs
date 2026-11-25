// Levanta el panel ya compilado en un puerto aparte, con una base local nueva y vacía.
// Lo usan la prueba del panel y el generador de imágenes. No toca tu base ni tu .env.local.
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const raiz = process.cwd();
const next = path.join(raiz, "node_modules", "next", "dist", "bin", "next");

export async function levantar({ puerto = 3111, carpetaDatos = ".datos-prueba", clave = "clave-de-prueba" } = {}) {
  if (!fs.existsSync(path.join(raiz, ".next", "BUILD_ID"))) {
    console.log("Compilando el panel (npm run build)…");
    const r = spawnSync(process.execPath, [next, "build"], { cwd: raiz, stdio: "inherit" });
    if (r.status !== 0) throw new Error("No se pudo compilar.");
  }
  fs.rmSync(path.join(raiz, carpetaDatos), { recursive: true, force: true });
  const entorno = { ...process.env, CARPETA_DATOS: carpetaDatos, CLAVE_PANEL: clave, CRON_SECRETO: "secreto-de-prueba", DATABASE_URL: "", COMPOSIO_API_KEY: "", AI_GATEWAY_API_KEY: "", VERCEL_OIDC_TOKEN: "", PORT: String(puerto) };
  const proceso = spawn(process.execPath, [next, "start", "-p", String(puerto)], { cwd: raiz, env: entorno, stdio: ["ignore", "pipe", "pipe"] });
  let salida = "";
  proceso.stdout.on("data", (d) => (salida += d));
  proceso.stderr.on("data", (d) => (salida += d));
  const url = `http://localhost:${puerto}`;
  for (let i = 0; i < 80; i++) {
    try {
      const r = await fetch(`${url}/entrar`);
      if (r.ok) break;
    } catch { /* todavía no arrancó */ }
    if (proceso.exitCode !== null) throw new Error(`El servidor se cerró:\n${salida}`);
    await new Promise((r) => setTimeout(r, 250));
    if (i === 79) throw new Error(`El servidor no arrancó:\n${salida}`);
  }
  return {
    url,
    clave,
    secreto: "secreto-de-prueba",
    salida: () => salida,
    async cerrar() {
      proceso.kill();
      await new Promise((r) => setTimeout(r, 400));
      fs.rmSync(path.join(raiz, carpetaDatos), { recursive: true, force: true });
    },
  };
}

/** Entra al panel con la clave. */
export async function entrar(pagina, servidor) {
  await pagina.goto(`${servidor.url}/entrar`);
  await pagina.fill('input[name="clave"]', servidor.clave);
  await pagina.click("button");
  await pagina.waitForURL(`${servidor.url}/`);
}

/** Manda un evento desde el simulador y espera a que el panel muestre el resultado. */
export async function simular(pagina, servidor, { tipo = "comentario", usuario, texto, post }) {
  if (!pagina.url().includes("/simulador")) await pagina.goto(`${servidor.url}/simulador`);
  await pagina.selectOption('select[name="tipo"]', tipo);
  await pagina.fill('input[name="usuario"]', usuario);
  if (post) await pagina.selectOption('select[name="post"]', post);
  if (tipo !== "mencion_historia") await pagina.fill('input[name="texto"]', texto);
  const antes = await pagina.locator(".charla .globo").count().catch(() => 0);
  const titulo = await pagina.locator("h2", { hasText: "Conversación con" }).textContent().catch(() => "");
  await pagina.click('button:has-text("Simular")');
  await pagina.waitForFunction(
    ([n, t, u]) => {
      const h = [...document.querySelectorAll("h2")].find((x) => x.textContent.includes("Conversación con"));
      if (!h || !h.textContent.includes("@" + u)) return false;
      return h.textContent !== t || document.querySelectorAll(".charla .globo").length > n;
    },
    [antes, titulo, usuario],
    { timeout: 15000 },
  );
  await pagina.waitForTimeout(250);
}
