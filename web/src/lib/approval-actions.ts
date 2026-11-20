"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { deleteCode, issueCode, redeemCode } from "./approval";
import { getSafeRedirect } from "./auth-redirect";
import { MarketError } from "./market/validation";

export async function generateApprovalCode() {
    try {
        const code = await issueCode(await headers());
        revalidatePath("/profile");
        return { code, error: "" };
    } catch (error) {
        if (error instanceof MarketError)
            return { code: "", error: error.message };
        throw error;
    }
}

export async function deleteApprovalCode(code: string) {
    try {
        await deleteCode(await headers(), code);
        revalidatePath("/profile");
        return "";
    } catch (error) {
        if (error instanceof MarketError) return error.message;
        throw error;
    }
}

export async function submitApprovalCode(
    redirectTo: string,
    _previous: string,
    data: FormData,
) {
    try {
        await redeemCode(await headers(), data.get("code"));
    } catch (error) {
        if (error instanceof MarketError) return error.message;
        throw error;
    }
    redirect(getSafeRedirect(redirectTo));
}
