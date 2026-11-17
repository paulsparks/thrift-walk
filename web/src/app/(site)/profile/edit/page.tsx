import { redirect } from "next/navigation";

import { ProfileEditor } from "@/components/profile-editor";
import { getSessionDb } from "@/lib/session-db";

export const metadata = { title: "Edit profile | ThriftWalk" };

export default async function EditProfile() {
    const session = await getSessionDb();
    if (!session) redirect("/sign-in?redirect=/profile/edit");
    const user = await session.db.user.findUniqueOrThrow({
        where: { id: session.user.id },
        select: { name: true, image: true, bio: true },
    });
    return <ProfileEditor user={user} />;
}
