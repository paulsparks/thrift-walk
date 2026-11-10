export function LogoMark({ size }: { size: number }) {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden="true"
        >
            <title>ThriftWalk logo</title>
            <circle cx="13" cy="4" r="2.5" />
            <path d="M10 8l-4 3 1 2 3-2 1.5 3-3 6 2 1 3.5-6 3 2.5V22h2v-7l-3-3 .5-3 2.5 2 1.5-1.8L15 8z" />
        </svg>
    );
}
