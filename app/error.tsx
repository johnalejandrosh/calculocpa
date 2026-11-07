"use client"; // Los límites de error deben ser componentes de cliente.

import { useEffect } from "react";
import { DatabaseZap, RotateCcw } from "lucide-react";
import { Button, Card } from "@/components/ui";

export default function Error({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="grid flex-1 place-items-center px-4 py-16">
      <Card className="flex max-w-md flex-col items-center px-6 py-12 text-center">
        <span className="grid size-12 place-items-center rounded-xl bg-critical/10 text-critical-ink">
          <DatabaseZap aria-hidden className="size-6" />
        </span>
        <h1 className="mt-4 text-lg font-semibold">No se pudieron cargar los productos</h1>
        <p className="mt-1 text-sm text-muted">
          No hubo respuesta de la base de datos. Revisa que el servidor de PostgreSQL esté encendido y
          que la configuración del archivo .env sea correcta.
        </p>
        <Button variant="primary" className="mt-6" onClick={() => retry()}>
          <RotateCcw aria-hidden />
          Reintentar
        </Button>
      </Card>
    </main>
  );
}
