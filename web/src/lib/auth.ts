import { zenstackAdapter } from "@zenstackhq/better-auth";
import { betterAuth } from "better-auth";

import { db } from "./db";
import { bioSchema } from "./profile-bio";

export const auth = betterAuth({
    baseURL: process.env.BETTER_AUTH_URL,
    database: zenstackAdapter(db, {
        provider: "postgresql",
    }),
    rateLimit: { enabled: true, window: 60, max: 30 },
    emailAndPassword: {
        enabled: true,
        sendResetPassword: async ({ user, url }) => {
            const endpoint = process.env.RESET_EMAIL_WEBHOOK_URL;
            if (!endpoint)
                throw new Error(
                    "Password recovery email delivery is not configured",
                );
            const response = await fetch(endpoint, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${process.env.RESET_EMAIL_WEBHOOK_SECRET || ""}`,
                },
                body: JSON.stringify({
                    to: user.email,
                    name: user.name,
                    resetUrl: url,
                }),
                signal: AbortSignal.timeout(10000),
            });
            if (!response.ok)
                throw new Error("Password recovery email delivery failed");
        },
    },
    socialProviders:
        process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
            ? {
                  google: {
                      clientId: process.env.GOOGLE_CLIENT_ID,
                      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
                  },
              }
            : {},
    user: {
        additionalFields: {
            bio: {
                type: "string",
                required: false,
                defaultValue: "",
                validator: { input: bioSchema },
            },
            role: {
                type: ["User", "Admin"],
                defaultValue: "User",
                input: false,
            },
        },
    },
});
