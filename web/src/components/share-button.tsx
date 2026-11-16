"use client";

import { IconShare } from "@tabler/icons-react";
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
                <IconShare size={20} aria-hidden="true" />
            </button>
        </div>
    );
}
