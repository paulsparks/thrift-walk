import {
    IconCamera,
    IconCube,
    IconPlus,
    IconUserFilled,
} from "@tabler/icons-react";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Fragment, type ReactNode } from "react";

import { ItemPrice } from "@/components/item-price";
import { ShareButton } from "@/components/share-button";
import { WishlistRemoveButton } from "@/components/wishlist-remove-button";
import { getProfileData, type ProfileData } from "@/lib/profile";
import { getSessionDb } from "@/lib/session-db";

export const metadata = {
    title: "Profile | ThriftWalk",
    description: "Your inventory, wishlist, scans, and stores on ThriftWalk.",
};

// These features do not have data-model fields yet.
const profilePlaceholders = {
    level: "Level 24 Explorer",
    title: "Collector",
};

function ItemPhoto({
    name,
    imageAssetId,
}: {
    name: string;
    imageAssetId: string | null;
}) {
    return imageAssetId ? (
        <Image
            unoptimized
            src={`/api/media/${encodeURIComponent(imageAssetId)}?thumb=1`}
            alt={name}
            fill
            sizes="(max-width: 639px) 100vw, (max-width: 1023px) 50vw, 25vw"
            className="object-contain p-4"
        />
    ) : (
        <IconCube size={96} aria-label="No item photo" role="img" />
    );
}

const emptyState = (text: string) => (
    <p className="rounded-box border-2 border-dashed border-base-content/40 p-12 text-center opacity-70">
        {text}
    </p>
);

type WishlistEntry = ProfileData["wishlist"][number];

const wishlistTiles = [
    "bg-secondary text-secondary-content",
    "bg-accent text-accent-content",
    "bg-info text-info-content",
];

function WishlistPanel({ entries }: { entries: WishlistEntry[] }) {
    if (entries.length === 0) {
        return (
            <div className="rounded-box border-2 border-dashed border-base-content/40 p-12 text-center">
                <p className="opacity-70">
                    Items you save from the store will show up here.
                </p>
                <Link href="/play" className="btn btn-primary mt-6">
                    Explore the market
                </Link>
            </div>
        );
    }

    return (
        <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {entries.map(({ itemId, item }, index) => (
                <li
                    key={itemId}
                    className="card card-border border-base-content bg-base-100"
                >
                    <div
                        className={`relative flex aspect-square items-center justify-center rounded-t-[calc(var(--radius-box)-2px)] border-b-2 border-base-content ${wishlistTiles[index % wishlistTiles.length]}`}
                    >
                        <ItemPhoto
                            name={item.name}
                            imageAssetId={item.imageAssetId}
                        />
                    </div>
                    <div className="card-body gap-1 p-4">
                        <div className="flex items-start justify-between gap-2">
                            <h3 className="font-display font-extrabold leading-tight">
                                {item.name}
                            </h3>
                            <span className="font-display font-extrabold">
                                <ItemPrice
                                    priceCents={item.priceCents}
                                    externalUrl={item.externalUrl}
                                />
                            </span>
                        </div>
                        <p className="text-sm opacity-70">{item.details}</p>
                        <WishlistRemoveButton
                            itemId={itemId}
                            name={item.name}
                        />
                    </div>
                </li>
            ))}
        </ul>
    );
}

type Tab = { id: string; label: string; panel: ReactNode };

