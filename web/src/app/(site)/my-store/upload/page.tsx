import type { ReactNode } from "react";

import { ScanDropzone } from "@/components/scan-dropzone";

export const metadata = {
    title: "3D Scan | ThriftWalk",
    description:
        "Upload images of your physical items to generate a high-fidelity 3D model for the game.",
};

const tips = [
    {
        title: "Uniform lighting",
        text: "Avoid harsh shadows or bright glares on your item.",
    },
    {
        title: "360° coverage",
        text: "Take photos from high, medium, and low angles all around.",
    },
    {
        title: "Steady camera",
        text: "Blurred photos lead to messy scans. Use a tripod if possible.",
    },
];

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

// Placeholder scans from the wireframe. Replace with real scan jobs.
const scans: {
    name: string;
    stage: string;
    percent: number;
    bar: string;
    icon: ReactNode;
}[] = [
    {
        name: "Vintage Denim Jacket",
        stage: "Processing meshes",
        percent: 65,
        bar: "progress-secondary",
        icon: (
            <svg {...iconProps}>
                <title>Jacket</title>
                <path d="M8 3l4 2 4-2 6 3-2 4-2-1v11H6V9l-2 1-2-4z" />
            </svg>
        ),
    },
    {
        name: "Analog Camera (Draft)",
        stage: "Waiting for images…",
        percent: 20,
        bar: "progress-info",
        icon: (
            <svg {...iconProps}>
                <title>Camera</title>
                <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
                <circle cx="12" cy="13" r="3.5" />
            </svg>
        ),
    },
];

export default function ScanPage() {
    return (
        <main className="py-12 lg:py-16">
            <div className="mx-auto max-w-4xl px-6">
                <h1 className="font-display text-4xl font-extrabold tracking-tight sm:text-5xl">
                    Digitize your items
                </h1>
                <p className="mt-3 max-w-xl opacity-80">
                    Upload images of your physical items to generate a
                    high-fidelity 3D model for the game.
                </p>

                <div className="mt-10">
                    <ScanDropzone />
                </div>

                <section className="mt-12 rounded-box border-2 border-base-content bg-neutral p-8 text-neutral-content">
                    <h2 className="flex items-center gap-3 font-display text-2xl font-extrabold">
                        <svg
                            className="size-6"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth={2}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                        >
                            <title>Lightbulb</title>
                            <path d="M9 18h6M10 21h4M12 3a6 6 0 00-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0012 3z" />
                        </svg>
                        Tips for 3D success
                    </h2>
                    <ol className="mt-6 grid gap-8 md:grid-cols-3">
                        {tips.map((tip, i) => (
                            <li key={tip.title} className="flex gap-4">
                                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-accent font-display font-extrabold text-accent-content">
                                    {i + 1}
                                </span>
                                <div>
                                    <h3 className="font-display text-lg font-extrabold">
                                        {tip.title}
                                    </h3>
                                    <p className="mt-1 text-base opacity-80">
                                        {tip.text}
                                    </p>
                                </div>
                            </li>
                        ))}
                    </ol>
                </section>

                <section className="mt-12">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <h2 className="font-display text-3xl font-extrabold tracking-tight">
                            Recent processing
                        </h2>
                        <span className="badge badge-accent badge-lg font-semibold">
                            {scans.length} active scans
                        </span>
                    </div>
                    <ul className="mt-6 grid gap-4">
                        {scans.map((scan) => (
                            <li
                                key={scan.name}
                                className="card card-border flex-row items-center gap-5 border-base-content bg-base-100 p-5"
                            >
                                <div className="grid size-16 shrink-0 place-items-center rounded-lg border-2 border-base-content bg-base-200">
                                    {scan.icon}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <h3 className="font-display text-lg font-extrabold">
                                        {scan.name}
                                    </h3>
                                    <progress
                                        className={`progress ${scan.bar} mt-2 w-full`}
                                        value={scan.percent}
                                        max={100}
                                        aria-label={`${scan.name} scan progress`}
                                    />
                                    <div className="mt-1 flex justify-between text-xs font-semibold tracking-wide uppercase opacity-70">
                                        <span>{scan.stage}</span>
                                        <span>{scan.percent}%</span>
                                    </div>
                                </div>
                            </li>
                        ))}
                    </ul>
                </section>
            </div>
        </main>
    );
}
