"use server";

import { parseProductChanges, type ProductChanges } from "@/lib/product-schema";
import { saveProductChanges as save } from "@/lib/products";

export type SaveResult = { ok: true } | { ok: false; error: string };

/**
 * Guarda en la base de datos los cambios hechos en el navegador.
 * Cualquiera que llegue a la app puede llamarla (no hay inicio de sesión),
 * así que los datos se validan aquí y no se confía en lo que manda el cliente.
 */
export async function saveProducts(changes: ProductChanges): Promise<SaveResult> {
  const parsed = parseProductChanges(changes);
  if (!parsed) return { ok: false, error: "Los datos enviados no son válidos." };

  try {
    await save(parsed);
    return { ok: true };
  } catch (error) {
    console.error("No se pudieron guardar los productos:", error);
    return { ok: false, error: "No se pudo guardar en la base de datos." };
  }
}
