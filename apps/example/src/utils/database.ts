import { Database } from "@honorer/core";
import { PostgresDialect } from "kysely";
import { Pool } from "pg";
import type { DB } from "../prisma/kysely/types";

const dialect = new PostgresDialect({
	pool: new Pool({
		database: 'honorer-example',
		host: 'localhost',
		user: 'postgres',
		password: 'password',
		port: 5432,
		max: 10,
	}),
})

// Database interface is passed to Kysely's constructor, and from now on, Kysely
// knows your database structure.
// Dialect is passed to Kysely's constructor, and from now on, Kysely knows how
// to communicate with your database.
export const db = new Database<DB>({
	dialect,
});
