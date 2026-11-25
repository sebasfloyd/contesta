// Crea .env.local a partir de .env.example y genera la clave del panel y el secreto del reloj.
// Uso: npm run preparar
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const destino = path.join(process.cwd(), ".env.local");
if (fs.existsSync(destino)) {
  console.log("Ya existe .env.local: no lo toco. Si querés empezar de cero, borralo y corré esto de nuevo.");
  process.exit(0);
}
const clave = crypto.randomBytes(9).toString("base64url");
const secreto = crypto.randomBytes(24).toString("base64url");
const texto = fs
  .readFileSync(path.join(process.cwd(), ".env.example"), "utf8")
  .replace(/^CLAVE_PANEL=.*$/m, `CLAVE_PANEL=${clave}`)
  .replace(/^CRON_SECRETO=.*$/m, `CRON_SECRETO=${secreto}`);
fs.writeFileSync(destino, texto);
console.log("Listo: se creó .env.local");
console.log(`Tu clave para entrar al panel es: ${clave}`);
console.log("Guardala. Después podés cambiarla editando CLAVE_PANEL en .env.local.");
