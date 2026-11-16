import Link from "next/link";

export const metadata = {
    title: "3D Scanning FAQ | ThriftWalk",
    description:
        "Everything you need to know about digitizing your physical items for the ThriftWalk market.",
};

// TODO: replace with your real Discord invite link.
const DISCORD_URL = "https://discord.com";

const faqs = [
    {
        question: "What equipment do I need to start scanning?",
        answer: "You only need a modern smartphone with a decent camera. For professional-grade results, we recommend using a tripod and a turntable, but they are not required for standard game assets.",
    },
    {
        question: "How many photos should I take per item?",
        answer: "For a simple item like a shoe or a vase, 30-50 photos are ideal. For complex items like jackets or furniture, aim for 80-100 photos to capture all the folds and hidden details.",
    },
    {
        question: "Why did my scan fail or look “melted”?",
        answer: "This usually happens due to poor lighting or reflective surfaces. Items that are pure black, transparent (glass), or very shiny (chrome) are difficult for photogrammetry. Try to use matte sprays or ensure soft, even lighting.",
    },
    {
        question: "Can I scan my own clothes and wear them in-game?",
        answer: "Yes! That’s one of the core features of ThriftWalk. Once your scan is processed, you can choose to list it on the marketplace or keep it in your “Digital Closet” to wear on your avatar.",
    },
    {
        question: "How long does the processing take?",
        answer: "Standard scans typically take 15-30 minutes. HD scans with high-resolution textures can take up to 2 hours depending on the current server load.",
    },
];

export default function ScanFaq() {
    return (
        <main className="py-12 lg:py-16">
            <div className="mx-auto max-w-3xl px-6">
                <div className="text-center">
                    <h1 className="font-display text-4xl font-extrabold tracking-tight sm:text-5xl">
                        3D scanning FAQ
                    </h1>
                    <p className="mx-auto mt-3 max-w-xl opacity-80">
                        Everything you need to know about digitizing your
                        physical items for the ThriftWalk market.
                    </p>
                </div>

                <div className="mt-12 grid gap-5">
                    {faqs.map((faq) => (
                        <details
                            key={faq.question}
                            className="collapse collapse-arrow border-2 border-base-content bg-base-100"
                            open
                        >
                            <summary className="collapse-title font-display text-lg font-extrabold sm:text-xl">
                                {faq.question}
                            </summary>
                            <div className="collapse-content">
                                <p className="opacity-80">{faq.answer}</p>
                            </div>
                        </details>
                    ))}
                </div>

                <section className="mt-16 rounded-box border-2 border-base-content bg-base-200 p-8 text-center sm:p-10">
                    <h2 className="font-display text-2xl font-extrabold sm:text-3xl">
                        Still have questions?
                    </h2>
                    <p className="mx-auto mt-3 max-w-md opacity-80">
                        Our community of collectors and tech experts is here to
                        help you get the perfect scan.
                    </p>
                    <div className="mt-8 flex flex-wrap justify-center gap-4">
                        <a
                            href={DISCORD_URL}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-primary btn-lg"
                        >
                            <svg
                                className="size-5"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth={2}
                                strokeLinejoin="round"
                                aria-hidden="true"
                            >
                                <title>Chat</title>
                                <path d="M3 5h12v9H8l-3 3v-3H3z" />
                                <path d="M18 9h3v9h-2v3l-3-3H9v-2" />
                            </svg>
                            Join Discord
                        </a>
                        <Link
                            href="/contact"
                            className="btn btn-ghost-outline btn-lg"
                        >
                            <svg
                                className="size-5"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth={2}
                                strokeLinejoin="round"
                                aria-hidden="true"
                            >
                                <title>Email</title>
                                <rect
                                    x="3"
                                    y="5"
                                    width="18"
                                    height="14"
                                    rx="2"
                                />
                                <path d="M3 7l9 6 9-6" />
                            </svg>
                            Contact support
                        </Link>
                    </div>
                </section>
            </div>
        </main>
    );
}
