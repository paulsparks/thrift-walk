"use client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { QuerySettingsProvider } from "@zenstackhq/tanstack-query/react";

const queryClient = new QueryClient();

export function Providers({
    children,
}: Readonly<{ children: React.ReactNode }>) {
    return (
        <QueryClientProvider client={queryClient}>
            <QuerySettingsProvider value={{ endpoint: "/api/model" }}>
                {children}
            </QuerySettingsProvider>
        </QueryClientProvider>
    );
}
