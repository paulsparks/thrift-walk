"use client";

import { usePathname } from "next/navigation";

const BARE_ROUTES = ["/sign-in", "/sign-up"];

export function SiteChrome({
    header,
    footer,
    children,
}: {
    header: React.ReactNode;
    footer: React.ReactNode;
    children: React.ReactNode;
}) {
    const pathname = usePathname();
    const isBare = BARE_ROUTES.some(
        (route) => pathname === route || pathname.startsWith(`${route}/`),
    );

    if (isBare) {
        return (
            <main className="flex min-h-screen items-center justify-center p-4">
                {children}
            </main>
        );
    }

    return (
        <>
            {header}
            {children}
            {footer}
        </>
    );
}
