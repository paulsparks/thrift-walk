// SAVE AS: web/src/app/about/page.tsx  (ABOUT PAGE)

import Link from "next/link";
import type { ReactNode } from "react";

export const metadata = {
    title: "About | ThriftWalk",
    description:
        "ThriftWalk was born from the idea that shopping for vintage and second-hand items should be as fun as playing an RPG.",
};

const iconProps = {
    className: "size-8",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
};

// Placeholder partner names from the wireframe. Replace with real integrations.
const platforms: {
    name: string;
    status: string;
    color: string;
    icon: ReactNode;
}[] = [
    {
        name: "RetroMarket",
        status: "Verified Partner",
        color: "bg-secondary text-secondary-content",
        icon: (
            <svg {...iconProps}>
                <title>Price tags</title>
                <path d="M3 3h8l10 10-8 8L3 11z" />
                <circle cx="7.5" cy="7.5" r="1.5" />
            </svg>
        ),
    },
    {
        name: "VintageHub",
        status: "API Integrated",
        color: "bg-accent text-accent-content",
        icon: (
            <svg {...iconProps}>
                <title>Shirt</title>
                <path d="M8 3l4 2 4-2 6 3-2 4-2-1v11H6V9l-2 1-2-4z" />
            </svg>
        ),
    },
    {
        name: "DecorSync",
        status: "Official Bridge",
        color: "bg-info text-info-content",
        icon: (
            <svg {...iconProps}>
                <title>Sofa</title>
                <path d="M4 11V8a3 3 0 013-3h10a3 3 0 013 3v3" />
                <path d="M2 12a2 2 0 014 0v3h12v-3a2 2 0 014 0v5H2z" />
                <path d="M5 17v2M19 17v2" />
            </svg>
        ),
    },
    {
        name: "GlobalThrift",
        status: "Beta Sync",
        color: "bg-base-100 text-base-content",
        icon: (
            <svg {...iconProps}>
                <title>Globe</title>
                <circle cx="12" cy="12" r="9" />
                <path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" />
            </svg>
        ),
    },
];

// Placeholder team from the wireframe. Swap initials for photos with next/image when you have them.
const team = [
    {
        name: "Paul Sparks",
        color: "bg-primary text-primary-content",
    },
    {
        name: "JR Stidham",
        color: "bg-primary text-primary-content",
    },
    {
        name: "Patrick Newman",
        color: "bg-primary text-primary-content",
    },
    {
        name: "Henry Pursell",
        color: "bg-primary text-primary-content",
    },
    {
        name: "Ivan Roller",
        color: "bg-primary text-primary-content",
    },
    {
        name: "Conner Morgan",
        color: "bg-primary text-primary-content",
    },
];

const gridPath = [
    ...Array.from({ length: 11 }, (_, i) => `M${i * 48} 0v360`),
    ...Array.from({ length: 8 }, (_, i) => `M0 ${i * 48}h480`),
].join("");

function initials(name: string) {
    return name
        .split(" ")
        .map((part) => part[0])
        .join("");
}

