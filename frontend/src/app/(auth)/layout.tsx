import Link from "next/link";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-8 sm:px-6">
      <div className="pointer-events-none absolute inset-0 opacity-40">
        <div className="absolute left-[8%] top-[12%] h-64 w-64 rounded-full bg-indigo-200 blur-3xl" />
        <div className="absolute bottom-[8%] right-[10%] h-72 w-72 rounded-full bg-sky-100 blur-3xl" />
      </div>
      <section className="relative w-full max-w-[460px] rounded-3xl border border-white/80 bg-white/95 p-6 shadow-[0_24px_80px_-24px_rgba(15,23,42,0.25)] backdrop-blur sm:p-9">
        <Link
          href="/"
          className="mb-8 flex items-center gap-2.5 font-semibold tracking-tight text-zinc-950"
          aria-label="Dona Auth home"
        >
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-zinc-950 text-sm text-white shadow-lg shadow-zinc-300">
            D
          </span>
          Dona Auth
        </Link>
        {children}
      </section>
    </main>
  );
}
