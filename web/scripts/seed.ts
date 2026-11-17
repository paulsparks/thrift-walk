import { db } from "@/lib/db";

// Ownerless legacy listings: intentionally not placeable; never assigned to a player.
// Placeholder listings (first four come from the wireframe).
// Prices are in cents. Listed oldest first so the first item is the newest.
const items = [
    {
        name: "Corduroy Tote Bag",
        details: "Gently Used • Canvas",
        priceCents: 1800,
    },
    { name: "Brass Desk Fan", details: "Vintage • Working", priceCents: 5500 },
    {
        name: "Silk Scarf Set",
        details: "New with Tags • One size",
        priceCents: 2200,
    },
    { name: "Vinyl Record Crate", details: "Rustic • Wood", priceCents: 3000 },
    { name: "Wool Peacoat", details: "Gently Used • L", priceCents: 11000 },
    {
        name: "Polaroid Land Camera",
        details: "Vintage • Tested",
        priceCents: 7200,
    },
    {
        name: "Mid-Century Table Lamp",
        details: "Vintage • Working",
        priceCents: 3800,
    },
    { name: "Denim Trucker Jacket", details: "Used • M", priceCents: 6000 },
    {
        name: "Classic Leather Boots",
        details: "New with Tags • 10",
        priceCents: 9500,
    },
    {
        name: "Industrial Coffee Table",
        details: "Custom • Heavy",
        priceCents: 12000,
    },
    {
        name: "Retro Cassette Player",
        details: "Vintage • Working",
        priceCents: 4500,
    },
    {
        name: "Vintage Bomber Jacket",
        details: "Gently Used • XL",
        priceCents: 8500,
    },
];

async function main() {
    if ((await db.item.count()) > 0) {
        console.log("Items already exist, skipping.");
        return;
    }

    // Insert one at a time so createdAt differs and ordering is stable.
    for (const item of items) {
        await db.item.create({ data: item });
    }

    console.log(`Seeded ${items.length} items`);
}

main()
    .catch((err) => {
        console.error("Seed failed:", err);
        process.exitCode = 1;
    })
    .finally(async () => {
        await db.$disconnect();
    });
