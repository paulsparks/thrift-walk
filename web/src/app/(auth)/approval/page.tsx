import { ApprovalForm } from "@/components/approval-forms";
import { getSafeRedirect } from "@/lib/auth-redirect";

export default async function ApprovalPage({
    searchParams,
}: {
    searchParams: Promise<{ redirect?: string | string[] }>;
}) {
    return (
        <section className="card card-border bg-base-100 w-full max-w-sm">
            <div className="card-body gap-4">
                <h1 className="card-title text-3xl">Approve your account</h1>
                <p>Enter a code from an administrator to access ThriftWalk.</p>
                <ApprovalForm
                    redirectTo={getSafeRedirect((await searchParams).redirect)}
                />
                <a href="/sign-out" className="link">
                    Sign out
                </a>
            </div>
        </section>
    );
}