export default function About() {
    return (
        <main>
            <section className="border-b-2 border-base-content bg-base-200 py-16 lg:py-24">
                <div className="mx-auto max-w-4xl px-6 text-center">
                    <h1 className="font-display text-5xl font-extrabold leading-tight tracking-tight sm:text-6xl lg:text-7xl">
                        Our Mission to{" "}
                        <span className="inline-block -rotate-1 rounded-lg bg-accent px-3 text-accent-content">
                            Gamify
                        </span>{" "}
                        Thrifting
                    </h1>
                    <p className="mx-auto mt-6 max-w-2xl text-xl opacity-80">
                        ThriftWalk was born from the idea that shopping for
                        vintage and second-hand items should be as fun as
                        playing an RPG.
                    </p>
                </div>
            </section>

            <section className="py-20">
                <div className="mx-auto grid max-w-6xl items-center gap-12 px-6 lg:grid-cols-2">
                    <div className="-rotate-2 overflow-hidden rounded-3xl border-2 border-base-content bg-base-200 shadow-[8px_8px_0_var(--color-base-content)]">
                        <svg
                            role="img"
                            viewBox="0 0 480 360"
                            className="block w-full"
                        >
                            <title>
                                Early sketch of a thrift stall floor plan with a
                                dotted path through it
                            </title>
                            <path
                                d={gridPath}
                                stroke="currentColor"
                                strokeOpacity={0.12}
                            />
                            <g
                                fill="none"
                                stroke="#1E222A"
                                strokeWidth={3}
                                strokeLinejoin="round"
                                strokeLinecap="round"
                            >
                                <rect
                                    x="40"
                                    y="50"
                                    width="120"
                                    height="70"
                                    rx="6"
                                    fill="#00A896"
                                />
                                <rect
                                    x="200"
                                    y="50"
                                    width="120"
                                    height="70"
                                    rx="6"
                                    fill="#FF4B4B"
                                />
                                <rect
                                    x="360"
                                    y="50"
                                    width="90"
                                    height="70"
                                    rx="6"
                                    fill="#457B9D"
                                />
                                <rect
                                    x="40"
                                    y="240"
                                    width="120"
                                    height="70"
                                    rx="6"
                                    fill="#F4F1DE"
                                />
                                <rect
                                    x="200"
                                    y="240"
                                    width="250"
                                    height="70"
                                    rx="6"
                                    fill="#00A896"
                                />
                                <path
                                    d="M30 180c60 0 70-40 130-40s60 60 120 60 70-50 130-50"
                                    stroke="#1E222A"
                                    strokeDasharray="4 12"
                                    strokeWidth={5}
                                />
                            </g>
                            <circle cx="30" cy="180" r="12" fill="#1E222A" />
                            <circle cx="30" cy="180" r="5" fill="#F4F1DE" />
                            <text
                                x="402"
                                y="352"
                                textAnchor="end"
                                fontFamily="Bricolage Grotesque,Arial Black,sans-serif"
                                fontWeight={800}
                                fontSize={18}
                                fill="#1E222A"
                            >
                                sketch no. 1
                            </text>
                        </svg>
                    </div>
                    <div>
                        <h2 className="font-display text-4xl font-extrabold tracking-tight sm:text-5xl">
                            How it started
                        </h2>
                        <div className="mt-6 space-y-5 opacity-80">
                            <p>
                                We noticed that online marketplaces were
                                becoming sterile and transactional. The joy of
                                the “hunt” in a real-world thrift store — the
                                smell of old books, the surprise of finding a
                                rare jacket — was missing from the digital
                                experience.
                            </p>
                            <p>
                                ThriftWalk creates a virtual space where you can
                                “walk” through stalls, interact with items in
                                3D, and connect with a community of collectors
                                in a game-like environment.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            <section className="border-y-2 border-base-content bg-neutral py-20 text-neutral-content">
                <div className="mx-auto max-w-6xl px-6">
                    <div className="text-center">
                        <h2 className="font-display text-4xl font-extrabold tracking-tight sm:text-5xl">
                            Connected platforms
                        </h2>
                        <p className="mx-auto mt-3 max-w-lg opacity-80">
                            Sync your inventory from your favorite marketplaces
                            directly into ThriftWalk.
                        </p>
                    </div>
                    <ul className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                        {platforms.map((p) => (
                            <li
                                key={p.name}
                                className="card card-border border-neutral-content/40"
                            >
                                <div className="card-body items-center text-center">
                                    <div
                                        className={`grid size-16 place-items-center rounded-full ${p.color}`}
                                    >
                                        {p.icon}
                                    </div>
                                    <h3 className="mt-2 font-display text-xl font-extrabold">
                                        {p.name}
                                    </h3>
                                    <span className="badge badge-outline border-dashed">
                                        {p.status}
                                    </span>
                                </div>
                            </li>
                        ))}
                    </ul>
                    <div className="mt-12 text-center">
                        <Link href="/contact" className="btn btn-accent btn-lg">
                            Request integration
                        </Link>
                    </div>
                </div>
            </section>

            <section className="py-20">
                <div className="mx-auto max-w-6xl px-6">
                    <h2 className="text-center font-display text-4xl font-extrabold tracking-tight sm:text-5xl">
                        Built by collectors
                    </h2>
                    <ul className="mt-14 grid gap-10 sm:grid-cols-2 lg:grid-cols-3">
                        {team.map((m) => (
                            <li
                                key={m.name}
                                className="flex flex-col items-center text-center"
                            >
                                <div className="avatar avatar-placeholder">
                                    <div
                                        className={`w-28 rounded-full border-2 border-base-content ${m.color}`}
                                    >
                                        <span
                                            className="font-display text-3xl font-extrabold"
                                            aria-hidden="true"
                                        >
                                            {initials(m.name)}
                                        </span>
                                    </div>
                                </div>
                                <h3 className="mt-4 font-display text-xl font-extrabold">
                                    {m.name}
                                </h3>
                            </li>
                        ))}
                    </ul>
                </div>
            </section>
        </main>
    );
}
