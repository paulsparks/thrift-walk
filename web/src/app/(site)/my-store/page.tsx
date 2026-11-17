import { redirect } from "next/navigation";

import { OwnerInventory } from "@/components/owner-inventory";
import { getSessionDb } from "@/lib/session-db";
export const metadata = { title: "My Stores | ThriftWalk" };
export default async function MyStore() {
    const session = await getSessionDb();
    if (!session) redirect("/sign-in?redirect=/my-store");
    return <OwnerInventory name={session.user.name} />;
}
