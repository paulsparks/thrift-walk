"use client";

import { useActionState, useState } from "react";

import {
    deleteApprovalCode,
    generateApprovalCode,
    submitApprovalCode,
} from "@/lib/approval-actions";

export function ApprovalForm({ redirectTo }: { redirectTo: string }) {
    const [error, action, pending] = useActionState(
        submitApprovalCode.bind(null, redirectTo),
        "",
    );
    return (
        <form action={action} className="grid gap-4">
            <label className="fieldset">
                <span className="fieldset-legend">Six-digit approval code</span>
                <input
                    name="code"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]{6}"
                    minLength={6}
                    maxLength={6}
                    autoComplete="one-time-code"
                    className="input w-full"
                    required
                />
            </label>
            {error && <p role="alert">{error}</p>}
            <button
                type="submit"
                disabled={pending}
                className="btn btn-primary"
            >
                Approve my account
            </button>
        </form>
    );
}

function ApprovalCodeRow({ code }: { code: string }) {
    const [message, setMessage] = useState("");
    const [error, remove, pending] = useActionState(
        deleteApprovalCode.bind(null, code),
        "",
    );
    async function copy() {
        try {
            await navigator.clipboard.writeText(code);
            setMessage("Copied");
        } catch {
            setMessage("Clipboard unavailable. Select the code to copy it.");
        }
    }
    return (
        <li className="border-base-300 border-t py-2">
            <form action={remove} className="flex items-center gap-2">
                <code className="mr-auto select-all text-lg tabular-nums">
                    {code}
                </code>
                <button
                    type="button"
                    className="btn btn-sm"
                    onClick={copy}
                    aria-label={`Copy code ${code}`}
                >
                    Copy
                </button>
                <button
                    type="submit"
                    className="btn btn-sm btn-error btn-outline"
                    disabled={pending}
                    aria-label={`Delete code ${code}`}
                >
                    Delete
                </button>
            </form>
            <span role="status" className="text-sm">
                {message}
            </span>
            {error && <p role="alert">{error}</p>}
        </li>
    );
}

export function ApprovalCodes({ codes }: { codes: string[] }) {
    const [result, action, pending] = useActionState(generateApprovalCode, {
        code: "",
        error: "",
    });
    return (
        <section className="max-w-lg">
            <h2 className="text-xl font-bold">Approval codes</h2>
            <form action={action} className="my-3">
                <button
                    type="submit"
                    className="btn btn-secondary"
                    disabled={pending}
                >
                    Generate approval code
                </button>
            </form>
            {result.error && <p role="alert">{result.error}</p>}
            <p role="status" className="sr-only">
                {result.code && `Generated code ${result.code}`}
            </p>
            {codes.length ? (
                <ul>
                    {codes.map((code) => (
                        <ApprovalCodeRow key={code} code={code} />
                    ))}
                </ul>
            ) : (
                <p>No unused approval codes.</p>
            )}
        </section>
    );
}
