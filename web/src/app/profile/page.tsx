import Link from "next/link";
import { Fragment, type ReactNode } from "react";

import { ShareButton } from "@/components/share-button";

export const metadata = {
    title: "Profile | ThriftWalk",
    description:
        "Wes Reed’s inventory, wishlist, scans, and stall on ThriftWalk.",
};

// Placeholder profile data from the wireframe. Replace with data from database.
const profile = {
    name: "Wes Reed",
    level: "Level 24 Explorer",
    title: "Collector",
    bio: "Vintage enthusiast and 3D scanning hobbyist. Looking for rare 90s streetwear and industrial home decor.",
    stats: [
        { value: "156", label: "Items found" },
        { value: "42", label: "3D scans" },
        { value: "12k", label: "Credits" },
    ],
};

const inventory = [
    {
        name: "90s Retro Walkman",
        category: "Electronics",
        rarity: "Rare",
        value: 120,
        tile: "bg-secondary text-secondary-content",
    },
    {
        name: "Oversized Flannel",
        category: "Apparel",
        rarity: "Common",
        value: 35,
        tile: "bg-accent text-accent-content",
    },
    {
        name: "Ceramic Panther",
        category: "Home Decor",
        rarity: "Epic",
        value: 210,
        tile: "bg-info text-info-content",
    },
];

const emptyState = (text: string) => (
    <p className="rounded-box border-2 border-dashed border-base-content/40 p-12 text-center opacity-70">
        {text}
    </p>
);

const tabs: { id: string; label: string; panel: ReactNode }[] = [
    {
        id: "inventory",
        label: "Inventory (156)",
        panel: (
            <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                {inventory.map((item) => (
                    <li
                        key={item.name}
                        className="card card-border border-base-content bg-base-100"
                    >
                        <div
                            className={`flex aspect-square flex-col items-center justify-center gap-2 rounded-t-[calc(var(--radius-box)-2px)] border-b-2 border-base-content ${item.tile}`}
                        >
                            <svg
                                className="size-24"
                                viewBox="0 0 120 120"
                                fill="none"
                                stroke="#1E222A"
                                strokeWidth={3}
                                strokeLinejoin="round"
                                aria-hidden="true"
                            >
                                <title>3D asset placeholder</title>
                                <path
                                    d="M60 14l42 24-42 24-42-24z"
                                    fill="#F4F1DE"
                                />
                                <path
                                    d="M18 38l42 24v44L18 82z"
                                    fill="#EAE6CC"
                                />
                                <path
                                    d="M102 38v44l-42 24V62z"
                                    fill="#D9D4B4"
                                />
                            </svg>
                            <span className="text-xs font-semibold tracking-widest uppercase">
                                3D asset
                            </span>
                        </div>
                        <div className="card-body gap-1 p-4">
                            <h3 className="font-display font-extrabold">
                                {item.name}
                            </h3>
                            <p className="text-xs tracking-wide uppercase opacity-60">
                                {item.category} • {item.rarity}
                            </p>
                            <div className="mt-3 flex items-center justify-between">
                                <p className="text-sm font-semibold">
                                    ${item.value} Est. Value
                                </p>
                                <details className="dropdown dropdown-end">
                                    <summary
                                        className="btn btn-ghost btn-square btn-xs list-none shadow-none"
                                        aria-label={`More options for ${item.name}`}
                                    >
                                        <svg
                                            className="size-4"
                                            viewBox="0 0 24 24"
                                            fill="currentColor"
                                            aria-hidden="true"
                                        >
                                            <title>More options</title>
                                            <circle cx="12" cy="5" r="2" />
                                            <circle cx="12" cy="12" r="2" />
                                            <circle cx="12" cy="19" r="2" />
                                        </svg>
                                    </summary>
                                    <ul className="menu dropdown-content z-10 w-44 rounded-box border-2 border-base-content bg-base-100 p-2">
                                        <li>
                                            <Link href="/my-store">
                                                List in store
                                            </Link>
                                        </li>
                                        <li>
                                            <Link href="/my-store/upload">
                                                Edit item
                                            </Link>
                                        </li>
                                    </ul>
                                </details>
                            </div>
                        </div>
                    </li>
                ))}
                <li className="self-start">
                    <Link
                        href="/my-store"
                        className="card aspect-square items-center justify-center border-2 border-dashed border-base-content/40 text-base-content/60 transition-colors hover:border-base-content hover:bg-base-200 hover:text-base-content"
                    >
                        <svg
                            className="size-10"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth={2}
                            strokeLinecap="round"
                            aria-hidden="true"
                        >
                            <title>Add</title>
                            <path d="M12 4v16M4 12h16" />
                        </svg>
                        <span className="mt-2 text-sm font-semibold tracking-widest uppercase">
                            Add item
                        </span>
                    </Link>
                </li>
            </ul>
        ),
    },
    {
        id: "wishlist",
        label: "Wishlist (28)",
        panel: emptyState("Items you save from the store will show up here."),
    },
    {
        id: "scans",
        label: "Scan History",
        panel: emptyState("Your 3D scans will show up here."),
    },
    {
        id: "transactions",
        label: "Transactions",
        panel: emptyState("Your purchases and sales will show up here."),
    },
    {
        id: "stall",
        label: "Stall Settings",
        panel: emptyState("Customize how your stall looks to other players."),
    },
];

