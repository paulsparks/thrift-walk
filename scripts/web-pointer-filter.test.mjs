import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";

// Exercise the exact JavaScript embedded in the Godot autoload.
const source = readFileSync(
    new URL("../game/scripts/app/input_mode.gd", import.meta.url),
    "utf8",
);
const script = source.match(
    /const WEB_MOUSE_MOTION_FILTER := """([\s\S]*?)"""/,
)[1];

function fixture() {
    const listeners = [];
    const context = {
        document: { pointerLockElement: {} },
        window: {
            addEventListener(type, handler, capture) {
                listeners.push({ type, handler, capture });
            },
        },
    };
    runInNewContext(script, context);
    return {
        context,
        listeners,
        dispatch(type, properties) {
            let stopped = false;
            const event = {
                ...properties,
                stopImmediatePropagation() {
                    stopped = true;
                },
            };
            for (const listener of listeners) {
                if (listener.type === type) listener.handler(event);
            }
            return stopped;
        },
    };
}

test("chord press/release cannot send stale motion to cursor or camera", () => {
    const f = fixture();
    assert.equal(f.listeners[0].capture, true);
    for (const buttons of [3, 1, 2, 0]) {
        assert.equal(
            f.dispatch("pointermove", {
                pointerType: "mouse",
                button: 2,
                buttons,
                movementX: 600,
                movementY: -120,
            }),
            true,
        );
    }
    for (const type of ["mousedown", "mouseup"]) {
        assert.equal(
            f.dispatch(type, { pointerType: "mouse", button: 2, buttons: 3 }),
            false,
        );
    }
});

test("real movement, dragging, and non-mouse pointers remain untouched", () => {
    const f = fixture();
    for (const buttons of [0, 1, 2, 3]) {
        assert.equal(
            f.dispatch("pointermove", {
                pointerType: "mouse",
                button: -1,
                buttons,
                movementX: 600,
                movementY: -120,
            }),
            false,
        );
    }
    for (const pointerType of ["pen", "touch"]) {
        assert.equal(
            f.dispatch("pointermove", { pointerType, button: 2 }),
            false,
        );
    }
    f.context.document.pointerLockElement = null;
    assert.equal(
        f.dispatch("pointermove", { pointerType: "mouse", button: 2 }),
        false,
    );
});

test("installing twice does not register duplicate handlers", () => {
    const f = fixture();
    runInNewContext(script, f.context);
    assert.equal(f.listeners.length, 1);
});
