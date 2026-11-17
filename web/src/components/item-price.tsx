import { formatPrice } from "@/lib/format";

export function ItemPrice({
    priceCents,
    externalUrl,
}: {
    priceCents: number | null;
    externalUrl?: string | null;
}) {
    let href: string | undefined;
    try {
        const url = new URL(externalUrl || "");
        if (url.protocol === "https:" && !url.username && !url.password)
            href = url.href;
    } catch {
        /* Legacy items may not have a listing URL. */
    }
    return href ? (
        <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="link font-semibold"
            aria-label={`${formatPrice(priceCents)} — open listing in a new tab`}
        >
            {formatPrice(priceCents)} ↗
        </a>
    ) : (
        <span>
            {priceCents === null
                ? "Price unavailable"
                : formatPrice(priceCents)}
        </span>
    );
}
