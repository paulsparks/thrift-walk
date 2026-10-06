"use client";

import { useRouter } from "next/navigation";
import { type SubmitEvent, useState } from "react";

import { signIn } from "@/lib/auth-client";

export function SignInForm({ redirectTo }: { redirectTo: string }) {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string>();

    async function onSubmit(e: SubmitEvent<HTMLFormElement>) {
        e.preventDefault();
        const data = new FormData(e.currentTarget);

        await signIn.email(
            {
                email: String(data.get("email")),
                password: String(data.get("password")),
            },
            {
                onRequest: () => {
                    setError(undefined);
                    setLoading(true);
                },
                onSuccess: () => {
                    // Leave `loading` on while navigating.
                    router.replace(redirectTo);
                    router.refresh();
                },
                onError: (ctx) => {
                    setLoading(false);
                    setError(ctx.error.message);
                },
            },
        );
    }

    return (
        <form onSubmit={onSubmit} className="flex flex-col gap-3">
            <label className="fieldset">
                <span className="fieldset-legend">Email</span>
                <input
                    type="email"
                    name="email"
                    placeholder="your@email.com"
                    autoComplete="email"
                    className="input w-full"
                    required
                />
            </label>
            <label className="fieldset">
                <span className="fieldset-legend">Password</span>
                <input
                    type="password"
                    name="password"
                    placeholder="Password"
                    autoComplete="current-password"
                    className="input w-full"
                    required
                />
            </label>

            {error && (
                <div role="alert" className="alert alert-error alert-soft">
                    <span>{error}</span>
                </div>
            )}

            <button
                type="submit"
                className="btn btn-primary mt-2"
                disabled={loading}
            >
                {loading && <span className="loading loading-spinner" />}
                Sign in
            </button>
        </form>
    );
}
