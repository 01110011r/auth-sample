"use client";

import { Suspense, useEffect, useState } from "react";
import { Effect } from "effect";
import { useRouter, useSearchParams } from "next/navigation";
import { authApi } from "@/lib/api/auth";

function AuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState("");

  useEffect(() => {
    const oauthError = searchParams.get("error");
    if (oauthError) {
      setError(
        oauthError === "telegram_oidc_cancelled"
          ? "Telegram login was cancelled"
          : "Telegram login could not be completed",
      );
      return;
    }
    void Effect.runPromise(authApi.refresh()).then(
      () => router.replace("/"),
      (caught) => setError(caught instanceof Error ? caught.message : "Social login failed"),
    );
  }, [router, searchParams]);

  return (
    <div className="py-8 text-center">
      {error ? (
        <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      ) : (
        <div className="flex flex-col items-center gap-3">
          <span className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-200 border-t-indigo-600" />
          <p className="text-sm font-medium text-zinc-600">Completing sign-in...</p>
        </div>
      )}
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<p>Completing sign-in...</p>}>
      <AuthCallbackContent />
    </Suspense>
  );
}
