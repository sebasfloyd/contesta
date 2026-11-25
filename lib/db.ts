import fs from "node:fs";
import path from "node:path";

/**
 * Acceso a la base. Dos formas, mismo SQL:
 * - Con DATABASE_URL: Postgres de Supabase (conexión directa o por el pooler).
 * - Sin DATABASE_URL: base local en la carpeta .datos (PGlite, Postgres embebido). Sirve para
 *   probar todo en tu compu sin crear ninguna cuenta. No funciona en Vercel.
 */
export interface Base {
  /** Consulta con parámetros $1, $2… Devuelve las filas. */
  q<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
  /** Corre un archivo SQL entero (varias sentencias, sin parámetros). */
  correr(sql: string): Promise<void>;
  cerrar(): Promise<void>;
}

export async function abrirPostgres(url: string): Promise<Base> {
  const { default: postgres } = await import("postgres");
  // prepare:false es obligatorio con el pooler de Supabase en modo transacción (puerto 6543).
  const sql = postgres(url, { prepare: false, max: 3, idle_timeout: 20, onnotice: () => {} });
  return {
    async q<T>(texto: string, params: unknown[] = []) {
      return (await sql.unsafe(texto, params as never[])) as unknown as T[];
    },
    async correr(texto: string) {
      await sql.unsafe(texto);
    },
    async cerrar() {
      await sql.end({ timeout: 5 });
    },
  };
}

/** Base embebida. Sin carpeta queda en memoria (para los tests). */
export async function abrirLocal(carpeta?: string): Promise<Base> {
  const { PGlite } = await import("@electric-sql/pglite");
  if (carpeta) fs.mkdirSync(/*turbopackIgnore: true*/ carpeta, { recursive: true });
  const db = new PGlite(carpeta);
  await db.waitReady;
  return {
    async q<T>(texto: string, params: unknown[] = []) {
      return (await db.query(texto, params as never[])).rows as T[];
    },
    async correr(texto: string) {
      await db.exec(texto);
    },
    async cerrar() {
      await db.close();
    },
  };
}

export const usaBaseLocal = () => !process.env.DATABASE_URL;

// Una sola conexión por proceso (en desarrollo Next recarga módulos: por eso va en globalThis).
const g = globalThis as unknown as { __contestaBase?: Promise<Base> };

export function base(): Promise<Base> {
  if (!g.__contestaBase) {
    g.__contestaBase = (async () => {
      const url = process.env.DATABASE_URL;
      if (url) return abrirPostgres(url);
      if (process.env.VERCEL) {
        throw new Error("Falta DATABASE_URL: en Vercel hay que conectar la base de Supabase. Mirá el README, paso 3.");
      }
      const local = await abrirLocal(path.join(/*turbopackIgnore: true*/ process.cwd(), process.env.CARPETA_DATOS || ".datos"));
      // Solo en tu compu: la base local se crea sola la primera vez.
      const { migrar } = await import("./migraciones");
      await migrar(local);
      return local;
    })();
    g.__contestaBase.catch(() => {
      g.__contestaBase = undefined;
    });
  }
  return g.__contestaBase;
}
