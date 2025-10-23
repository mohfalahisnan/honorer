import { Kysely, type KyselyConfig } from 'kysely'

export class Database<T> {
	constructor(payload: KyselyConfig) {
		// biome-ignore lint/correctness/noConstructorReturn: okay for now
		return new Kysely<T>(payload)
	}
}
