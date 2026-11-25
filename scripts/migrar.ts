// Crea o actualiza las tablas. Uso: npm run migrar
// Con DATABASE_URL trabaja sobre tu Supabase; sin ella, sobre la base local de la carpeta .datos.
import path from "node:path";
import { cargarEntorno } from "./entorno.mjs";
import { abrirLocal, abrirPostgres } from "../lib/db";
import { migrar } from "../lib/migraciones";

cargarEntorno();
const url = process.env.DATABASE_URL;
const base = url ? await abrirPostgres(url) : await abrirLocal(path.join(process.cwd(), process.env.CARPETA_DATOS || ".datos"));
try {
  const aplicadas = await migrar(base);
  console.log(url ? "Base: Supabase (DATABASE_URL)" : "Base: local (carpeta .datos)");
  console.log(aplicadas.length ? `Migraciones aplicadas: ${aplicadas.join(", ")}` : "La base ya estaba al día.");
} catch (e) {
  console.error("No se pudo migrar:", e instanceof Error ? e.message : e);
  process.exitCode = 1;
} finally {
  await base.cerrar();
}
