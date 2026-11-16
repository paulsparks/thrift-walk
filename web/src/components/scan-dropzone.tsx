"use client";

import { IconCloudUpload } from "@tabler/icons-react";
import { type ChangeEvent, useRef, useState } from "react";

const MIN_PHOTOS = 20;
const MAX_PHOTOS = 50;

export function ScanDropzone() {
    const [files, setFiles] = useState<File[]>([]);
    const inputRef = useRef<HTMLInputElement>(null);

    function onChange(e: ChangeEvent<HTMLInputElement>) {
        setFiles(Array.from(e.target.files ?? []));
    }

    function clear() {
        setFiles([]);
        if (inputRef.current) inputRef.current.value = "";
    }

    const totalMb = (
        files.reduce((sum, f) => sum + f.size, 0) /
        1024 /
        1024
    ).toFixed(1);
    const outOfRange =
        files.length > 0 &&
        (files.length < MIN_PHOTOS || files.length > MAX_PHOTOS);

    return (
        <div>
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
                />
                <div className="grid size-20 place-items-center rounded-full bg-base-300">
                    <IconCloudUpload size={36} aria-hidden="true" />
                </div>
                <h2 className="mt-5 font-display text-2xl font-extrabold">
                    Drag and drop images
                </h2>
                <p className="mt-2 opacity-80">
                    Upload {MIN_PHOTOS}-{MAX_PHOTOS} photos from different
                    angles for best results.
                </p>
                <span className="btn btn-primary btn-lg mt-6">
                    Select files
                </span>
                <p className="mt-6 text-xs tracking-widest uppercase opacity-60">
                    Supported formats: JPG, PNG, HEIC
                </p>
            </div>

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
                        >
                            Clear
                        </button>
                    </div>
                    {outOfRange && (
                        <p className="mt-2 text-sm opacity-80">
                            Best results come from {MIN_PHOTOS}-{MAX_PHOTOS}{" "}
                            photos.
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
                </div>
            )}
        </div>
    );
}
