"use client";
import { useState } from "react";

export default function Home() {
    const [count, setCount] = useState(0);

    return (
        <div className="flex flex-col items-center justify-center gap-4">
            <h1 className="text-4xl">Hello World</h1>
            <button
                onClick={() => setCount(count + 1)}
                type="button"
                className="btn btn-primary"
            >
                {`The button has been clicked ${count} times`}
            </button>
        </div>
    );
}
