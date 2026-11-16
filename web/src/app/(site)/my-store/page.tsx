import { IconCloudUpload, IconHelpCircle } from "@tabler/icons-react";
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
                            <IconCloudUpload size={20} aria-hidden="true" />
                            Image upload for 3D scan
                        </Link>
                        <Link
                            href="/help/3d-scan"
                            className="btn btn-ghost-outline"
                        >
                            <IconHelpCircle size={20} aria-hidden="true" />
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
