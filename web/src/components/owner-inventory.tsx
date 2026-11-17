"use client";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";

type Store = { id: string; name: string };
type Item = {
    id: string;
    name: string;
    details: string;
    externalUrl: string | null;
    imageAssetId: string | null;
    placementId: string | null;
};
async function api(path: string, method = "GET", body?: unknown) {
    const r = await fetch(`/api/market/${path}`, {
        method,
        credentials: "same-origin",
        cache: "no-store",
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.message || "Request failed. Retry.");
    return data;
}
export function OwnerInventory({ name }: { name: string }) {
    const [stores, setStores] = useState<Store[]>([]),
        [selected, setSelected] = useState("");
    const [items, setItems] = useState<Item[]>([]),
        [error, setError] = useState(""),
        [busy, setBusy] = useState(false),
        [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState<Partial<Item> | null>(null);
    const [storeName, setStoreName] = useState(`${name}’s Store`);
    const [creating, setCreating] = useState(false);
    const [deleting, setDeleting] = useState<Store | null>(null);
    const deleteRequest = useRef({ storeId: "", id: "" });
    const generation = useRef(0),
        selectedRef = useRef(""),
        createRequest = useRef({ name: "", id: "" });
    const refresh = useCallback(async () => {
        const version = ++generation.current;
        setLoading(true);
        try {
            const data = await api("stores");
            if (version !== generation.current) return;
            setStores(data.stores);
            const context =
                selectedRef.current ||
                new URLSearchParams(window.location.search).get("store") ||
                "";
            const id =
                data.stores.find((s: Store) => s.id === context)?.id ||
                data.stores[0]?.id ||
                "";
            selectedRef.current = id;
            setSelected(id);
            if (id) {
                const inv = await api(
                    `inventory?storeId=${encodeURIComponent(id)}`,
                );
                if (version !== generation.current) return;
                setItems(inv.items);
            } else setItems([]);
        } catch (e) {
            if (version === generation.current) setError((e as Error).message);
        } finally {
            if (version === generation.current) setLoading(false);
        }
    }, []);
    useEffect(() => {
        void refresh();
        const focus = () => {
            void refresh();
        };
        window.addEventListener("focus", focus);
        return () => {
            generation.current++;
            window.removeEventListener("focus", focus);
        };
    }, [refresh]);
    async function createStore(e: React.FormEvent) {
        e.preventDefault();
        if (busy) return;
        setBusy(true);
        setError("");
        if (createRequest.current.name !== storeName)
            createRequest.current = {
                name: storeName,
                id: crypto.randomUUID(),
            };
        try {
            const s = await api("stores", "POST", {
                name: storeName,
                requestId: createRequest.current.id,
            });
            selectedRef.current = s.id;
            await refresh();
            createRequest.current = { name: "", id: "" };
            setCreating(false);
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setBusy(false);
        }
    }
    async function remove(item: Item) {
        if (
            busy ||
            !window.confirm(
                `Delete “${item.name}”? Its world frame will also disappear.`,
            )
        )
            return;
        setBusy(true);
        setError("");
        try {
            await api("item", "DELETE", {
                id: item.id,
                storeId: selected,
                requestId: crypto.randomUUID(),
            });
            await refresh();
        } catch (e) {
            setError((e as Error).message);
            await refresh();
        } finally {
            setBusy(false);
        }
    }
    async function deleteStore() {
        if (!deleting || busy) return;
        setBusy(true);
        setError("");
        if (deleteRequest.current.storeId !== deleting.id)
            deleteRequest.current = {
                storeId: deleting.id,
                id: crypto.randomUUID(),
            };
        try {
            await api("stores", "DELETE", {
                id: deleting.id,
                requestId: deleteRequest.current.id,
            });
            setDeleting(null);
            setEditing(null);
            selectedRef.current = "";
            setSelected("");
            setItems([]);
            await refresh();
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setBusy(false);
        }
    }
    return (
        <main className="mx-auto w-full max-w-6xl space-y-8 px-4 py-10 sm:px-6 sm:py-14">
            <header className="flex flex-wrap items-end justify-between gap-5 border-b-2 border-base-content pb-8">
                <div className="space-y-2">
                    <h1 className="font-display text-4xl font-extrabold sm:text-5xl">
                        My Stores
                    </h1>
                    <p className="text-base-content/70">
                        Your finds, ready for their next home.
                    </p>
                </div>
                <button
                    type="button"
                    className="btn btn-primary"
                    disabled={busy || loading || stores.length >= 3}
                    onClick={() => setCreating(!creating)}
                >
                    {creating ? "Cancel" : "New store"}
                </button>
            </header>
            {error && (
                <div role="alert" className="alert alert-error flex flex-wrap">
                    <span className="flex-1">{error}</span>
                    <button
                        type="button"
                        className="btn btn-sm"
                        onClick={() => {
                            setError("");
                            void refresh();
                        }}
                    >
                        Retry
                    </button>
                    <button
                        type="button"
                        className="btn btn-sm"
                        onClick={() => setError("")}
                    >
                        Dismiss
                    </button>
                </div>
            )}
            {(creating || (!stores.length && !loading)) && (
                <form
                    onSubmit={createStore}
                    className="rounded-box border-2 border-base-content bg-base-200 p-5 sm:p-6"
                >
                    <h2 className="mb-4 font-display text-xl font-bold">
                        Make a corner of the market yours
                    </h2>
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
                        <label className="grid flex-1 gap-2 text-sm font-semibold">
                            Store name
                            <input
                                className="input w-full"
                                value={storeName}
                                maxLength={120}
                                required
                                onChange={(e) => setStoreName(e.target.value)}
                                disabled={busy || loading || stores.length >= 3}
                            />
                        </label>
                        <button
                            type="submit"
                            className="btn btn-primary"
                            disabled={busy || loading || stores.length >= 3}
                        >
                            Create store
                        </button>
                    </div>
                </form>
            )}
            {!!stores.length && (
                <section className="space-y-6" aria-label="Store inventory">
                    <fieldset
                        className="flex flex-wrap gap-2"
                        aria-label="Your stores"
                    >
                        {stores.map((store) => (
                            <button
                                key={store.id}
                                type="button"
                                aria-pressed={selected === store.id}
                                className={`btn max-w-full ${selected === store.id ? "btn-primary" : "btn-ghost-outline"}`}
                                disabled={busy}
                                onClick={() => {
                                    selectedRef.current = store.id;
                                    setSelected(store.id);
                                    setItems([]);
                                    setEditing(null);
                                    setDeleting(null);
                                    void refresh();
                                }}
                            >
                                <span className="truncate">{store.name}</span>
                            </button>
                        ))}
                    </fieldset>
                    <div className="flex flex-wrap items-center justify-between gap-4">
                        <div>
                            <h2 className="break-words font-display text-2xl font-bold">
                                {
                                    stores.find(
                                        (store) => store.id === selected,
                                    )?.name
                                }
                            </h2>
                            <p className="mt-1 text-sm text-base-content/70">
                                {items.length}{" "}
                                {items.length === 1 ? "item" : "items"} ·{" "}
                                {
                                    items.filter((item) => item.placementId)
                                        .length
                                }{" "}
                                on display
                            </p>
                        </div>
                        <div className="flex flex-wrap gap-3">
                            <button
                                type="button"
                                className="btn btn-ghost-outline"
                                disabled={busy || loading}
                                onClick={() => void refresh()}
                            >
                                Refresh
                            </button>
                            <button
                                type="button"
                                className="btn btn-primary"
                                disabled={busy || loading}
                                onClick={() => setEditing({})}
                            >
                                Add item
                            </button>
                        </div>
                    </div>
                </section>
            )}
            {loading && <p role="status">Loading inventory…</p>}
            {editing && (
                <ItemForm
                    key={`${selected}:${editing.id || "new"}`}
                    item={editing}
                    storeId={selected}
                    onCancel={() => setEditing(null)}
                    onSaved={() => {
                        setEditing(null);
                        void refresh();
                    }}
                />
            )}
            {!loading && selected && !items.length && (
                <div className="rounded-box border-2 border-dashed border-base-content/30 px-6 py-16 text-center">
                    <h2 className="font-display text-2xl font-bold">
                        Room for your first find
                    </h2>
                    <p className="mt-2 text-base-content/70">
                        Add an item to start filling your store.
                    </p>
                </div>
            )}
            <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((item) => (
                    <li
                        key={item.id}
                        className="flex min-w-0 flex-col overflow-hidden rounded-box border-2 border-base-content bg-base-100"
                    >
                        <div className="relative flex aspect-[4/3] shrink-0 items-center justify-center border-b-2 border-base-content bg-base-200">
                            {item.imageAssetId ? (
                                <Image
                                    unoptimized
                                    src={`/api/media/${item.imageAssetId}?thumb=1`}
                                    alt={item.name}
                                    fill
                                    sizes="(max-width: 639px) 100vw, (max-width: 1023px) 50vw, 33vw"
                                    className="object-contain p-6"
                                />
                            ) : (
                                <span className="text-base-content/60">
                                    No image
                                </span>
                            )}
                        </div>
                        <div className="flex flex-1 flex-col gap-3 p-5">
                            <span
                                className={`badge badge-sm ${item.placementId ? "badge-secondary" : "badge-outline"}`}
                            >
                                {item.placementId ? "On display" : "Available"}
                            </span>
                            <h3 className="break-words font-display text-xl font-bold">
                                {item.name}
                            </h3>
                            <p className="line-clamp-3 whitespace-pre-wrap break-words text-sm text-base-content/70">
                                {item.details}
                            </p>
                            {item.externalUrl && (
                                <a
                                    className="link break-all text-sm"
                                    href={item.externalUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    View listing ↗
                                </a>
                            )}
                            <div className="mt-auto flex gap-3 pt-4">
                                <button
                                    type="button"
                                    className="btn btn-ghost-outline flex-1"
                                    disabled={busy || loading}
                                    onClick={() => setEditing(item)}
                                >
                                    Edit
                                </button>
                                <button
                                    type="button"
                                    className="btn btn-ghost"
                                    disabled={busy || loading}
                                    onClick={() => void remove(item)}
                                >
                                    Delete
                                </button>
                            </div>
                        </div>
                    </li>
                ))}
            </ul>
            {!!selected && !loading && (
                <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-base-content/20 pt-6">
                    <p className="text-sm text-base-content/60">
                        {stores.length} of 3 stores
                    </p>
                    <button
                        type="button"
                        className="btn btn-accent"
                        disabled={busy}
                        onClick={() =>
                            setDeleting(
                                stores.find((store) => store.id === selected) ||
                                    null,
                            )
                        }
                    >
                        Delete store
                    </button>
                </footer>
            )}
            {deleting && (
                <section
                    className="rounded-box border-2 border-error bg-base-200 p-6"
                    aria-label="Confirm store deletion"
                >
                    <h2 className="break-words font-display text-xl font-bold">
                        Delete “{deleting.name}”?
                    </h2>
                    <p className="my-3">
                        All items in this store and their world frames will be
                        removed. This cannot be undone.
                    </p>
                    <div className="flex flex-wrap gap-3">
                        <button
                            type="button"
                            className="btn btn-error"
                            disabled={busy}
                            onClick={() => void deleteStore()}
                        >
                            {busy ? "Deleting…" : "Delete store permanently"}
                        </button>
                        <button
                            type="button"
                            className="btn"
                            disabled={busy}
                            onClick={() => setDeleting(null)}
                        >
                            Cancel
                        </button>
                    </div>
                </section>
            )}
        </main>
    );
}

function ItemForm({
    item,
    storeId,
    onCancel,
    onSaved,
}: {
    item: Partial<Item>;
    storeId: string;
    onCancel: () => void;
    onSaved: () => void;
}) {
    const [busy, setBusy] = useState(false),
        [error, setError] = useState("");
    // Retain exactly the same request after an ambiguous network failure.
    const pending = useRef<{ fingerprint: string; requestId: string } | null>(
            null,
        ),
        imageId = useRef(item.imageAssetId || "");
    const uploadedFile = useRef("");
    async function submit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        if (busy) return;
        const form = new FormData(e.currentTarget);
        setBusy(true);
        setError("");
        try {
            const image = form.get("image");
            const fileKey =
                image instanceof File
                    ? `${image.name}:${image.size}:${image.lastModified}`
                    : "";
            if (
                image instanceof File &&
                image.size &&
                uploadedFile.current !== fileKey
            ) {
                const data = new FormData();
                data.set("image", image);
                const r = await fetch("/api/market/upload", {
                    method: "POST",
                    body: data,
                });
                const uploaded = await r.json();
                if (!r.ok) throw new Error(uploaded.message);
                imageId.current = uploaded.id;
                uploadedFile.current = fileKey;
            }
            if (!imageId.current) throw new Error("Choose an image.");
            const body = {
                id: item.id,
                storeId,
                name: form.get("name"),
                details: form.get("details"),
                externalUrl: form.get("externalUrl"),
                imageAssetId: imageId.current,
            };
            const fingerprint = JSON.stringify(body);
            if (pending.current?.fingerprint !== fingerprint)
                pending.current = {
                    fingerprint,
                    requestId: crypto.randomUUID(),
                };
            await api("item", "POST", {
                ...body,
                requestId: pending.current.requestId,
            });
            onSaved();
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setBusy(false);
        }
    }
    return (
        <form
            onSubmit={submit}
            className="space-y-4 rounded-box border-2 bg-base-200 p-6"
        >
            <h2 className="text-2xl font-bold">
                {item.id ? "Edit item" : "Add item"}
            </h2>
            {error && <p role="alert">{error}</p>}
            <fieldset disabled={busy} className="grid gap-5">
                <label>
                    Title
                    <input
                        name="name"
                        className="input block w-full"
                        required
                        maxLength={120}
                        defaultValue={item.name}
                    />
                </label>
                <label>
                    Description
                    <textarea
                        name="details"
                        className="textarea block w-full"
                        required
                        maxLength={5000}
                        defaultValue={item.details}
                    />
                </label>
                <label>
                    HTTPS listing URL
                    <input
                        name="externalUrl"
                        type="url"
                        pattern="https://.*"
                        className="input block w-full"
                        required
                        maxLength={2048}
                        defaultValue={item.externalUrl || ""}
                    />
                </label>
                <label>
                    Image (JPEG, PNG, WebP · 10 MB · 4096 pixels)
                    <input
                        name="image"
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="file-input block w-full"
                    />
                </label>
                <div className="flex gap-3">
                    <button type="submit" className="btn btn-primary">
                        {busy ? "Saving…" : "Save item"}
                    </button>
                    <button type="button" className="btn" onClick={onCancel}>
                        Cancel
                    </button>
                </div>
            </fieldset>
        </form>
    );
}
