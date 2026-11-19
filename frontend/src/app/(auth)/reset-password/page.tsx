"use client";

import { FormEvent, Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Effect } from "effect";
import { authApi } from "@/lib/api/auth";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (!token) {
      setError("Reset token is missing");
      return;
    }
    try {
      await Effect.runPromise(authApi.resetPassword(token, password));
      setMessage("Password updated");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Reset failed");
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      <div>
        <p className="mb-2 text-sm font-medium text-indigo-600">Account recovery</p>
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-950">Choose a new password</h1>
      </div>
      <label className="flex flex-col gap-2 text-sm font-medium text-zinc-700">
        New password
        <input
          type="password"
          required
          minLength={8}
          maxLength={72}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="h-12 rounded-xl border border-zinc-200 bg-zinc-50 px-4 text-base outline-none focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-100"
          placeholder="At least 8 characters"
        />
      </label>
      {message && <p role="status" className="rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-700">{message}</p>}
      {error && <p role="alert" className="rounded-xl border border-red-100 bg-red-50 px-3 py-2.5 text-sm text-red-700">{error}</p>}
      <button className="h-12 rounded-xl bg-zinc-950 px-4 font-semibold text-white shadow-lg shadow-zinc-200 hover:bg-zinc-800">
        Update password
      </button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<p>Loading...</p>}>
      <ResetPasswordForm />
    </Suspense>
  );
}
