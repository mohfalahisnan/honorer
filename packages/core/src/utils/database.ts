import { Kysely, type KyselyConfig } from 'kysely'

export class Database<T> {
    constructor(payload: KyselyConfig) {
        return new Kysely<T>(payload)
    }
}

