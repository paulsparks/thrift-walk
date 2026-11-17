"use client";

import { IconCloudUpload } from "@tabler/icons-react";
import { useQueryClient } from "@tanstack/react-query";
import { type ChangeEvent, type SubmitEvent, useRef, useState } from "react";

import {
    SCAN_MAX_NAME_LENGTH,
    SCAN_MAX_PHOTOS,
    SCAN_MIN_PHOTOS,
    SCAN_RECOMMENDED_MIN_PHOTOS,
    SCANS_QUERY_KEY,
} from "@/lib/scan-config";

export function ScanDropzone() {
    const queryClient = useQueryClient();
    const [files, setFiles] = useState<File[]>([]);
    const [name, setName] = useState("");
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState<string>();
    const [notice, setNotice] = useState<string>();
    const inputRef = useRef<HTMLInputElement>(null);

    function onChange(e: ChangeEvent<HTMLInputElement>) {
        setFiles(Array.from(e.target.files ?? []));
        setError(undefined);
        setNotice(undefined);
    }

    function clear() {
        setFiles([]);
        setError(undefined);
        if (inputRef.current) inputRef.current.value = "";
    }

    async function onSubmit(e: SubmitEvent<HTMLFormElement>) {
        e.preventDefault();
        if (!canUpload) return;

        setUploading(true);
        setError(undefined);
        setNotice(undefined);

        const body = new FormData();
        body.set("name", name.trim());
        for (const file of files) body.append("photos", file);

        try {
            const res = await fetch("/api/scan", { method: "POST", body });
            if (!res.ok) {
                const data = (await res.json().catch(() => null)) as {
                    error?: string;
                } | null;
                setError(data?.error ?? "Upload failed. Please try again.");
                return;
            }

            clear();
            setName("");
            setNotice("Upload received. Your scan is in the queue.");
            // Show the new job in the list below right away.
            await queryClient.invalidateQueries({ queryKey: SCANS_QUERY_KEY });
        } catch {
            setError("Upload failed. Check your connection and try again.");
        } finally {
            setUploading(false);
        }
    }

    const totalMb = (
        files.reduce((sum, f) => sum + f.size, 0) /
        1024 /
        1024
    ).toFixed(1);
    const outOfRange =
        files.length > 0 &&
        (files.length < SCAN_MIN_PHOTOS || files.length > SCAN_MAX_PHOTOS);
    const belowRecommended =
        files.length >= SCAN_MIN_PHOTOS &&
        files.length < SCAN_RECOMMENDED_MIN_PHOTOS;
    const canUpload = !outOfRange && files.length > 0 && name.trim().length > 0;

    return (
        <form onSubmit={onSubmit}>
            <div className="relative flex flex-col items-center rounded-box border-2 border-dashed border-base-content/50 bg-base-200 px-6 py-14 text-center transition-colors hover:bg-base-300/50 has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-4 has-[:focus-visible]:outline-accent">
                <input
                    ref={inputRef}
                    type="file"
                    multiple
                    accept="image/jpeg,image/png,image/heic,image/heif,.heic,.heif"
                    aria-label="Select photos to upload"
                    title=""
                    className="absolute inset-0 size-full cursor-pointer opacity-0"
                    onChange={onChange}
                    disabled={uploading}
                />
                <div className="grid size-20 place-items-center rounded-full bg-base-300">
                    <IconCloudUpload size={36} aria-hidden="true" />
                </div>
                <h2 className="mt-5 font-display text-2xl font-extrabold">
                    Drag and drop images
                </h2>
                <p className="mt-2 opacity-80">
                    Upload {SCAN_RECOMMENDED_MIN_PHOTOS}-{SCAN_MAX_PHOTOS}{" "}
                    photos from different angles for best results.
                </p>
                <span className="btn btn-primary btn-lg mt-6">
                    Select files
                </span>
                <p className="mt-6 text-xs tracking-widest uppercase opacity-60">
                    Supported formats: JPG, PNG, HEIC
                </p>
            </div>

            {notice && (
                <output className="alert alert-success mt-4">{notice}</output>
            )}

            {files.length > 0 && (
                <div className="mt-4 rounded-box border-2 border-base-content bg-base-100 p-5">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                        <output className="font-display font-extrabold">
                            {files.length}{" "}
                            {files.length === 1 ? "photo" : "photos"} selected (
                            {totalMb} MB)
                        </output>
                        <button
                            type="button"
                            className="btn btn-ghost-outline btn-sm"
                            onClick={clear}
                            disabled={uploading}
                        >
                            Clear
                        </button>
                    </div>
                    {outOfRange && (
                        <p className="mt-2 text-sm font-semibold">
                            Select {SCAN_MIN_PHOTOS}-{SCAN_MAX_PHOTOS} photos to
                            start a scan.
                        </p>
                    )}
                    {belowRecommended && (
                        <p className="mt-2 text-sm opacity-80">
                            Best results come from {SCAN_RECOMMENDED_MIN_PHOTOS}
                            -{SCAN_MAX_PHOTOS} photos.
                        </p>
                    )}
                    <ul className="mt-3 flex flex-wrap gap-2 text-sm">
                        {files.slice(0, 6).map((f) => (
                            <li
                                key={`${f.name}-${f.size}-${f.lastModified}`}
                                className="badge badge-soft"
                            >
                                {f.name}
                            </li>
                        ))}
                        {files.length > 6 && (
                            <li className="opacity-70">
                                and {files.length - 6} more
                            </li>
                        )}
                    </ul>

                    <label className="fieldset mt-4">
                        <span className="fieldset-legend">Item name</span>
                        <input
                            type="text"
                            name="name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g. Vintage denim jacket"
                            maxLength={SCAN_MAX_NAME_LENGTH}
                            className="input input-neutral w-full"
                            disabled={uploading}
                            required
                        />
                    </label>

                    {error && (
                        <div role="alert" className="alert alert-error mt-4">
                            <span>{error}</span>
                        </div>
                    )}

                    <button
                        type="submit"
                        className="btn btn-primary mt-4"
                        disabled={!canUpload || uploading}
                    >
                        {uploading && (
                            <span className="loading loading-spinner" />
                        )}
                        Start 3D scan
                    </button>
                </div>
            )}
        </form>
    );
}
