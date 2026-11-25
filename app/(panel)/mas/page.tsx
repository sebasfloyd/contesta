import Link from "next/link";
import { salir } from "../../acciones";

export const metadata = { title: "Más" };

const ENLACES = [
  ["/estadisticas", "Estadísticas", "Qué hizo cada automatización."],
  ["/simulador", "Simulador", "Probá sin tocar Instagram."],
  ["/registro", "Registro", "Avisos, bloqueos y errores."],
  ["/conexion", "Conectar Instagram", "Estado de tu cuenta."],
  ["/ajustes", "Ajustes", "Baja, tope por hora e instrucciones para la IA."],
];

export default function Mas() {
  return (
    <>
      <div className="cabecera"><h1>Más</h1></div>
      <div className="lista">
        {ENLACES.map(([href, nombre, detalle]) => (
          <Link key={href} href={href} className="item">
            <div className="item-cuerpo"><b>{nombre}</b><span className="chico tenue">{detalle}</span></div>
            <span className="tenue">→</span>
          </Link>
        ))}
      </div>
      <form action={salir} style={{ marginTop: 18 }}><button className="boton claro">Salir</button></form>
    </>
  );
}
