"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { LogoMark } from "./logo-mark";

const navLinks = [
    { label: "Home", href: "/" },
    { label: "About", href: "/about" },
    { label: "My Store", href: "/my-store" },
];

export function SiteHeader() {
    const pathname = usePathname();

    return (
        <header className="sticky top-0 z-20 bg-base-100 border-b-2 border-base-content">
            <div className="navbar mx-auto max-w-6xl px-6">
                <div className="navbar-start">
                    <details className="dropdown lg:hidden">
                        <summary
                            className="btn btn-ghost btn-square shadow-none list-none"
                            aria-label="Open menu"
                        >
                            <svg
                                className="size-6"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth={2}
                                strokeLinecap="round"
                            >
                                <title>Menu</title>
                                <path d="M4 7h16M4 12h16M4 17h16" />
                            </svg>
                        </summary>
                        <ul className="menu dropdown-content bg-base-100 border-2 border-base-content rounded-box z-30 mt-3 w-52 p-2">
                            {navLinks.map((l) => (
                                <li key={l.label}>
                                    <Link href={l.href}>{l.label}</Link>
                                </li>
                            ))}
                        </ul>
                    </details>
                    <Link
                        href="/"
                        className="flex items-center gap-2.5 font-display text-2xl font-extrabold tracking-tight"
                    >
                        <span className="grid size-9 place-items-center rounded-lg bg-primary text-primary-content">
                            <LogoMark size={18} />
                        </span>
                        ThriftWalk
                    </Link>
                </div>
                <nav className="navbar-center hidden lg:flex" aria-label="Main">
                    <ul className="menu menu-horizontal gap-2 font-medium">
                        {navLinks.map((l) => (
                            <li key={l.label}>
                                <Link
                                    href={l.href}
                                    className={
                                        pathname === l.href
                                            ? "menu-active"
                                            : undefined
                                    }
                                    aria-current={
                                        pathname === l.href ? "page" : undefined
                                    }
                                >
                                    {l.label}
                                </Link>
                            </li>
                        ))}
                    </ul>
                </nav>
                <div className="navbar-end gap-2">
                    <Link
                        href="/cart"
                        className="btn btn-ghost btn-circle shadow-none hidden sm:inline-flex"
                        aria-label="Cart"
                    >
                        <svg
                            className="size-6"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth={2}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <title>Cart</title>
                            <path d="M3 4h3l2.5 11h9L20 7H7" />
                            <circle cx="9.5" cy="19" r="1.4" />
                            <circle cx="17" cy="19" r="1.4" />
                        </svg>
                    </Link>
                    <Link
                        href="/profile"
                        className="btn btn-ghost btn-circle shadow-none hidden sm:inline-flex"
                        aria-label="Profile"
                    >
                        <svg
                            className="size-6"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth={2}
                        >
                            <title>Profile</title>
                            <circle cx="12" cy="8" r="4" />
                            <path d="M4 21c0-4 3.5-6 8-6s8 2 8 6" />
                        </svg>
                    </Link>
                    <Link
                        href="/play"
                        className="btn btn-accent btn-sm sm:btn-md"
                    >
                        Start walking
                    </Link>
                </div>
            </div>
        </header>
    );
}
