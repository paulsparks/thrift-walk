/** Formats a price stored in cents, e.g. 8500 -> "$85", 1250 -> "$12.50". */
export function formatPrice(cents: number) {
    return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
    }).format(cents / 100);
}
