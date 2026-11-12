"use client";

// SAVE AS: web/src/components/store-browser.tsx  (STORE ITEM GRID)

import { useMemo, useState } from "react";

type Item = {
    id: number;
    name: string;
    price: number;
    details: string;
};

// Placeholder listings (first four come from the wireframe). Newest first.
// Replace with data from your database.
const items: Item[] = [
    {
        id: 1,
        name: "Vintage Bomber Jacket",
        price: 85,
        details: "Gently Used • XL",
    },
    {
        id: 2,
        name: "Retro Cassette Player",
        price: 45,
        details: "Vintage • Working",
    },
    {
        id: 3,
        name: "Industrial Coffee Table",
        price: 120,
        details: "Custom • Heavy",
    },
    {
        id: 4,
        name: "Classic Leather Boots",
        price: 95,
        details: "New with Tags • 10",
    },
    { id: 5, name: "Denim Trucker Jacket", price: 60, details: "Used • M" },
    {
        id: 6,
        name: "Mid-Century Table Lamp",
        price: 38,
        details: "Vintage • Working",
    },
    {
        id: 7,
        name: "Polaroid Land Camera",
        price: 72,
        details: "Vintage • Tested",
    },
    { id: 8, name: "Wool Peacoat", price: 110, details: "Gently Used • L" },
    { id: 9, name: "Vinyl Record Crate", price: 30, details: "Rustic • Wood" },
    {
        id: 10,
        name: "Silk Scarf Set",
        price: 22,
        details: "New with Tags • One size",
    },
    { id: 11, name: "Brass Desk Fan", price: 55, details: "Vintage • Working" },
    {
        id: 12,
        name: "Corduroy Tote Bag",
        price: 18,
        details: "Gently Used • Canvas",
    },
];

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

function toggle(set: Set<number>, id: number) {
    const next = new Set(set);
    if (next.has(id)) {
        next.delete(id);
    } else {
        next.add(id);
    }
    return next;
}

export function StoreBrowser() {
    const [query, setQuery] = useState("");
    const [sort, setSort] = useState<SortKey>("latest");
    const [favorites, setFavorites] = useState<Set<number>>(new Set());
    const [inCart, setInCart] = useState<Set<number>>(new Set());

    const visible = useMemo(() => {
        const q = query.trim().toLowerCase();
        const list = items.filter(
            (i) =>
                i.name.toLowerCase().includes(q) ||
                i.details.toLowerCase().includes(q),
        );
        if (sort === "price-asc")
            return [...list].sort((a, b) => a.price - b.price);
        if (sort === "price-desc")
            return [...list].sort((a, b) => b.price - a.price);
        return list;
    }, [query, sort]);

    return (
        <div className="overflow-hidden rounded-box border-2 border-base-content bg-base-200">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b-2 border-base-content p-4 sm:p-5">
                <div className="flex items-center gap-3">
                    <h2 className="font-display text-xl font-extrabold">
                        Items for sale
                    </h2>
                    <output className="badge badge-accent font-semibold">
                        {visible.length}{" "}
                        {visible.length === 1 ? "item" : "items"}
                    </output>
                </div>
                <div className="flex w-full flex-wrap gap-3 sm:w-auto">
                    <label className="input w-full sm:w-64">
                        <svg
                            className="size-5 opacity-60"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth={2}
                            strokeLinecap="round"
                            aria-hidden="true"
                        >
                            <title>Search</title>
                            <circle cx="11" cy="11" r="7" />
                            <path d="M20 20l-4-4" />
                        </svg>
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

            {visible.length === 0 ? (
                <p className="p-12 text-center opacity-70">
                    No items match “{query}”. Try a different search.
                </p>
            ) : (
                <ul className="grid max-h-[40rem] gap-5 overflow-y-auto p-4 sm:grid-cols-2 sm:p-5 lg:grid-cols-4">
                    {visible.map((item) => {
                        const faved = favorites.has(item.id);
                        const carted = inCart.has(item.id);
                        return (
                            <li
                                key={item.id}
                                className="card card-border overflow-hidden border-base-content bg-base-100"
                            >
                                <div
                                    className={`relative flex aspect-square flex-col items-center justify-center gap-2 border-b-2 border-base-content ${tiles[item.id % tiles.length]}`}
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
                                        <title>3D model placeholder</title>
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
                                        aria-label={`Save ${item.name}`}
                                        onClick={() =>
                                            setFavorites((f) =>
                                                toggle(f, item.id),
                                            )
                                        }
                                    >
                                        <svg
                                            className="size-4"
                                            viewBox="0 0 24 24"
                                            fill={
                                                faved ? "currentColor" : "none"
                                            }
                                            stroke="currentColor"
                                            strokeWidth={2}
                                            strokeLinejoin="round"
                                            aria-hidden="true"
                                        >
                                            <title>Favorite</title>
                                            <path d="M12 21s-8-5.2-8-11a4.5 4.5 0 018-2.8A4.5 4.5 0 0120 10c0 5.8-8 11-8 11z" />
                                        </svg>
                                    </button>
                                </div>
                                <div className="card-body gap-1 p-4">
                                    <div className="flex items-start justify-between gap-2">
                                        <h3 className="font-display font-extrabold leading-tight">
                                            {item.name}
                                        </h3>
                                        <span className="font-display font-extrabold">
                                            ${item.price}
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
