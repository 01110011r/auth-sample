"use client";

import { useEffect, useState } from "react";
import { Effect } from "effect";
import Link from "next/link";
import { authApi, PublicUser } from "@/lib/api/auth";
import { getAccessToken, setAccessToken } from "@/lib/auth/token-store";

export default function HomePage() {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void Effect.runPromise(
      Effect.gen(function* () {
        let accessToken = getAccessToken();
        if (!accessToken) {
          const session = yield* authApi.refresh();
          accessToken = session.accessToken;
        }
        return yield* authApi.me(accessToken);
      }),
    ).then(
      (currentUser) => setUser(currentUser),
      () => setUser(null),
    ).finally(() => setLoading(false));
  }, []);

  async function logout() {
    await Effect.runPromise(authApi.logout()).catch(() => undefined);
    setAccessToken(null);
    setUser(null);
  }

  if (loading) {
    return (
      <main className="grid min-h-screen place-items-center">
        <div className="flex items-center gap-3 rounded-full border border-white bg-white/80 px-5 py-3 text-sm font-medium text-zinc-600 shadow-lg">
          <span className="h-2 w-2 animate-pulse rounded-full bg-indigo-500" />
          Checking session
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl items-center px-6 py-16">
      <section className="w-full rounded-3xl border border-white/80 bg-white/90 p-8 shadow-[0_24px_80px_-24px_rgba(15,23,42,0.20)] backdrop-blur sm:p-10">
      <div className="mb-8 flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-zinc-950 text-base font-bold text-white">D</span>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400">Account</p>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-950">Dona Auth</h1>
        </div>
      </div>
      {user ? (
        <div className="space-y-6">
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5">
            <p className="text-sm text-zinc-500">Signed in as</p>
            <p className="mt-1 text-lg font-semibold text-zinc-950">{user.email}</p>
            {user.name && <p className="mt-1 text-sm text-zinc-600">{user.name}</p>}
          </div>
          <button
            type="button"
            onClick={logout}
            className="h-11 rounded-xl bg-zinc-950 px-5 font-semibold text-white shadow-lg shadow-zinc-200 hover:bg-zinc-800"
          >
            Sign out
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3 sm:flex-row">
          <Link className="h-11 rounded-xl bg-zinc-950 px-5 py-2.5 text-center font-semibold text-white" href="/login">
            Sign in
          </Link>
          <Link className="h-11 rounded-xl border border-zinc-200 bg-white px-5 py-2.5 text-center font-semibold text-zinc-800" href="/register">
            Create account
          </Link>
        </div>
      )}
      </section>
    </main>
  );
}
