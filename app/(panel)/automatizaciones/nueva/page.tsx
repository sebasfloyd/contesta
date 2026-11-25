import Link from "next/link";
import { Editor } from "../editor";
import { iaDisponible } from "@/lib/ia";

export const metadata = { title: "Nueva automatización" };

export default function Nueva() {
  return (
    <>
      <Link href="/automatizaciones" className="volver">← Automatizaciones</Link>
      <Editor
        id={null}
        activa={false}
        iaDisponible={iaDisponible()}
        inicial={{
          nombre: "",
          disparador: { tipo: "comentario", palabras: [], coincidencia: "contiene", postId: null },
          pasos: [{ tipo: "responder_comentario", variantes: [""] }, { tipo: "enviar_privado", texto: "" }],
        }}
      />
    </>
  );
}
