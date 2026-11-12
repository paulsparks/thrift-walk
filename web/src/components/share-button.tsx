"use client";

import { useState } from "react";

export function ShareButton() {
    const [copied, setCopied] = useState(false);

    async function share() {
        const url = window.location.href;
        try {
            if (navigator.share) {
                await navigator.share({ title: document.title, url });
                return;
            }
            await navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            // The person closed the share sheet, or clipboard access was blocked.
        }
    }

    return (
        <div className="flex items-center gap-3">
            <output className="text-sm font-semibold">
                {copied ? "Link copied" : ""}
            </output>
            <button
                type="button"
                className="btn btn-ghost-outline btn-square btn-lg"
                aria-label="Share profile"
                onClick={share}
            >
                <svg
                    className="size-5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    strokeLinecap="round"
                    aria-hidden="true"
                >
                    <title>Share</title>
                    <circle cx="18" cy="5" r="3" />
                    <circle cx="6" cy="12" r="3" />
                    <circle cx="18" cy="19" r="3" />
                    <path d="M8.6 10.5l6.8-4M8.6 13.5l6.8 4" />
                </svg>
            </button>
        </div>
    );
}
