"use client";

// SAVE AS: web/src/components/site-footer.tsx  (FOOTER)

import Link from "next/link";
import { type FormEvent, useState } from "react";

import { LogoMark } from "./logo-mark";

const gameLinks = [
    { label: "How to play", href: "/#how" },
    { label: "My Store", href: "/my-store" },
    { label: "Leaderboards", href: "/leaderboards" },
];

const companyLinks = [
    { label: "About us", href: "/about" },
    { label: "Connected sites", href: "/connected-sites" },
    { label: "Terms of service", href: "/terms" },
    { label: "Privacy policy", href: "/privacy" },
];

export function SiteFooter() {
    const [done, setDone] = useState(false);

    function onSubmit(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();
        // TODO: send the email value to your signup endpoint
        setDone(true);
        e.currentTarget.reset();
    }

    return (
        <footer className="border-t-2 border-base-content py-14">
            <div className="mx-auto grid max-w-6xl gap-10 px-6 sm:grid-cols-2 lg:grid-cols-[1.2fr_1fr_1fr_1.4fr]">
                <div>
                    <Link
                        href="/"
                        className="flex items-center gap-2.5 font-display text-xl font-extrabold"
                    >
                        <span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-content">
                            <LogoMark size={16} />
                        </span>
                        ThriftWalk
                    </Link>
                    <p className="mt-3 text-base opacity-70">
                        The online destination for virtual selling and 3D social
                        commerce.
                    </p>
                </div>
                <nav
                    className="flex flex-col gap-2 text-base"
                    aria-label="Game"
                >
                    <h4 className="mb-1 font-display text-lg font-extrabold">
                        Game
                    </h4>
                    {gameLinks.map((l) => (
                        <Link
                            key={l.label}
                            className="link link-hover opacity-80"
                            href={l.href}
                        >
                            {l.label}
                        </Link>
                    ))}
                </nav>
                <nav
                    className="flex flex-col gap-2 text-base"
                    aria-label="Company"
                >
                    <h4 className="mb-1 font-display text-lg font-extrabold">
                        Company
                    </h4>
                    {companyLinks.map((l) => (
                        <Link
                            key={l.label}
                            className="link link-hover opacity-80"
                            href={l.href}
                        >
                            {l.label}
                        </Link>
                    ))}
                </nav>
                <div>
                    <h4 className="mb-1 font-display text-lg font-extrabold">
                        Join the market
                    </h4>
                    <p className="mb-3 text-base opacity-80">
                        Get updates on new stalls and items.
                    </p>
                    <form onSubmit={onSubmit} className="join w-full">
                        <input
                            type="email"
                            name="email"
                            required
                            placeholder="Email address"
                            aria-label="Email address"
                            className="input join-item w-full bg-base-200"
                        />
                        <button
                            className="btn btn-primary join-item"
                            type="submit"
                        >
                            Join
                        </button>
                    </form>
                    <div
                        role="status"
                        className="mt-2 min-h-6 text-base font-semibold"
                    >
                        {done ? "Thanks, you’re on the list." : ""}
                    </div>
                </div>
            </div>
            <div className="mx-auto mt-12 max-w-6xl border-t border-base-content/20 px-6 pt-5 text-sm opacity-70">
                © 2026 ThriftWalk. All rights reserved.
            </div>
        </footer>
    );
}
