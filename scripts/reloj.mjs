// Reloj para tu compu: llama a /api/cron cada minuto, igual que hace Supabase en producción.
// Uso: npm run reloj   (con `npm run dev` andando en otra terminal)
import { cargarEntorno } from "./entorno.mjs";

cargarEntorno();
const destino = `${process.env.URL_LOCAL || "http://localhost:3000"}/api/cron`;
const secreto = process.env.CRON_SECRETO;
if (!secreto) {
  console.error("Falta CRON_SECRETO en .env.local. Corré `npm run preparar`.");
  process.exit(1);
}
async function latido() {
  try {
    const r = await fetch(destino, { method: "POST", headers: { authorization: `Bearer ${secreto}` } });
    console.log(new Date().toLocaleTimeString("es-AR"), r.status, JSON.stringify(await r.json()));
  } catch (e) {
    console.log(new Date().toLocaleTimeString("es-AR"), "sin respuesta:", e instanceof Error ? e.message : e);
  }
}
console.log(`Llamando a ${destino} cada minuto. Cortá con Ctrl+C.`);
await latido();
setInterval(latido, 60000);
