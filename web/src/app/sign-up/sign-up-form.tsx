"use client";

import { useRouter } from "next/navigation";
import { type SubmitEvent, useState } from "react";

import { signUp } from "@/lib/auth-client";

export function SignUpForm({ redirectTo }: { redirectTo: string }) {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string>();

    async function onSubmit(e: SubmitEvent<HTMLFormElement>) {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        const password = String(data.get("password"));

        if (password !== String(data.get("confirmPassword"))) {
            setError("Passwords do not match.");
            return;
        }

        await signUp.email(
            {
                name: String(data.get("name")),
                email: String(data.get("email")),
                password,
            },
            {
                onRequest: () => {
                    setError(undefined);
                    setLoading(true);
                },
                onSuccess: () => {
                    // better-auth signs the user in after sign-up by default.
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
                <span className="fieldset-legend">Full name</span>
                <input
                    type="text"
                    name="name"
                    placeholder="Full name"
                    autoComplete="name"
                    className="input w-full"
                    required
                />
            </label>
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
                    placeholder="At least 8 characters"
                    autoComplete="new-password"
                    minLength={8}
                    className="input w-full"
                    required
                />
            </label>
            <label className="fieldset">
                <span className="fieldset-legend">Confirm password</span>
                <input
                    type="password"
                    name="confirmPassword"
                    placeholder="Confirm password"
                    autoComplete="new-password"
                    minLength={8}
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
                Create account
            </button>
        </form>
    );
}
