"use client";

import Link from "next/link";
import { type FormEvent, type ReactNode, useState } from "react";

const steps = [
    {
        title: "Discover",
        text: "Walk through procedurally generated thrift markets. Every stall is unique and stocked with items from users around the world.",
    },
    {
        title: "Digitize",
        text: "Use the 3D scan tool to upload your real-world items and turn your physical wardrobe into game-ready 3D assets.",
    },
    {
        title: "Purchase",
        text: "Buy and sell with other players. Manage your inventory and grow your reputation.",
    },
];

const iconProps = {
    className: "size-16",
    viewBox: "0 0 72 72",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 3,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
};

const categories: {
    name: string;
    href: string;
    count: string;
    color: string;
    icon: ReactNode;
}[] = [
    {
        name: "Vintage apparel",
        href: "/marketplace?category=apparel",
        count: "2.4k items",
        color: "bg-secondary text-secondary-content",
        icon: (
            <svg {...iconProps}>
                <title>Shirt</title>
                <path d="M26 10l10 6 10-6 18 10-7 12-7-3v31H22V29l-7 3-7-12z" />
            </svg>
        ),
    },
    {
        name: "Retro home",
        href: "/marketplace?category=home",
        count: "1.8k items",
        color: "bg-accent text-accent-content",
        icon: (
            <svg {...iconProps}>
                <title>Lamp</title>
                <path d="M36 8c-8 0-14 6-14 14v8h28v-8c0-8-6-14-14-14z" />
                <path d="M26 30l-4 30h28l-4-30M16 60h40" />
            </svg>
        ),
    },
    {
        name: "Collectibles",
        href: "/marketplace?category=collectibles",
        count: "950 items",
        color: "bg-[#F4F1DE] text-[#1E222A]",
        icon: (
            <svg {...iconProps}>
                <title>Star</title>
                <path d="M36 8l8 18 20 2-15 14 5 20-18-11-18 11 5-20L8 28l20-2z" />
            </svg>
        ),
    },
    {
        name: "Tech and gadgets",
        href: "/marketplace?category=tech",
        count: "1.1k items",
        color: "bg-info text-info-content",
        icon: (
            <svg {...iconProps}>
                <title>Monitor</title>
                <rect x="10" y="16" width="52" height="34" rx="4" />
                <path d="M26 62h20M36 50v12M24 28h24M24 38h12" />
            </svg>
        ),
    },
];

const gameLinks = [
    { label: "How to play", href: "#how" },
    { label: "Marketplace", href: "/marketplace" },
    { label: "3D scanning", href: "/scan" },
    { label: "Leaderboards", href: "/leaderboards" },
];

const companyLinks = [
    { label: "About us", href: "/about" },
    { label: "Connected sites", href: "/connected-sites" },
    { label: "Terms of service", href: "/terms" },
    { label: "Privacy policy", href: "/privacy" },
];

const navLinks = [
    { label: "Home", href: "/" },
    { label: "About", href: "/about" },
    { label: "3D scan", href: "/scan" },
    { label: "Marketplace", href: "/marketplace" },
];

function LogoMark({ size }: { size: number }) {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden="true"
        >
            <title>ThriftWalk logo</title>
            <circle cx="13" cy="4" r="2.5" />
            <path d="M10 8l-4 3 1 2 3-2 1.5 3-3 6 2 1 3.5-6 3 2.5V22h2v-7l-3-3 .5-3 2.5 2 1.5-1.8L15 8z" />
        </svg>
    );
}

