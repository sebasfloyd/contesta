// Carga .env.local (si existe) para los scripts. Next lo hace solo; Node no.
import fs from "node:fs";
import path from "node:path";

export function cargarEntorno() {
  for (const archivo of [".env.local", ".env"]) {
    const ruta = path.join(process.cwd(), archivo);
    if (fs.existsSync(ruta)) process.loadEnvFile(ruta);
  }
}
