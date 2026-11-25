// Prueba de punta a punta con un navegador sin interfaz y el canal simulado.
// Recorre: entrar → crear una automatización desde plantilla → activarla → simular un
// comentario → dar un mail inválido y uno válido → revisar contacto, CSV y estadísticas →
// abrir todas las pantallas en escritorio y celular buscando errores.
// Uso: npm run prueba:panel   (la primera vez: npx playwright install chromium)
import { chromium } from "playwright";
import { entrar, levantar, simular } from "./servidor-prueba.mjs";

const fallas = [];
const pasos = [];
function revisar(nombre, condicion, detalle = "") {
  pasos.push(`${condicion ? "OK   " : "FALLA"} ${nombre}${detalle ? " → " + detalle : ""}`);
  if (!condicion) fallas.push(nombre);
}

const servidor = await levantar();
let navegador;
try {
  navegador = await chromium.launch();
  const contexto = await navegador.newContext({ viewport: { width: 1280, height: 860 }, locale: "es-AR" });
  const pagina = await contexto.newPage();
  const consola = [];
  pagina.on("console", (m) => m.type() === "error" && consola.push(`${pagina.url()} · ${m.text()}`));
  pagina.on("pageerror", (e) => consola.push(`${pagina.url()} · ${e.message}`));
  pagina.on("response", (r) => r.status() >= 400 && !r.url().includes("/api/cron") && consola.push(`${r.status()} ${r.url()}`));

  // 1. Protección por clave
  await pagina.goto(servidor.url + "/contactos");
  revisar("Sin clave, el panel manda a /entrar", pagina.url().endsWith("/entrar"));
  const sinClave = await fetch(servidor.url + "/api/contactos.csv", { redirect: "manual" });
  revisar("Sin clave, la API responde 401", sinClave.status === 401, String(sinClave.status));
  await pagina.fill('input[name="clave"]', "otra-clave");
  await pagina.click("button");
  await pagina.waitForSelector('[role="alert"]');
  revisar("Clave incorrecta: no entra", pagina.url().endsWith("/entrar"));
  consola.length = 0;
  await entrar(pagina, servidor);
  revisar("Clave correcta: entra a Inicio", (await pagina.textContent("h1")) === "Inicio");

  // 2. Automatización desde plantilla
  await pagina.goto(servidor.url + "/automatizaciones");
  await pagina.locator(".item", { hasText: "Pedir mail para el recurso" }).getByRole("button", { name: "Usar" }).click();
  await pagina.waitForURL(/automatizaciones\/[0-9a-f-]{36}/);
  await pagina.click('button:has-text("Guardar y activar")');
  await pagina.waitForSelector("text=Guardada y activa.");
  revisar("Plantilla creada y activada", true);

  // 3. Comentario simulado
  await simular(pagina, servidor, { usuario: "lectora_demo", texto: "Quiero el RECURSO!" });
  let globos = await pagina.locator(".charla .globo").allTextContents();
  revisar("Comentario → respuesta pública", globos.some((g) => g.includes("Te escribí por privado") && g.includes("Respuesta pública")), globos[1]);
  revisar("Comentario → privado con el pedido de mail", globos.some((g) => g.includes("¿A qué mail te mando el recurso?")), globos[2]);
  revisar("Queda esperando el dato", await pagina.locator("text=Esperando que mande el dato").isVisible());

  // 4. Mail inválido y después válido
  await simular(pagina, servidor, { tipo: "mensaje", usuario: "lectora_demo", texto: "no me acuerdo" });
  globos = await pagina.locator(".charla .globo").allTextContents();
  revisar("Mail inválido → vuelve a pedirlo", globos.some((g) => g.includes("Ese mail no me cierra")));
  await simular(pagina, servidor, { tipo: "mensaje", usuario: "lectora_demo", texto: "es Lectora.Demo@Ejemplo.com" });
  globos = await pagina.locator(".charla .globo").allTextContents();
  revisar("Mail válido → mensaje final con el mail", globos.some((g) => g.includes("Te lo mando a lectora.demo@ejemplo.com")), globos.at(-1));

  // 5. Idempotencia y otro contacto sin coincidencia
  await simular(pagina, servidor, { usuario: "otro_lector", texto: "qué lindo" });
  revisar("Comentario sin palabra clave: no responde", (await pagina.locator(".charla .globo").count()) === 1);

  // 6. Contacto con etiqueta y dato
  await pagina.goto(servidor.url + "/contactos?etiqueta=recurso");
  const fila = await pagina.locator("tbody tr").first().textContent();
  revisar("Contacto etiquetado «recurso» con el mail guardado", /lectora_demo/.test(fila) && /recurso/.test(fila) && /lectora\.demo@ejemplo\.com/.test(fila), fila?.replace(/\s+/g, " ").slice(0, 120));
  revisar("El filtro por etiqueta deja un solo contacto", (await pagina.locator("tbody tr").count()) === 1);
  const csv = await pagina.evaluate(() => fetch("/api/contactos.csv").then((r) => r.text()));
  revisar("El CSV trae el contacto y su mail", csv.includes("lectora_demo") && csv.includes("lectora.demo@ejemplo.com") && csv.split("\r\n").length === 3, `${csv.split("\r\n").length - 1} filas`);

  // 7. Estadísticas
  await pagina.goto(servidor.url + "/estadisticas");
  const celdas = await pagina.locator("tbody tr", { hasText: "Pedir mail para el recurso" }).locator("td.num").allTextContents();
  revisar("Estadísticas: 1 disparo, 4 enviados, 1 dato, 0 errores", celdas.join(",") === "1,4,1,0", celdas.join(","));

  // 8. Bandeja: responder a mano pausa el bot
  await pagina.goto(servidor.url + "/bandeja");
  await pagina.locator("a.item", { hasText: "lectora_demo" }).click();
  await pagina.fill('textarea[name="texto"]', "Hola, soy del equipo. ¿Te llegó bien?");
  await pagina.click('button:has-text("Enviar")');
  await pagina.waitForSelector(".globo.humano");
  await pagina.waitForSelector("text=El bot está pausado para esta persona");
  revisar("Respuesta manual enviada y bot pausado para ese contacto", true);

  // 9. Reloj
  const sinSecreto = await fetch(servidor.url + "/api/cron");
  const conSecreto = await fetch(servidor.url + "/api/cron", { headers: { authorization: `Bearer ${servidor.secreto}` } });
  const cuerpo = await conSecreto.json();
  revisar("El reloj pide el secreto", sinSecreto.status === 401 && conSecreto.status === 200 && cuerpo.ok === true, JSON.stringify(cuerpo));

  // 10. Todas las pantallas, escritorio y celular
  const rutas = ["/", "/automatizaciones", "/automatizaciones/nueva", "/bandeja", "/contactos", "/estadisticas", "/simulador", "/registro", "/conexion", "/ajustes", "/mas"];
  for (const [nombre, tamano] of [["escritorio", { width: 1280, height: 860 }], ["celular", { width: 390, height: 844 }]]) {
    await pagina.setViewportSize(tamano);
    let desbordes = [];
    for (const ruta of rutas) {
      const r = await pagina.goto(servidor.url + ruta, { waitUntil: "networkidle" });
      if (r.status() !== 200) consola.push(`${r.status()} en ${ruta}`);
      const ancho = await pagina.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      if (ancho > 1) desbordes.push(`${ruta} (+${ancho}px)`);
    }
    revisar(`${rutas.length} pantallas abren en ${nombre} sin desbordar a lo ancho`, desbordes.length === 0, desbordes.join(", "));
  }
  revisar("Sin errores de consola ni pedidos fallidos", consola.length === 0, consola.slice(0, 5).join(" | "));
} catch (e) {
  fallas.push("La prueba se cortó");
  pasos.push(`FALLA La prueba se cortó → ${e instanceof Error ? e.message.split("\n")[0] : e}`);
} finally {
  await navegador?.close();
  await servidor.cerrar();
}

console.log(pasos.join("\n"));
console.log(fallas.length ? `\n${fallas.length} cosas fallaron.` : `\nTodo bien: ${pasos.length} comprobaciones.`);
process.exit(fallas.length ? 1 : 0);
