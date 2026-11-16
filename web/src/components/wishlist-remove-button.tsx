"use client";

import { IconHeartFilled } from "@tabler/icons-react";
import { useClientQueries } from "@zenstackhq/tanstack-query/react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { schema } from "~/zenstack/schema";

export function WishlistRemoveButton({
    itemId,
    name,
}: {
    itemId: string;
    name: string;
}) {
    const router = useRouter();
    const client = useClientQueries(schema);
    const remove = client.wishlistItem.useDeleteMany();
    const [failed, setFailed] = useState(false);

    async function onClick() {
        setFailed(false);
        try {
            await remove.mutateAsync({ where: { itemId } });
            router.refresh();
        } catch {
            setFailed(true);
        }
    }

    return (
        <div className="mt-3">
            <button
                type="button"
                className="btn btn-ghost-outline btn-block btn-sm"
                aria-label={`Remove ${name} from wishlist`}
                disabled={remove.isPending}
                onClick={onClick}
            >
                <IconHeartFilled size={16} aria-hidden="true" />
                Remove
            </button>
            {failed && (
                <p role="alert" className="mt-2 text-sm">
                    Couldn’t remove it. Please try again.
                </p>
            )}
        </div>
    );
}
