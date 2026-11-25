import { describe, expect, it } from "vitest";
import { coincide, completar, extraerMail, extraerTelefono, normalizar } from "@/lib/texto";

describe("coincidencia de palabras", () => {
  it("no distingue mayúsculas, acentos ni signos", () => {
    expect(normalizar("¡GUÍA!")).toBe("guia");
    expect(coincide("Quiero la GUÍA por favor", ["guia"], "contiene")).toBe(true);
    expect(coincide("guía", ["GUIA"], "exacta")).toBe(true);
    expect(coincide("  Guía!!  ", ["guia"], "exacta")).toBe(true);
  });
  it("contiene compara por palabra entera", () => {
    expect(coincide("fue un viaje guiado", ["guia"], "contiene")).toBe(false);
    expect(coincide("mandame la guia ya", ["guia"], "contiene")).toBe(true);
    expect(coincide("quiero el taller online", ["taller online"], "contiene")).toBe(true);
  });
  it("exacta exige que el texto sea solo la palabra", () => {
    expect(coincide("quiero la guia", ["guia"], "exacta")).toBe(false);
  });
  it("acepta varias palabras y, sin palabras, coincide siempre", () => {
    expect(coincide("info", ["guia", "info"], "exacta")).toBe(true);
    expect(coincide("cualquier cosa", [], "contiene")).toBe(true);
    expect(coincide("cualquier cosa", ["  "], "contiene")).toBe(true);
  });
});

describe("validación de datos", () => {
  it("encuentra el mail dentro de una frase", () => {
    expect(extraerMail("dale, es Ana.Perez+ig@Ejemplo.com.ar gracias")).toBe("ana.perez+ig@ejemplo.com.ar");
    expect(extraerMail("mi mail es prueba@ejemplo.com.")).toBe("prueba@ejemplo.com");
  });
  it("rechaza lo que no es mail", () => {
    expect(extraerMail("no tengo")).toBeNull();
    expect(extraerMail("prueba@ejemplo")).toBeNull();
    expect(extraerMail("@usuario")).toBeNull();
  });
  it("valida teléfonos de 8 a 15 dígitos", () => {
    expect(extraerTelefono("+54 9 11 5555-0100")).toBe("+5491155550100");
    expect(extraerTelefono("mi cel: (011) 5555 0100")).toBe("01155550100");
    expect(extraerTelefono("123")).toBeNull();
    expect(extraerTelefono("no tengo")).toBeNull();
  });
  it("completa variables del contacto", () => {
    expect(completar("Hola {{usuario}}, te escribo a {{mail}}", { usuario: "cuenta_demo", nombre: null, datos: { mail: "a@b.co" } })).toBe("Hola @cuenta_demo, te escribo a a@b.co");
    expect(completar("Hola {{nombre}}", { usuario: null, nombre: null, datos: {} })).toBe("Hola");
  });
});
