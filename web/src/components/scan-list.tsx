"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Image from "next/image";

import {
    isScanActive,
    SCANS_QUERY_KEY,
    type ScanStatus,
    type ScanSummary,
} from "@/lib/scan-config";

async function fetchScans(): Promise<ScanSummary[]> {
    const res = await fetch("/api/scan");
    if (!res.ok) throw new Error("Could not load your scans.");
    const data = (await res.json()) as { scans: ScanSummary[] };
    return data.scans;
}

async function deleteScan(id: string): Promise<void> {
    const res = await fetch(`/api/scan/${id}`, { method: "DELETE" });
    // 404 means it is already gone, which is what the user wanted.
    if (!res.ok && res.status !== 404) {
        const data = (await res.json().catch(() => null)) as {
            error?: string;
        } | null;
        throw new Error(data?.error ?? "Could not delete that scan.");
    }
}

const STATUS_DISPLAY: Record<ScanStatus, { label: string; bar: string }> = {
    Pending: { label: "Waiting in queue", bar: "progress-info" },
    Processing: { label: "Building 3D model", bar: "progress-secondary" },
    Completed: { label: "Ready", bar: "progress-success" },
    Failed: { label: "Scan failed", bar: "progress-error" },
};

export function ScanList() {
    const queryClient = useQueryClient();
    const {
        data: scans,
        error,
        isPending,
    } = useQuery({
        queryKey: SCANS_QUERY_KEY,
        queryFn: fetchScans,
        // Poll only while something is still waiting or being processed.
        refetchInterval: (query) =>
            query.state.data?.some((scan) => isScanActive(scan.status))
                ? 3000
                : false,
    });

    const remove = useMutation({
        mutationFn: deleteScan,
        onSuccess: () =>
            queryClient.invalidateQueries({ queryKey: SCANS_QUERY_KEY }),
    });

    function confirmDelete(scan: ScanSummary) {
        if (window.confirm(`Permanently delete "${scan.name}"?`)) {
            remove.mutate(scan.id);
        }
    }

    const activeCount =
        scans?.filter((scan) => isScanActive(scan.status)).length ?? 0;

    return (
        <section className="mt-12">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="font-display text-3xl font-extrabold tracking-tight">
                    Recent processing
                </h2>
                <span className="badge badge-accent badge-lg font-semibold">
                    {activeCount} active {activeCount === 1 ? "scan" : "scans"}
                </span>
            </div>

            {isPending && <span className="loading loading-spinner mt-6" />}

            {error && (
                <div role="alert" className="alert alert-error mt-6">
                    <span>{error.message}</span>
                </div>
            )}

            {remove.error && (
                <div role="alert" className="alert alert-error mt-6">
                    <span>{remove.error.message}</span>
                </div>
            )}

            {scans && scans.length === 0 && (
                <p className="mt-6 opacity-80">
                    No scans yet. Upload some photos above to create your first
                    3D model.
                </p>
            )}

            {scans && scans.length > 0 && (
                <ul className="mt-6 grid gap-4">
                    {scans.map((scan) => {
                        const display = STATUS_DISPLAY[scan.status];

                        return (
                            <li
                                key={scan.id}
                                className="card card-border flex-row items-center gap-5 border-base-content bg-base-100 p-5"
                            >
                                <div className="grid size-16 shrink-0 place-items-center rounded-lg border-2 border-base-content bg-base-200">
                                    {scan.status === "Completed" ? (
                                        <Image
                                            unoptimized
                                            src={`/api/scan/${scan.id}/model?preview=1`}
                                            alt={scan.name}
                                            width={64}
                                            height={64}
                                            className="object-contain"
                                        />
                                    ) : (
                                        <svg
                                            className="size-8"
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth={2}
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            aria-hidden="true"
                                        >
                                            <title>3D model</title>
                                            <path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3zM12 12l8-4.5M12 12v9M12 12L4 7.5" />
                                        </svg>
                                    )}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <h3 className="truncate font-display text-lg font-extrabold">
                                        {scan.name}
                                    </h3>
                                    <progress
                                        className={`progress ${display.bar} mt-2 w-full`}
                                        value={scan.progress}
                                        max={100}
                                        aria-label={`${scan.name} scan progress`}
                                    />
                                    <div className="mt-1 flex justify-between text-xs font-semibold tracking-wide uppercase opacity-70">
                                        <span>{display.label}</span>
                                        <span>{scan.progress}%</span>
                                    </div>
                                    {scan.status === "Failed" && scan.error && (
                                        <p className="mt-2 text-sm font-semibold">
                                            {scan.error}
                                        </p>
                                    )}
                                </div>
                                {scan.status === "Completed" && (
                                    <a
                                        href={`/api/scan/${scan.id}/model`}
                                        download
                                        className="btn btn-ghost-outline btn-sm"
                                    >
                                        Download .glb
                                    </a>
                                )}
                                {!isScanActive(scan.status) && (
                                    <button
                                        type="button"
                                        className="btn btn-ghost btn-square btn-sm"
                                        aria-label={`Delete ${scan.name}`}
                                        disabled={remove.isPending}
                                        onClick={() => confirmDelete(scan)}
                                    >
                                        ✕
                                    </button>
                                )}
                            </li>
                        );
                    })}
                </ul>
            )}
        </section>
    );
}
