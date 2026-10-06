import Link from "next/link";

import { getSafeRedirect, withRedirect } from "@/lib/auth-redirect";

import { SignInForm } from "./sign-in-form";

export default async function SignInPage({
    searchParams,
}: {
    searchParams: Promise<{ redirect?: string | string[] }>;
}) {
    const redirectTo = getSafeRedirect((await searchParams).redirect);

    return (
        <main className="flex flex-1 items-center justify-center">
            <div className="card bg-base-100 w-full max-w-sm shadow-md">
                <div className="card-body gap-4">
                    <h1 className="card-title text-2xl">Sign in</h1>
                    <SignInForm redirectTo={redirectTo} />
                    <p className="text-sm">
                        Don&apos;t have an account?{" "}
                        <Link
                            href={withRedirect("/sign-up", redirectTo)}
                            className="link link-primary"
                        >
                            Create account
                        </Link>
                    </p>
                </div>
            </div>
        </main>
    );
}
