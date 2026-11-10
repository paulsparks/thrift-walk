import Link from "next/link";
import type { ReactNode } from "react";

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
        href: "/my-store",
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
        href: "/my-store",
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
        href: "/my-store",
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
        href: "/my-store",
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

export default function Home() {
    return (
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
                            across the internet, then pick up something you’d
                            never find by scrolling.
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
                                Illustration of a thrift stall with a clothing
                                rack and a price tag
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

            <section id="how" className="border-t-2 border-base-content py-20">
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
                            href="/my-store"
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
    );
}
