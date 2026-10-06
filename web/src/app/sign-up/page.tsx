import Link from "next/link";

import { getSafeRedirect, withRedirect } from "@/lib/auth-redirect";

import { SignUpForm } from "./sign-up-form";

export default async function SignUpPage({
    searchParams,
}: {
    searchParams: Promise<{ redirect?: string | string[] }>;
}) {
    const redirectTo = getSafeRedirect((await searchParams).redirect);

    return (
        <main className="flex flex-1 items-center justify-center">
            <div className="card bg-base-100 w-full max-w-sm shadow-md">
                <div className="card-body gap-4">
                    <h1 className="card-title text-2xl">Create account</h1>
                    <SignUpForm redirectTo={redirectTo} />
                    <p className="text-sm">
                        Already have an account?{" "}
                        <Link
                            href={withRedirect("/sign-in", redirectTo)}
                            className="link link-primary"
                        >
                            Sign in
                        </Link>
                    </p>
                </div>
            </div>
        </main>
    );
}
