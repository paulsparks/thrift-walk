import {
    type ClientContract,
    type ClientOptions,
    ZenStackClient,
} from "@zenstackhq/orm";
import { PostgresDialect } from "@zenstackhq/orm/dialects/postgres";
import { PolicyPlugin } from "@zenstackhq/plugin-policy";
import { Pool } from "pg";

import { type SchemaType, schema } from "~/zenstack/schema";

import { marketProcedures } from "./market/procedures";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export const db: ClientContract<SchemaType> = new ZenStackClient(schema, {
    procedures: marketProcedures,
    dialect: new PostgresDialect({
        pool,
    }),
});

// The policy client backs generic queries; privileged marketplace procedures
// are available only on the internal client used by authenticated adapters.
const policyOptions: ClientOptions<SchemaType> = {
    ...db.$options,
    slicing: { includedProcedures: [] },
};
export const dbWithAuth = db
    .$setOptions(policyOptions)
    .$use(new PolicyPlugin());
