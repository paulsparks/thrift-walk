"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { updateUser } from "@/lib/auth-client";
import { BIO_MAX_LENGTH, bioSchema } from "@/lib/profile-bio";

export function ProfileEditor({
    user,
}: {
    user: { name: string; image: string | null; bio: string };
}) {
    const router = useRouter();
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    async function submit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (busy) return;
        const data = new FormData(event.currentTarget);
        const name = String(data.get("name") || "").trim();
        const image = String(data.get("image") || "").trim();
        const bio = bioSchema["~standard"].validate(data.get("bio"));
        setError("");
        if (bio.issues) {
            setError(bio.issues[0].message);
            return;
        }
        if (!name || name.length > 120) {
            setError("Enter a name between 1 and 120 characters.");
            return;
        }
        if (image) {
            try {
                const url = new URL(image);
                if (url.protocol !== "https:" || url.username || url.password)
                    throw new Error();
            } catch {
                setError(
                    "Enter an HTTPS photo URL without embedded credentials.",
                );
                return;
            }
        }
        setBusy(true);
        try {
            const result = await updateUser({
                name,
                image: image || null,
                bio: bio.value,
            });
            if (result.error)
                throw new Error(
                    result.error.message ||
                        "Couldn’t save your profile. Please try again.",
                );
            router.replace("/profile");
            router.refresh();
        } catch (cause) {
            setError(
                cause instanceof Error
                    ? cause.message
                    : "Couldn’t save your profile. Please try again.",
            );
            setBusy(false);
        }
    }
    return (
        <main className="mx-auto max-w-2xl px-6 py-12 lg:py-16">
            <Link href="/profile" className="link">
                ← Back to profile
            </Link>
            <h1 className="mt-6 font-display text-4xl font-extrabold">
                Edit profile
            </h1>
            <form
                onSubmit={submit}
                className="mt-8 rounded-box border-2 border-base-content bg-base-100 p-6 sm:p-8"
            >
                <fieldset disabled={busy} className="space-y-6">
                    <label className="block font-semibold">
                        Display name
                        <input
                            name="name"
                            autoComplete="name"
                            defaultValue={user.name}
                            required
                            maxLength={120}
                            className="input mt-2 w-full"
                        />
                    </label>
                    <label className="block font-semibold">
                        Profile photo URL
                        <input
                            name="image"
                            type="url"
                            defaultValue={user.image || ""}
                            maxLength={2048}
                            placeholder="https://example.com/photo.jpg"
                            aria-describedby="photo-help"
                            className="input mt-2 w-full"
                        />
                        <span
                            id="photo-help"
                            className="mt-2 block text-sm font-normal opacity-70"
                        >
                            Use an HTTPS image link, or leave blank to use the
                            default avatar.
                        </span>
                    </label>
                    <label className="block font-semibold">
                        Bio
                        <textarea
                            name="bio"
                            defaultValue={user.bio}
                            maxLength={BIO_MAX_LENGTH}
                            rows={4}
                            aria-describedby="bio-help"
                            className="textarea mt-2 w-full"
                            placeholder="Tell people a little about yourself."
                        />
                        <span
                            id="bio-help"
                            className="mt-2 block text-sm font-normal opacity-70"
                        >
                            Up to {BIO_MAX_LENGTH} characters.
                        </span>
                    </label>
                    <p role="alert" className="min-h-6 text-sm text-error">
                        {error}
                    </p>
                    <div className="flex flex-wrap gap-3">
                        <button type="submit" className="btn btn-primary">
                            {busy ? "Saving…" : "Save changes"}
                        </button>
                        <Link href="/profile" className="btn btn-ghost-outline">
                            Cancel
                        </Link>
                    </div>
                </fieldset>
            </form>
        </main>
    );
}