export default function Profile() {
    return (
        <main className="py-12 lg:py-16">
            <div className="mx-auto max-w-6xl px-6">
                <section className="flex flex-wrap items-start gap-8 lg:flex-nowrap">
                    <div className="relative shrink-0">
                        <div className="grid size-40 place-items-center overflow-hidden rounded-3xl border-2 border-base-content bg-base-200 shadow-[6px_6px_0_var(--color-base-content)]">
                            <svg
                                className="size-28 opacity-40"
                                viewBox="0 0 24 24"
                                fill="currentColor"
                                role="img"
                            >
                                <title>Default profile picture</title>
                                <circle cx="12" cy="8" r="4.5" />
                                <path d="M3.5 22c0-4.5 3.8-7 8.5-7s8.5 2.5 8.5 7z" />
                            </svg>
                        </div>
                        <Link
                            href="/profile/edit"
                            className="btn btn-primary btn-circle btn-sm absolute -right-2 -bottom-2"
                            aria-label="Change profile photo"
                        >
                            <svg
                                className="size-4"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth={2}
                                strokeLinejoin="round"
                                aria-hidden="true"
                            >
                                <title>Camera</title>
                                <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
                                <circle cx="12" cy="13" r="3.5" />
                            </svg>
                        </Link>
                    </div>

                    <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-3">
                            <h1 className="font-display text-4xl font-extrabold tracking-tight sm:text-5xl">
                                {profile.name}
                            </h1>
                            <span className="badge badge-soft badge-lg font-semibold tracking-wide uppercase">
                                {profile.level}
                            </span>
                            <span className="badge badge-primary badge-lg font-semibold tracking-wide uppercase">
                                {profile.title}
                            </span>
                        </div>
                        <p className="mt-4 max-w-xl opacity-80">
                            {profile.bio}
                        </p>
                        <dl className="mt-6 flex flex-wrap gap-10">
                            {profile.stats.map((s) => (
                                <div
                                    key={s.label}
                                    className="flex flex-col-reverse"
                                >
                                    <dt className="text-xs font-semibold tracking-widest uppercase opacity-60">
                                        {s.label}
                                    </dt>
                                    <dd className="font-display text-3xl font-extrabold">
                                        {s.value}
                                    </dd>
                                </div>
                            ))}
                        </dl>
                    </div>

                    <div className="flex items-center gap-4 lg:self-end">
                        <Link
                            href="/profile/edit"
                            className="btn btn-primary btn-lg"
                        >
                            Edit profile
                        </Link>
                        <ShareButton />
                    </div>
                </section>

                <section className="mt-14">
                    <div role="tablist" className="tabs tabs-border tabs-lg">
                        {tabs.map((t, i) => (
                            <Fragment key={t.id}>
                                <input
                                    type="radio"
                                    name="profile_tabs"
                                    className="tab"
                                    aria-label={t.label}
                                    defaultChecked={i === 0}
                                />
                                <div className="tab-content pt-8">
                                    {t.panel}
                                </div>
                            </Fragment>
                        ))}
                    </div>
                </section>
            </div>
        </main>
    );
}
