import { base } from "@/lib/db";
import { leerAjustes } from "@/lib/ajustes";
import { iaDisponible, modeloIA } from "@/lib/ia";
import { FormularioAjustes } from "./formulario";

export const metadata = { title: "Ajustes" };

export default async function Ajustes() {
  const ajustes = await leerAjustes(await base());
  return (
    <>
      <div className="cabecera">
        <div>
          <h1>Ajustes</h1>
          <p>Las protecciones valen para todas las automatizaciones.</p>
        </div>
      </div>
      <FormularioAjustes ajustes={ajustes} ia={iaDisponible()} modelo={modeloIA()} />
    </>
  );
}
