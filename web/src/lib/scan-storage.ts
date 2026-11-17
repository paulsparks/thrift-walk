import path from "node:path";

/** Absolute root folder for scan photos and finished models. */
export function scanStorageRoot(): string {
    const dir = process.env.SCAN_STORAGE_DIR;
    if (!dir) {
        throw new Error("SCAN_STORAGE_DIR is not set");
    }
    return path.resolve(dir);
}

/**
 * Turns a path stored in the database (relative to the storage root) into an
 * absolute path, refusing anything that would escape the root.
 */
export function resolveScanPath(relativePath: string): string {
    const root = scanStorageRoot();
    const resolved = path.resolve(root, relativePath);
    if (resolved !== root && !resolved.startsWith(root + path.sep)) {
        throw new Error("Scan path escapes the storage directory");
    }
    return resolved;
}