function buildTabs({ wishlist, inventory, stores }: ProfileData): Tab[] {
    return [
        {
            id: "inventory",
            label: `Inventory (${inventory.length})`,
            panel: (
                <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                    {inventory.map((item) => (
                        <li
                            key={item.id}
                            className="card card-border border-base-content bg-base-100"
                        >
                            <div
                                className={`relative flex aspect-square flex-col items-center justify-center gap-2 rounded-t-[calc(var(--radius-box)-2px)] border-b-2 border-base-content ${wishlistTiles[0]}`}
                            >
                                <ItemPhoto
                                    name={item.name}
                                    imageAssetId={item.imageAssetId}
                                />
                            </div>
                            <div className="card-body gap-1 p-4">
                                <span className="badge badge-outline badge-sm mb-2">
                                    {item.placement
                                        ? "On display"
                                        : "Available"}
                                </span>
                                <h3 className="font-display font-extrabold">
                                    {item.name}
                                </h3>
                                <p className="text-xs tracking-wide uppercase opacity-60">
                                    {item.storeName}
                                </p>
                                <p className="text-sm opacity-70">
                                    {item.details}
                                </p>
                                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                                    <p className="text-sm font-semibold">
                                        <ItemPrice
                                            priceCents={item.priceCents}
                                            externalUrl={item.externalUrl}
                                        />
                                    </p>
                                    <Link
                                        href={`/my-store?store=${encodeURIComponent(item.storeId)}`}
                                        className="btn btn-ghost-outline btn-sm"
                                    >
                                        Manage item
                                    </Link>
                                </div>
                            </div>
                        </li>
                    ))}
                    <li className="self-start">
                        <Link
                            href="/my-store"
                            className="card aspect-square items-center justify-center border-2 border-dashed border-base-content/40 text-base-content/60 transition-colors hover:border-base-content hover:bg-base-200 hover:text-base-content"
                        >
                            <IconPlus size={40} aria-hidden="true" />
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
            label: `Wishlist (${wishlist.length})`,
            panel: <WishlistPanel entries={wishlist} />,
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
            label: `My Stores (${stores.length})`,
            panel: stores.length ? (
                <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    {stores.map((store) => (
                        <li
                            key={store.id}
                            className="card card-border border-base-content bg-base-100"
                        >
                            <div className="card-body">
                                <h3 className="font-display text-xl font-extrabold break-words">
                                    {store.name}
                                </h3>
                                <p>
                                    {store.items.length}{" "}
                                    {store.items.length === 1
                                        ? "item"
                                        : "items"}
                                </p>
                                <Link
                                    href={`/my-store?store=${encodeURIComponent(store.id)}`}
                                    className="btn btn-ghost-outline mt-3"
                                >
                                    Manage store
                                </Link>
                            </div>
                        </li>
                    ))}
                </ul>
            ) : (
                <div className="rounded-box border-2 border-dashed border-base-content/40 p-12 text-center">
                    <p className="opacity-70">
                        You haven’t created a store yet.
                    </p>
                    <Link href="/my-store" className="btn btn-primary mt-6">
                        Create a store
                    </Link>
                </div>
            ),
        },
    ];
}

export default async function Profile({
    searchParams,
}: {
    searchParams: Promise<{ tab?: string }>;
}) {
    const session = await getSessionDb();
    if (!session) redirect("/sign-in?redirect=/profile");

    const data = await getProfileData(session.db, session.user.id);
    const stats = [
        { value: data.inventory.length, label: "Items" },
        { value: "42", label: "3D scans" },
        { value: "12k", label: "Credits" },
    ];
    const tabs = buildTabs(data);
    const { tab } = await searchParams;
    const activeTab = tabs.some((t) => t.id === tab) ? tab : "inventory";

    return (
        <main className="py-12 lg:py-16">
            <div className="mx-auto max-w-6xl px-6">
                <section className="flex flex-wrap items-start gap-8 lg:flex-nowrap">
                    <div className="relative shrink-0">
                        <div className="grid size-40 place-items-center overflow-hidden rounded-3xl border-2 border-base-content bg-base-200 shadow-[6px_6px_0_var(--color-base-content)]">
                            {data.user.image ? (
                                <Image
                                    unoptimized
                                    src={data.user.image}
                                    alt={`${data.user.name}’s profile photo`}
                                    width={160}
                                    height={160}
                                    className="size-full object-cover"
                                />
                            ) : (
                                <IconUserFilled
                                    size={112}
                                    className="opacity-40"
                                    role="img"
                                    aria-label="Default profile picture"
                                />
                            )}
                        </div>
                        <Link
                            href="/profile/edit"
                            className="btn btn-primary btn-circle btn-sm absolute -right-2 -bottom-2"
                            aria-label="Change profile photo"
                        >
                            <IconCamera size={16} aria-hidden="true" />
                        </Link>
                    </div>

                    <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-3">
                            <h1 className="font-display text-4xl font-extrabold tracking-tight sm:text-5xl">
                                {data.user.name}
                            </h1>
                            <span className="badge badge-soft badge-lg font-semibold tracking-wide uppercase">
                                {profilePlaceholders.level}
                            </span>
                            <span className="badge badge-primary badge-lg font-semibold tracking-wide uppercase">
                                {profilePlaceholders.title}
                            </span>
                        </div>
                        {data.user.bio && (
                            <p className="mt-4 max-w-xl whitespace-pre-wrap break-words opacity-80">
                                {data.user.bio}
                            </p>
                        )}
                        <dl className="mt-6 flex flex-wrap gap-10">
                            {stats.map((s) => (
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
                        {tabs.map((t) => (
                            <Fragment key={t.id}>
                                <input
                                    type="radio"
                                    name="profile_tabs"
                                    className="tab"
                                    aria-label={t.label}
                                    defaultChecked={t.id === activeTab}
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
