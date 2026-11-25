import Link from "next/link";
import { base } from "@/lib/db";
import { leerConexion } from "@/lib/ajustes";
import { salir } from "../acciones";
import { Navegacion, TabsMovil } from "../_ui/navegacion";

export default async function Panel({ children }: { children: React.ReactNode }) {
  const b = await base();
  const [cx, pendientes] = await Promise.all([
    leerConexion(b),
    b.q<{ n: number }>("select count(*)::int as n from contactos where pide_humano"),
  ]);
  const conectado = cx?.estado === "activa";
  const marca = (
    <Link href="/" className="marca">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/icono.svg" alt="" />
      <span>Contesta</span>
    </Link>
  );
  return (
    <div className="marco">
      <aside className="lateral">
        {marca}
        <Navegacion pidenHumano={pendientes[0].n} />
        <div className="pie-lateral">
          <Link href="/conexion" className={`estado ${conectado ? "si" : ""}`} style={{ textDecoration: "none" }}>
            <i />
            <span className="corte">{conectado ? `@${cx?.usuario}` : "Instagram sin conectar"}</span>
          </Link>
          <form action={salir}>
            <button className="boton claro mini">Salir</button>
          </form>
          <a href="https://labdeai.com/?utm_source=contesta&utm_medium=panel&utm_campaign=contesta" target="_blank" rel="noreferrer" style={{ fontSize: 12, opacity: 0.6, textDecoration: "none", color: "inherit" }}>
            Hecho en el LAB AI
          </a>
        </div>
      </aside>
      <div>
        <header className="barra-movil">
          {marca}
          <Link href="/conexion" className={`estado chico ${conectado ? "si" : ""}`} style={{ textDecoration: "none" }}>
            <i />
            {conectado ? `@${cx?.usuario}` : "Sin conectar"}
          </Link>
        </header>
        <main className="contenido">{children}</main>
      </div>
      <TabsMovil pidenHumano={pendientes[0].n} />
    </div>
  );
}
