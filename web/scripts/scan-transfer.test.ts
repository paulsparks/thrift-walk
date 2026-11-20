import { validTransferToken } from "../src/lib/scan-transfer";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { test } from "node:test";

process.env.SCAN_TRANSFER_SECRET = "s".repeat(32);
function sign(method: string, id: string, file: string, expires: string) {
    return createHmac("sha256", "s".repeat(32))
        .update(`${method}\n${id}\n${file}\n${expires}`)
        .digest("hex");
}
test("transfer token binds method, job, filename and expiration", () => {
    const expires = String(Math.floor(Date.now() / 1000) + 3600);
    const token = sign("GET", "scan-1", "01.jpg", expires);
    assert.equal(
        validTransferToken("GET", "scan-1", "01.jpg", expires, token),
        true,
    );
    for (const [method, id, file] of [
        ["PUT", "scan-1", "01.jpg"],
        ["GET", "scan-2", "01.jpg"],
        ["GET", "scan-1", "model.glb"],
        ["GET", "../scan-1", "01.jpg"],
    ]) {
        assert.equal(
            validTransferToken(method, id, file, expires, token),
            false,
        );
    }
    assert.equal(
        validTransferToken("GET", "scan-1", "01.jpg", expires, "bad"),
        false,
    );
});
test("expired and excessively long-lived signatures fail", () => {
    for (const delta of [-1, 7201]) {
        const expires = String(Math.floor(Date.now() / 1000) + delta);
        assert.equal(
            validTransferToken(
                "GET",
                "scan-1",
                "01.jpg",
                expires,
                sign("GET", "scan-1", "01.jpg", expires),
            ),
            false,
        );
    }
});
