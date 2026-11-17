import { ScanDropzone } from "@/components/scan-dropzone";
import { ScanList } from "@/components/scan-list";

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

                <ScanList />
            </div>
        </main>
    );
}
