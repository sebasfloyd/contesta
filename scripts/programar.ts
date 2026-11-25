// Programa el reloj en Supabase: cada minuto, la base llama a /api/cron de tu panel.
// Usa pg_cron y pg_net, que vienen incluidos gratis en Supabase.
// Uso: npm run programar            (lo crea o lo actualiza)
//      npm run programar -- quitar  (lo saca)
import { cargarEntorno } from "./entorno.mjs";
import { abrirPostgres } from "../lib/db";

cargarEntorno();
const { DATABASE_URL, URL_PUBLICA, CRON_SECRETO } = process.env;
const quitar = process.argv.includes("quitar");
if (!DATABASE_URL) {
  console.error("Falta DATABASE_URL en .env.local: el reloj se programa en tu base de Supabase.");
  process.exit(1);
}
if (!quitar && (!URL_PUBLICA || !/^https:\/\//.test(URL_PUBLICA) || !CRON_SECRETO)) {
  console.error("Faltan URL_PUBLICA (la dirección https de tu panel en Vercel) o CRON_SECRETO en .env.local.");
  process.exit(1);
}

const NOMBRE = "contesta-latido";
const base = await abrirPostgres(DATABASE_URL);
try {
  await base.correr("create extension if not exists pg_cron; create extension if not exists pg_net;");
  await base.q("select cron.unschedule(jobid) from cron.job where jobname = $1", [NOMBRE]);
  if (quitar) {
    console.log("Reloj quitado.");
  } else {
    const destino = `${URL_PUBLICA!.replace(/\/$/, "")}/api/cron`;
    // format(%L) arma el comando con las comillas bien puestas.
    await base.q(
      `select cron.schedule($1, '* * * * *', format(
         'select net.http_post(url := %L, headers := jsonb_build_object(''Authorization'', %L), timeout_milliseconds := 55000)',
         $2::text, $3::text))`,
      [NOMBRE, destino, `Bearer ${CRON_SECRETO}`],
    );
    console.log(`Reloj programado: cada minuto se llama a ${destino}`);
    console.log("Para verlo en Supabase: Integrations → Cron → Jobs.");
  }
} catch (e) {
  console.error("No se pudo programar el reloj:", e instanceof Error ? e.message : e);
  process.exitCode = 1;
} finally {
  await base.cerrar();
}
