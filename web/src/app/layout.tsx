import type { Metadata } from "next";
import {
    Bricolage_Grotesque,
    Instrument_Sans,
    Roboto_Mono,
} from "next/font/google";

import { Providers } from "@/components/Providers";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import "./globals.css";

const bricolage = Bricolage_Grotesque({
    variable: "--font-bricolage",
    subsets: ["latin"],
});

const instrument = Instrument_Sans({
    variable: "--font-instrument",
    subsets: ["latin"],
});

const robotoMono = Roboto_Mono({
    variable: "--font-roboto-mono",
    subsets: ["latin"],
});

export const metadata: Metadata = {
    title: "Thrift Walk",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
    return (
        <html
            lang="en"
            className={`${bricolage.variable} ${instrument.variable} ${robotoMono.variable} h-full antialiased`}
        >
            <body className="min-h-full bg-base-100 text-base-content font-sans text-lg">
                <Providers>
                    <SiteHeader />
                    {children}
                    <SiteFooter />
                </Providers>
            </body>
        </html>
    );
}
