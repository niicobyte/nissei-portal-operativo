import Link from "next/link";

export default function NotFound() {
  return (
    <main className="min-h-screen flex items-center justify-center p-4 bg-zinc-50 text-zinc-900">
      <div className="text-center space-y-4 max-w-md bg-white p-8 rounded-xl border border-zinc-200 shadow-sm">
        <h2 className="text-4xl font-extrabold text-zinc-900 tabular-nums">404</h2>
        <p className="text-sm text-zinc-600">
          La página u orden que estás buscando no existe en el sistema SATI OPS.
        </p>
        <Link
          href="/login"
          className="inline-block px-4 py-2 bg-zinc-900 text-white text-xs font-semibold rounded-lg hover:bg-black transition-colors"
        >
          Ir a Iniciar Sesión
        </Link>
      </div>
    </main>
  );
}
