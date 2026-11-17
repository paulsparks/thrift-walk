"use client";

import {
    IconCube,
    IconHeart,
    IconHeartFilled,
    IconSearch,
} from "@tabler/icons-react";
import { useClientQueries } from "@zenstackhq/tanstack-query/react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { ItemPrice } from "@/components/item-price";
import { schema } from "~/zenstack/schema";

export type StoreItem = {
    id: string;
    name: string;
    details: string;
    priceCents: number | null;
    externalUrl?: string | null;
};

const tiles = [
    "bg-secondary text-secondary-content",
    "bg-accent text-accent-content",
    "bg-info text-info-content",
    "bg-base-300 text-base-content",
];

const sorts = {
    latest: "Latest",
    "price-asc": "Price: Low to High",
    "price-desc": "Price: High to Low",
} as const;

type SortKey = keyof typeof sorts;

function toggle(set: Set<string>, id: string) {
    const next = new Set(set);
    if (next.has(id)) {
        next.delete(id);
    } else {
        next.add(id);
    }
    return next;
}

export function StoreBrowser({
    items,
    initialFavoriteIds,
}: {
    /** Newest first. */
    items: StoreItem[];
    /** IDs of the items already on the signed-in user's wishlist. */
    initialFavoriteIds: string[];
}) {
    const [query, setQuery] = useState("");
    const [sort, setSort] = useState<SortKey>("latest");
    const [favorites, setFavorites] = useState(
        () => new Set(initialFavoriteIds),
    );
    const [pending, setPending] = useState<Set<string>>(new Set());
    const [inCart, setInCart] = useState<Set<string>>(new Set());
    const [error, setError] = useState("");

    const client = useClientQueries(schema);
    const addFavorite = client.wishlistItem.useCreate();
    const removeFavorite = client.wishlistItem.useDeleteMany();

    async function toggleFavorite(id: string) {
        if (pending.has(id)) return;

        const wasFavorite = favorites.has(id);
        setError("");
        setPending((p) => new Set(p).add(id));
        // Update the heart right away, then undo it if saving fails.
        setFavorites((f) => toggle(f, id));

        try {
            if (wasFavorite) {
                await removeFavorite.mutateAsync({ where: { itemId: id } });
            } else {
                await addFavorite.mutateAsync({ data: { itemId: id } });
            }
        } catch {
            setFavorites((f) => toggle(f, id));
            setError("Couldn’t update your wishlist. Please try again.");
        } finally {
            setPending((p) => {
                const next = new Set(p);
                next.delete(id);
                return next;
            });
        }
    }

    const indexById = useMemo(
        () => new Map(items.map((item, index) => [item.id, index])),
        [items],
    );

    const visible = useMemo(() => {
        const q = query.trim().toLowerCase();
        const list = items.filter(
            (i) =>
                i.name.toLowerCase().includes(q) ||
                i.details.toLowerCase().includes(q),
        );
        if (sort === "price-asc")
            return [...list].sort(
                (a, b) =>
                    (a.priceCents ?? Infinity) - (b.priceCents ?? Infinity),
            );
        if (sort === "price-desc")
            return [...list].sort(
                (a, b) =>
                    (b.priceCents ?? -Infinity) - (a.priceCents ?? -Infinity),
            );
        return list;
    }, [items, query, sort]);

    return (
        <div className="overflow-hidden rounded-box border-2 border-base-content bg-base-200">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b-2 border-base-content p-4 sm:p-5">
                <div className="flex flex-wrap items-center gap-3">
                    <h2 className="font-display text-xl font-extrabold">
                        Items for sale
                    </h2>
                    <output className="badge badge-accent font-semibold">
                        {visible.length}{" "}
                        {visible.length === 1 ? "item" : "items"}
                    </output>
                    <Link
                        href="/profile?tab=wishlist"
                        className="btn btn-ghost-outline btn-sm"
                    >
                        <IconHeart size={16} aria-hidden="true" />
                        Wishlist ({favorites.size})
                    </Link>
                </div>
                <div className="flex w-full flex-wrap gap-3 sm:w-auto">
                    <label className="input w-full sm:w-64">
                        <IconSearch
                            size={20}
                            className="opacity-60"
                            aria-hidden="true"
                        />
                        <input
                            type="search"
                            placeholder="Search items..."
                            aria-label="Search items"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                        />
                    </label>
                    <select
                        className="select w-full sm:w-56"
                        aria-label="Sort items"
                        value={sort}
                        onChange={(e) => setSort(e.target.value as SortKey)}
                    >
                        {(Object.keys(sorts) as SortKey[]).map((key) => (
                            <option key={key} value={key}>
                                Sort: {sorts[key]}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {error && (
                <p
                    role="alert"
                    className="border-b-2 border-base-content bg-accent px-5 py-3 text-sm font-semibold text-accent-content"
                >
                    {error}
                </p>
            )}

            {visible.length === 0 ? (
                <p className="p-12 text-center opacity-70">
                    {items.length === 0
                        ? "Nothing is for sale yet. Check back soon."
                        : `No items match “${query}”. Try a different search.`}
                </p>
            ) : (
                <ul className="grid max-h-[40rem] gap-5 overflow-y-auto p-4 sm:grid-cols-2 sm:p-5 lg:grid-cols-4">
                    {visible.map((item) => {
                        const faved = favorites.has(item.id);
                        const carted = inCart.has(item.id);
                        const tile =
                            tiles[(indexById.get(item.id) ?? 0) % tiles.length];
                        return (
                            <li
                                key={item.id}
                                className="card card-border overflow-hidden border-base-content bg-base-100"
                            >
                                <div
                                    className={`relative flex aspect-square flex-col items-center justify-center gap-2 border-b-2 border-base-content ${tile}`}
                                >
                                    <IconCube size={96} />
                                    <span className="text-sm font-semibold">
                                        3D model preview
                                    </span>
                                    <span className="badge badge-primary badge-sm absolute bottom-3 left-3 font-bold">
                                        3D
                                    </span>
                                    <button
                                        type="button"
                                        className="btn btn-circle btn-sm absolute top-3 right-3 bg-base-100 text-base-content"
                                        aria-pressed={faved}
                                        aria-label={`Save ${item.name} to wishlist`}
                                        onClick={() => toggleFavorite(item.id)}
                                    >
                                        {faved ? (
                                            <IconHeartFilled
                                                size={16}
                                                aria-hidden="true"
                                            />
                                        ) : (
                                            <IconHeart
                                                size={16}
                                                aria-hidden="true"
                                            />
                                        )}
                                    </button>
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
                                    <p className="text-sm opacity-70">
                                        {item.details}
                                    </p>
                                    <button
                                        type="button"
                                        className={`btn btn-block mt-3 text-sm tracking-wide uppercase ${carted ? "btn-secondary" : "btn-primary"}`}
                                        aria-pressed={carted}
                                        onClick={() =>
                                            setInCart((c) => toggle(c, item.id))
                                        }
                                    >
                                        {carted ? "In cart" : "Add to cart"}
                                    </button>
                                </div>
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
}
