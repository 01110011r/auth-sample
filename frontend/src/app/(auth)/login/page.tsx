"use client";

import { Effect } from "effect";
import { useRouter } from "next/navigation";
import { AuthForm } from "@/features/auth/auth-form";
import { SocialButtons } from "@/features/auth/social-buttons";
import { authApi } from "@/lib/api/auth";

export default function LoginPage() {
  const router = useRouter();

  async function login(values: { email: string; password: string }) {
    await Effect.runPromise(
      authApi.login(values).pipe(
        Effect.tap(() => Effect.sync(() => router.replace("/"))),
      ),
    );
  }

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="w-full">
        <p className="mb-2 text-sm font-medium text-indigo-600">Welcome back</p>
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-950">Sign in to your account</h1>
      </div>
      <AuthForm mode="login" onSubmit={login} />
      <SocialButtons />
    </div>
  );
}
