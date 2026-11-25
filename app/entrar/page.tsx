import { FormularioEntrar } from "./formulario";

export const metadata = { title: "Entrar" };

export default function Entrar() {
  return (
    <main className="entrada">
      <FormularioEntrar faltaClave={!process.env.CLAVE_PANEL} />
    </main>
  );
}
