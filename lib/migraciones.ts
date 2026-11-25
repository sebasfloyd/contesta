import fs from "node:fs";
import path from "node:path";
import type { Base } from "./db";

/** Aplica las migraciones de supabase/migrations que falten, en orden. Devuelve las que aplicó. */
export async function migrar(base: Base, carpeta = path.join(/*turbopackIgnore: true*/ process.cwd(), "supabase", "migrations")): Promise<string[]> {
  await base.correr("create table if not exists _migraciones (nombre text primary key, aplicada timestamptz not null default now())");
  const hechas = new Set((await base.q<{ nombre: string }>("select nombre from _migraciones")).map((f) => f.nombre));
  const archivos = fs.readdirSync(/*turbopackIgnore: true*/ carpeta).filter((a) => a.endsWith(".sql")).sort();
  const aplicadas: string[] = [];
  for (const archivo of archivos) {
    if (hechas.has(archivo)) continue;
    await base.correr(fs.readFileSync(path.join(/*turbopackIgnore: true*/ carpeta, archivo), "utf8"));
    await base.q("insert into _migraciones (nombre) values ($1)", [archivo]);
    aplicadas.push(archivo);
  }
  return aplicadas;
}
