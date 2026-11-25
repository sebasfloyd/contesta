// Genera todas las imágenes del README en docs/img. Uso: npm run docs:img
//  - portada.png y social.png salen de docs/img/fuente/portada.html
//  - las capturas son del panel real, andando con datos de ejemplo cargados por el simulador
//  - simulador.gif se arma solo si tenés ffmpeg instalado (si no, se saltea)
// El diagrama (como-funciona.svg) está escrito a mano: se edita directo.
// animacion.gif es una animación de producto armada aparte: este script no la toca.
import { chromium } from "playwright";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { entrar, levantar, simular } from "../../../scripts/servidor-prueba.mjs";

const raiz = process.cwd();
const destino = path.join(raiz, "docs", "img");
const en = (nombre) => path.join(destino, nombre);

const navegador = await chromium.launch();
const servidor = await levantar({ puerto: 3112, carpetaDatos: ".datos-capturas" });
try {
  // ── Portada y tarjeta para redes ───────────────────────────────────────────
  const plantilla = pathToFileURL(path.join(destino, "fuente", "portada.html")).href;
  for (const [archivo, consulta, ancho, alto] of [["portada.png", "", 1600, 560], ["social.png", "?formato=social", 1280, 640]]) {
    const p = await navegador.newPage({ viewport: { width: ancho, height: alto }, deviceScaleFactor: archivo === "social.png" ? 1 : 1.5 });
    await p.goto(plantilla + consulta);
    await p.evaluate(() => document.fonts.ready);
    await p.screenshot({ path: en(archivo) });
    await p.close();
  }

  // ── Datos de ejemplo, cargados como lo haría una persona ───────────────────
  const contexto = await navegador.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2, locale: "es-AR" });
  const pagina = await contexto.newPage();
  await entrar(pagina, servidor);
  const ids = {};
  for (const nombre of ["Hablar con una persona", "Precios por privado", "Bienvenida", "Pedir mail para el recurso", "Comentá GUÍA y te la mando"]) {
    await pagina.goto(servidor.url + "/automatizaciones");
    await pagina.locator(".item", { hasText: nombre }).getByRole("button", { name: "Usar" }).click();
    await pagina.waitForURL(/automatizaciones\/[0-9a-f-]{36}/);
    ids[nombre] = pagina.url().split("/").pop();
    await pagina.click('button:has-text("Guardar y activar")');
    await pagina.waitForSelector("text=Guardada y activa.");
  }
  const cuadros = [];
  const cuadro = async () => {
    if (cuadros.length >= 8) return;
    const archivo = path.join(raiz, ".datos-capturas", `cuadro-${cuadros.length}.png`);
    await pagina.screenshot({ path: archivo, scale: "css" });
    cuadros.push(archivo);
  };
  await pagina.goto(servidor.url + "/simulador");
  await cuadro();
  await simular(pagina, servidor, { usuario: "huerta.urbana", texto: "Quiero el RECURSO" });
  await cuadro();
  await simular(pagina, servidor, { tipo: "mensaje", usuario: "huerta.urbana", texto: "dale, ya te lo paso" });
  await cuadro();
  await simular(pagina, servidor, { tipo: "mensaje", usuario: "huerta.urbana", texto: "huerta@ejemplo.com" });
  await cuadro();
  for (const [usuario, texto] of [["taller.del.sur", "guía porfa"], ["cafe.laesquina", "GUIA"], ["vivero.sol", "me interesa la guía!"], ["bici.taller", "Guía"]]) {
    await simular(pagina, servidor, { usuario, texto, post: "post_demo_1" });
  }
  await simular(pagina, servidor, { usuario: "estudio.norte", texto: "recurso", post: "post_demo_2" });
  await simular(pagina, servidor, { tipo: "mensaje", usuario: "estudio.norte", texto: "hola@estudionorte.ejemplo" });
  await simular(pagina, servidor, { usuario: "panaderia.luna", texto: "quiero el recurso", post: "post_demo_2" });
  await simular(pagina, servidor, { tipo: "mensaje", usuario: "club.de.lectura", texto: "Hola! vi su perfil" });
  await simular(pagina, servidor, { tipo: "mensaje", usuario: "club.de.lectura", texto: "Precios" });
  await simular(pagina, servidor, { tipo: "mensaje", usuario: "feria.del.barrio", texto: "buenas, cuánto sale el taller?" });
  await simular(pagina, servidor, { tipo: "mensaje", usuario: "feria.del.barrio", texto: "prefiero hablar con alguien" });
  await simular(pagina, servidor, { tipo: "mensaje", usuario: "vivero.sol", texto: "gracias, llegó perfecto" });

  // ── Capturas de escritorio ─────────────────────────────────────────────────
  const captura = async (ruta, archivo, alto = 800) => {
    await pagina.setViewportSize({ width: 1280, height: alto });
    await pagina.goto(servidor.url + ruta, { waitUntil: "networkidle" });
    await pagina.evaluate(() => document.fonts.ready);
    await pagina.screenshot({ path: en(archivo) });
  };
  await captura("/automatizaciones", "automatizaciones.png", 860);
  await captura(`/automatizaciones/${ids["Pedir mail para el recurso"]}`, "editor.png", 1180);
  await captura("/contactos", "contactos.png", 760);
  await captura("/estadisticas", "estadisticas.png", 640);
  await pagina.setViewportSize({ width: 1280, height: 800 });
  await pagina.goto(servidor.url + "/bandeja");
  await pagina.locator("a.item", { hasText: "huerta.urbana" }).click();
  await pagina.waitForSelector(".charla");
  await pagina.screenshot({ path: en("bandeja.png") });

  // ── Captura de celular ─────────────────────────────────────────────────────
  const celular = await navegador.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, locale: "es-AR" });
  const movil = await celular.newPage();
  await entrar(movil, servidor);
  await movil.goto(servidor.url + "/automatizaciones", { waitUntil: "networkidle" });
  await movil.screenshot({ path: en("celular-automatizaciones.png") });
  await movil.goto(servidor.url + "/bandeja", { waitUntil: "networkidle" });
  await movil.locator("a.item", { hasText: "huerta.urbana" }).click();
  await movil.waitForSelector(".charla");
  await movil.screenshot({ path: en("celular-bandeja.png") });

  // ── GIF del simulador (opcional) ───────────────────────────────────────────
  const tieneFfmpeg = spawnSync("ffmpeg", ["-version"], { stdio: "ignore" }).status === 0;
  if (tieneFfmpeg && cuadros.length > 1) {
    const lista = path.join(raiz, ".datos-capturas", "cuadros.txt");
    const lineas = cuadros.map((c, i) => `file '${c.replace(/\\/g, "/").replace(/'/g, "'\\''")}'\nduration ${i === cuadros.length - 1 ? 3 : 1.8}`);
    fs.writeFileSync(lista, lineas.join("\n") + `\nfile '${cuadros.at(-1).replace(/\\/g, "/").replace(/'/g, "'\\''")}'\n`);
    const r = spawnSync("ffmpeg", ["-y", "-f", "concat", "-safe", "0", "-i", lista, "-vf", "scale=960:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=64[p];[b][p]paletteuse=dither=none", "-loop", "0", en("simulador.gif")], { stdio: "ignore" });
    console.log(r.status === 0 ? "simulador.gif generado." : "ffmpeg no pudo armar el GIF: se saltea.");
  } else {
    console.log("Sin ffmpeg: no se genera simulador.gif (el resto sale igual).");
  }
  console.log("Imágenes listas en docs/img:");
  for (const a of fs.readdirSync(destino).filter((x) => /\.(png|gif|svg)$/.test(x)).sort()) console.log(`  ${a}  ${(fs.statSync(en(a)).size / 1024).toFixed(0)} KB`);
} finally {
  await navegador.close();
  await servidor.cerrar();
}
