import { createHmac, timingSafeEqual } from "node:crypto";

export function validTransferToken(
    method: string,
    id: string,
    file: string,
    expires: string,
    token: string,
): boolean {
    const secret = process.env.SCAN_TRANSFER_SECRET;
    if (
        !secret ||
        secret.length < 32 ||
        !/^[A-Za-z0-9_-]+$/.test(id) ||
        !/^[a-zA-Z0-9.-]+$/.test(file)
    )
        return false;
    if (!/^\d+$/.test(expires) || !/^[a-f0-9]{64}$/.test(token)) return false;
    const remaining = Number(expires) - Math.floor(Date.now() / 1000);
    if (remaining <= 0 || remaining > 7200) return false;
    const expected = createHmac("sha256", secret)
        .update(`${method}\n${id}\n${file}\n${expires}`)
        .digest();
    return timingSafeEqual(expected, Buffer.from(token, "hex"));
}