export default function Home() {
    const [done, setDone] = useState(false);

    function onSubmit(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();
        // TODO: send e.currentTarget's email value to your signup endpoint
        setDone(true);
        e.currentTarget.reset();
    }

    return (
        <div className="bg-base-100 text-base-content font-sans text-lg">
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
                    <nav
                        className="navbar-center hidden lg:flex"
                        aria-label="Main"
                    >
                        <ul className="menu menu-horizontal gap-2 font-medium">
                            {navLinks.map((l, i) => (
                                <li key={l.label}>
                                    <Link
                                        href={l.href}
                                        className={
                                            i === 0 ? "menu-active" : undefined
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
                            href="/account"
                            className="btn btn-ghost btn-circle shadow-none hidden sm:inline-flex"
                            aria-label="Account"
                        >
                            <svg
                                className="size-6"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth={2}
                            >
                                <title>Account</title>
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

            <main id="top">
                <section className="hero py-16 lg:py-24">
                    <div className="hero-content mx-auto w-full max-w-6xl flex-col gap-12 px-6 lg:flex-row lg:justify-between">
                        <div className="max-w-xl">
                            <h1 className="font-display text-5xl font-extrabold leading-none tracking-tight sm:text-7xl lg:text-8xl">
                                Welcome to ThriftWalk
                            </h1>
                            <p className="mt-6 mb-8 text-xl opacity-80">
                                ThriftWalk brings popular online marketplaces to
                                life. Walk the stalls and aisles of sellers from
                                across the internet, then pick up something
                                you’d never find by scrolling.
                            </p>
                            <div className="flex flex-wrap gap-4">
                                <Link
                                    href="/play"
                                    className="btn btn-secondary btn-lg"
                                >
                                    Play now
                                </Link>
                                <Link
                                    href="#how"
                                    className="btn btn-ghost-outline btn-lg"
                                >
                                    How it works
                                </Link>
                            </div>
                        </div>
                        <div className="w-full max-w-md overflow-hidden rounded-3xl border-2 border-base-content bg-info shadow-[8px_8px_0_var(--color-base-content)]">
                            <svg
                                role="img"
                                viewBox="0 0 400 500"
                                className="block w-full"
                                preserveAspectRatio="xMidYMid slice"
                            >
                                <title>
                                    Illustration of a thrift stall with a
                                    clothing rack and a price tag
                                </title>
                                <rect
                                    y="380"
                                    width="400"
                                    height="120"
                                    fill="#1E222A"
                                />
                                <path
                                    d="M0 380h400"
                                    stroke="#F4F1DE"
                                    strokeWidth={3}
                                    strokeDasharray="14 12"
                                />
                                <rect
                                    x="50"
                                    y="110"
                                    width="300"
                                    height="10"
                                    rx="5"
                                    fill="#F4F1DE"
                                />
                                <rect
                                    x="62"
                                    y="110"
                                    width="8"
                                    height="270"
                                    fill="#F4F1DE"
                                />
                                <rect
                                    x="330"
                                    y="110"
                                    width="8"
                                    height="270"
                                    fill="#F4F1DE"
                                />
                                <g
                                    stroke="#1E222A"
                                    strokeWidth={3}
                                    strokeLinejoin="round"
                                >
                                    <path d="M118 120v14" stroke="#F4F1DE" />
                                    <path
                                        d="M93 140l25-8 25 8 8 40-22 6v110H82V186l-22-6z"
                                        fill="#FF4B4B"
                                        transform="translate(8 0)"
                                    />
                                    <path d="M185 120v14" stroke="#F4F1DE" />
                                    <path
                                        d="M160 140l25-8 25 8 6 150h-62z"
                                        fill="#00A896"
                                        transform="translate(0 6)"
                                    />
                                    <path d="M255 120v14" stroke="#F4F1DE" />
                                    <path
                                        d="M230 140l25-8 25 8 10 36-22 8v100h-26V184l-22-8z"
                                        fill="#F4F1DE"
                                        transform="translate(-4 4)"
                                    />
                                </g>
                                <g className="tag-sway">
                                    <path
                                        d="M260 60l42 20-4 44-46 8-18-34z"
                                        fill="#F4F1DE"
                                        stroke="#1E222A"
                                        strokeWidth={3}
                                        strokeLinejoin="round"
                                        transform="translate(0 40)"
                                    />
                                    <circle
                                        cx="262"
                                        cy="108"
                                        r="5"
                                        fill="#457B9D"
                                        stroke="#1E222A"
                                        strokeWidth={2}
                                    />
                                    <path
                                        d="M260 60v36"
                                        stroke="#F4F1DE"
                                        strokeWidth={3}
                                    />
                                    <text
                                        x="262"
                                        y="150"
                                        textAnchor="middle"
                                        fontFamily="Bricolage Grotesque,Arial Black,sans-serif"
                                        fontWeight={800}
                                        fontSize={22}
                                        fill="#1E222A"
                                    >
                                        $12
                                    </text>
                                </g>
                                <rect
                                    x="40"
                                    y="410"
                                    width="320"
                                    height="50"
                                    rx="8"
                                    fill="#457B9D"
                                    stroke="#F4F1DE"
                                    strokeWidth={3}
                                />
                                <text
                                    x="200"
                                    y="443"
                                    textAnchor="middle"
                                    fontFamily="Bricolage Grotesque,Arial Black,sans-serif"
                                    fontWeight={800}
                                    fontSize={22}
                                    fill="#F4F1DE"
                                >
                                    Stall 14
                                </text>
                            </svg>
                        </div>
                    </div>
                </section>

                <section
                    id="how"
                    className="border-t-2 border-base-content py-20"
                >
                    <div className="mx-auto max-w-6xl px-6">
                        <h2 className="font-display text-4xl font-extrabold tracking-tight sm:text-5xl">
                            How it works
                        </h2>
                        <p className="mt-3 mb-14 max-w-lg opacity-80">
                            Three steps from your closet to someone else’s cart.
                        </p>
                        <ol className="grid gap-10 md:grid-cols-3 md:gap-6">
                            {steps.map((s, i) => (
                                <li
                                    key={s.title}
                                    className="card card-border border-base-content bg-base-200"
                                >
                                    <div className="card-body pt-8">
                                        <div className="badge badge-accent badge-lg absolute -top-4 left-5 font-display font-extrabold">
                                            {i + 1}
                                        </div>
                                        <h3 className="card-title font-display text-2xl font-extrabold">
                                            {s.title}
                                        </h3>
                                        <p className="opacity-80">{s.text}</p>
                                    </div>
                                </li>
                            ))}
                        </ol>
                    </div>
                </section>

                <section
                    id="market"
                    className="border-t-2 border-base-content bg-neutral py-20 text-neutral-content"
                >
                    <div className="mx-auto max-w-6xl px-6">
                        <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
                            <div>
                                <h2 className="font-display text-4xl font-extrabold tracking-tight sm:text-5xl">
                                    What’s in the market?
                                </h2>
                                <p className="mt-3 max-w-lg opacity-80">
                                    Browse the diverse collection of thrifted
                                    treasures.
                                </p>
                            </div>
                            <Link
                                href="/marketplace"
                                className="border-b-2 border-accent font-semibold"
                            >
                                View all items
                            </Link>
                        </div>
                        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                            {categories.map((c) => (
                                <Link
                                    key={c.name}
                                    href={c.href}
                                    className={`card min-h-64 border-2 border-neutral-content transition-transform hover:-rotate-1 ${c.color}`}
                                >
                                    <div className="card-body justify-between">
                                        {c.icon}
                                        <div>
                                            <h3 className="font-display text-2xl font-extrabold">
                                                {c.name}
                                            </h3>
                                            <span className="badge badge-outline mt-2 border-dashed">
                                                {c.count}
                                            </span>
                                        </div>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </div>
                </section>
            </main>

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
                            The online destination for virtual selling and 3D
                            social commerce.
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
        </div>
    );
}
