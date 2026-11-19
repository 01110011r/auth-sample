"use client";

import { Effect } from "effect";
import { useRouter } from "next/navigation";
import { AuthForm } from "@/features/auth/auth-form";
import { authApi } from "@/lib/api/auth";

export default function RegisterPage() {
  const router = useRouter();

  async function register(values: { email: string; password: string; name?: string }) {
    await Effect.runPromise(
      authApi.register(values).pipe(
        Effect.tap(() => Effect.sync(() => router.replace("/"))),
      ),
    );
  }

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="w-full">
        <p className="mb-2 text-sm font-medium text-indigo-600">Get started</p>
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-950">Create your account</h1>
      </div>
      <AuthForm mode="register" onSubmit={register} />
    </div>
  );
}
