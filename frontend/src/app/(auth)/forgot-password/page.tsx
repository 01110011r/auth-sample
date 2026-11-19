"use client";

import { FormEvent, useState } from "react";
import { Effect } from "effect";
import { authApi } from "@/lib/api/auth";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    try {
      const result = await Effect.runPromise(authApi.forgotPassword(email));
      setMessage(result.message);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Request failed");
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      <div>
        <p className="mb-2 text-sm font-medium text-indigo-600">Account recovery</p>
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-950">Reset your password</h1>
        <p className="mt-2 text-sm leading-6 text-zinc-500">We’ll send reset instructions if an account exists for this email.</p>
      </div>
      <label className="flex flex-col gap-2 text-sm font-medium text-zinc-700">
        Email
        <input
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="h-12 rounded-xl border border-zinc-200 bg-zinc-50 px-4 text-base outline-none focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-100"
        />
      </label>
      {message && <p role="status" className="rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-700">{message}</p>}
      {error && <p role="alert" className="rounded-xl border border-red-100 bg-red-50 px-3 py-2.5 text-sm text-red-700">{error}</p>}
      <button className="h-12 rounded-xl bg-zinc-950 px-4 font-semibold text-white shadow-lg shadow-zinc-200 hover:bg-zinc-800">
        Send reset link
      </button>
    </form>
  );
}
