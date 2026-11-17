import { db } from "@/lib/db";
import { cleanupMedia } from "@/lib/market/media";

cleanupMedia()
    .catch(() => {
        console.error("Media cleanup failed");
        process.exitCode = 1;
    })
    .finally(() => db.$disconnect());
