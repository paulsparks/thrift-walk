"use client";
import { useClientQueries } from "@zenstackhq/tanstack-query/react";
import { useState } from "react";

import { schema } from "~/zenstack/schema";

export default function Home() {
    const [count, setCount] = useState(0);
    const client = useClientQueries(schema);

    const { data: users } = client.user.useFindMany();

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
            {users ? (
                <p>
                    <span className="font-bold">Users:</span>{" "}
                    {users.map((u) => u.name).join(", ")}
                </p>
            ) : (
                <span className="loading loading-spinner loading-sm" />
            )}
        </div>
    );
}
