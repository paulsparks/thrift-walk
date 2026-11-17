"use client";

import { IconMenu2, IconShoppingCart, IconUser } from "@tabler/icons-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { ThriftWalkLogo } from "./thriftwalk-logo";

const navLinks = [
    { label: "Home", href: "/" },
    { label: "About", href: "/about" },
    { label: "My Stores", href: "/my-store" },
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
                            <IconMenu2 size={24} aria-hidden="true" />
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
                            <ThriftWalkLogo size={18} />
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
                        <IconShoppingCart size={24} aria-hidden="true" />
                    </Link>
                    <Link
                        href="/profile"
                        className="btn btn-ghost btn-circle shadow-none hidden sm:inline-flex"
                        aria-label="Profile"
                    >
                        <IconUser size={24} aria-hidden="true" />
                    </Link>
                    <Link
                        href="/play"
                        className="btn btn-secondary btn-sm sm:btn-md"
                    >
                        Start walking
                    </Link>
                </div>
            </div>
        </header>
    );
}
