/**
 * Shared by the browser (scan-dropzone, scan-list) and the server (api/scan).
 * Keep Node-only imports out of this file.
 */

/** Hard limits enforced by POST /api/scan. */
export const SCAN_MIN_PHOTOS = 3;
export const SCAN_MAX_PHOTOS = 10;
export const SCAN_MAX_PHOTO_BYTES = 25 * 1024 * 1024;
export const SCAN_MAX_NAME_LENGTH = 80;

/** What the UI recommends for good results (not enforced). */
export const SCAN_RECOMMENDED_MIN_PHOTOS = 5;

/** Redis list the web app pushes job ids onto and the worker pops from. */
export const SCAN_QUEUE = "scan:jobs";

/** TanStack Query key for the signed-in user's scan list. */
export const SCANS_QUERY_KEY = ["scans"] as const;

export type ScanStatus = "Pending" | "Processing" | "Completed" | "Failed";

/** Shape returned by GET /api/scan (dates are ISO strings after JSON). */
export interface ScanSummary {
    id: string;
    name: string;
    status: ScanStatus;
    progress: number;
    error: string | null;
    createdAt: string;
}

export function isScanActive(status: ScanStatus) {
    return status === "Pending" || status === "Processing";
}
