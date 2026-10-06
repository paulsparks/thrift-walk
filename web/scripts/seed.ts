import { db } from "@/lib/db";

async function main() {
    // Seed Data Example:

    // const users = await db.user.createManyAndReturn({
    //     data: [
    //         { name: "Alice Johnson" },
    //         { name: "Bob Martinez" },
    //         { name: "Carol Nguyen" },
    //     ],
    // });

    // console.log(`Seeded ${users.length} users:`);
    // for (const user of users) {
    //     console.log(`  ${user.id}  ${user.name}`);
    // }

    console.log("Nothing to seed");
}

main()
    .catch((err) => {
        console.error("Seed failed:", err);
        process.exitCode = 1;
    })
    .finally(async () => {
        await db.$disconnect();
    });
