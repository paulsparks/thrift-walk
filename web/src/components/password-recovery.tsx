"use client";
import Link from "next/link";
import { useState } from "react";
export function PasswordRecovery({ reset = false }: { reset?: boolean }) {
    const [busy, setBusy] = useState(false),
        [message, setMessage] = useState("");
    async function submit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        if (busy) return;
        const data = new FormData(e.currentTarget);
        setBusy(true);
        setMessage("");
        try {
            const token = new URLSearchParams(window.location.search).get(
                "token",
            );
            if (reset && !token)
                throw new Error(
                    "This recovery link is invalid. Request a new one.",
                );
            const response = await fetch(
                `/api/auth/${reset ? "reset-password" : "request-password-reset"}`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(
                        reset
                            ? { token, newPassword: data.get("password") }
                            : {
                                  email: data.get("email"),
                                  redirectTo: "/reset-password",
                              },
                    ),
                },
            );
            if (!response.ok)
                throw new Error(
                    "Recovery is unavailable or the link expired. Please retry or request a new link.",
                );
            setMessage(
                reset
                    ? "Your password was updated. You can sign in."
                    : "If this email has an account, a recovery link will be sent.",
            );
        } catch (e) {
            setMessage((e as Error).message);
        } finally {
            setBusy(false);
        }
    }
    return (
        <main className="mx-auto max-w-md space-y-6 p-8">
            <h1 className="text-3xl font-bold">
                {reset ? "Choose a new password" : "Recover your password"}
            </h1>
            <form onSubmit={submit} className="space-y-4">
                <label>
                    {reset ? "New password" : "Email"}
                    <input
                        className="input block w-full"
                        name={reset ? "password" : "email"}
                        type={reset ? "password" : "email"}
                        autoComplete={reset ? "new-password" : "email"}
                        minLength={reset ? 8 : undefined}
                        required
                        disabled={busy}
                    />
                </label>
                <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={busy}
                >
                    {busy
                        ? "Please wait…"
                        : reset
                          ? "Update password"
                          : "Send recovery link"}
                </button>
            </form>
            <p role="status">{message}</p>
            <Link href="/sign-in" className="link">
                Back to sign in
            </Link>
        </main>
    );
}
