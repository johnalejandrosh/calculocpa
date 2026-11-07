import { Suspense } from "react";
import { CpaApp, WorkspaceSkeleton } from "@/components/cpa-app";
import { listProducts } from "@/lib/products";

export default function Home() {
  return (
    <Suspense fallback={<WorkspaceSkeleton />}>
      <Workspace />
    </Suspense>
  );
}

/** Lee los productos de la base de datos en cada petición. */
async function Workspace() {
  const products = await listProducts();
  return <CpaApp initialProducts={products} />;
}
