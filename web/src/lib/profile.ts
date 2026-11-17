import type { ClientContract } from "@zenstackhq/orm";

import type { SchemaType } from "~/zenstack/schema";

/** Use the session's policy-enforcing client; inventory belongs to owned stores. */
export async function getProfileData(
    db: ClientContract<SchemaType>,
    userId: string,
) {
    const [user, stores, wishlist] = await Promise.all([
        db.user.findUniqueOrThrow({
            where: { id: userId },
            select: { name: true, image: true, bio: true },
        }),
        db.store.findMany({
            where: { ownerId: userId },
            orderBy: [{ createdAt: "asc" }, { id: "asc" }],
            select: {
                id: true,
                name: true,
                items: {
                    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
                    select: {
                        id: true,
                        name: true,
                        details: true,
                        priceCents: true,
                        externalUrl: true,
                        imageAssetId: true,
                        createdAt: true,
                        placement: { select: { id: true } },
                    },
                },
            },
        }),
        db.wishlistItem.findMany({
            where: { userId },
            orderBy: [{ createdAt: "desc" }, { id: "asc" }],
            select: {
                itemId: true,
                item: {
                    select: {
                        name: true,
                        details: true,
                        priceCents: true,
                        externalUrl: true,
                        imageAssetId: true,
                    },
                },
            },
        }),
    ]);
    const inventory = stores
        .flatMap((store) =>
            store.items.map((item) => ({
                ...item,
                storeId: store.id,
                storeName: store.name,
            })),
        )
        .sort(
            (a, b) =>
                b.createdAt.getTime() - a.createdAt.getTime() ||
                a.id.localeCompare(b.id),
        );
    return { user, stores, wishlist, inventory };
}

export type ProfileData = Awaited<ReturnType<typeof getProfileData>>;
