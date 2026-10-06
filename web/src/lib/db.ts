import { type ClientContract, ZenStackClient } from "@zenstackhq/orm";
import { PostgresDialect } from "@zenstackhq/orm/dialects/postgres";
import { PolicyPlugin } from "@zenstackhq/plugin-policy";
import { Pool } from "pg";

import { type SchemaType, schema } from "~/zenstack/schema";

export const db: ClientContract<SchemaType> = new ZenStackClient(schema, {
    dialect: new PostgresDialect({
        pool: new Pool({
            connectionString: process.env.DATABASE_URL,
        }),
    }),
});

export const dbWithAuth = db.$use(new PolicyPlugin());
