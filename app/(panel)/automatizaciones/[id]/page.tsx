import Link from "next/link";
import { notFound } from "next/navigation";
import { automatizacion } from "@/lib/consultas";
import { iaDisponible } from "@/lib/ia";
import { Editor } from "../editor";

export const metadata = { title: "Editar automatización" };

export default async function Editar({ params }: { params: Promise<{ id: string }> }) {
  const a = await automatizacion((await params).id);
  if (!a) notFound();
  return (
    <>
      <Link href="/automatizaciones" className="volver">← Automatizaciones</Link>
      <Editor id={a.id} activa={a.activa} iaDisponible={iaDisponible()} inicial={{ nombre: a.nombre, disparador: a.disparador, pasos: a.pasos }} />
    </>
  );
}
