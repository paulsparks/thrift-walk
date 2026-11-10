import Link from "next/link";

import { StoreBrowser } from "@/components/store-browser";

export const metadata = {
    title: "My Store | ThriftWalk",
    description:
        "Browse second-hand finds from the community, or turn your own items into 3D models and list them in seconds.",
};

export default function MyStore() {
    return (
        <main>
            <section className="border-b-2 border-base-content bg-base-200 py-12 lg:py-16">
                <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-8 px-6">
                    <div className="max-w-xl">
                        <h1 className="font-display text-4xl font-extrabold tracking-tight sm:text-5xl">
                            The ThriftWalk Store
                        </h1>
                        <p className="mt-3 opacity-80">
                            Browse second-hand finds from the community, or turn
                            your own items into 3D models and list them in
                            seconds.
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-4">
                        <Link
                            href="/my-store/upload"
                            className="btn btn-accent"
                        >
                            <svg
                                className="size-5"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth={2}
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                aria-hidden="true"
                            >
                                <title>Upload</title>
                                <path d="M7 18a4 4 0 01-.5-7.97A6 6 0 0118 9a4 4 0 011 7.9M12 12v8m0-8l-3 3m3-3l3 3" />
                            </svg>
                            Image upload for 3D scan
                        </Link>
                        <Link
                            href="/help/3d-scan"
                            className="btn btn-ghost-outline"
                        >
                            <svg
                                className="size-5"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth={2}
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                aria-hidden="true"
                            >
                                <title>Help</title>
                                <circle cx="12" cy="12" r="9" />
                                <path d="M9.5 9.5a2.5 2.5 0 115 0c0 1.5-2.5 2-2.5 3.5M12 17h.01" />
                            </svg>
                            3D scan help
                        </Link>
                    </div>
                </div>
            </section>

            <section className="py-12">
                <div className="mx-auto max-w-6xl px-6">
                    <StoreBrowser />
                </div>
            </section>
        </main>
    );
}
