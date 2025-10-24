import { type Insertable, Kysely, type Selectable, type Updateable } from 'kysely'

/**
 * Extended Kysely database class that provides a fluent CRUD controller factory.
 *
 * @template DB - The database schema type.
 */
export class Database<DB> extends Kysely<DB> {
	/**
	 * Creates a CRUD controller for a given table.
	 *
	 * @template Table - Name of the table to control.
	 * @param table - The table to create CRUD operations for.
	 * @param opts - Optional settings.
	 * @param opts.idColumn - The column to treat as the primary identifier (defaults to "id").
	 * @returns An object with list, getById, create, updateById, and deleteById methods.
	 */
	createCrudController<Table extends keyof DB & string>(
		table: Table,
		opts?: { idColumn?: Extract<keyof DB[Table], string> },
	): {
		list: () => Promise<Selectable<DB[Table]>[]>
		getById: (id: unknown) => Promise<Selectable<DB[Table]> | undefined>
		create: (data: Insertable<DB[Table]>) => Promise<Selectable<DB[Table]> | undefined>
		updateById: (id: unknown, patch: Updateable<DB[Table]>) => Promise<Selectable<DB[Table]> | undefined>
		deleteById: (id: unknown) => Promise<number>
	} {
		const idColumn = (opts?.idColumn ?? ('id' as Extract<keyof DB[Table], string>)) as any

		return {
			/**
			 * Retrieve all rows from the table.
			 */
			list: async (): Promise<Selectable<DB[Table]>[]> => {
				const qb = this.selectFrom(table).selectAll()
				const rows = await qb.execute()
				return rows as unknown as Selectable<DB[Table]>[]
			},
			/**
			 * Fetch a single row by its identifier.
			 * @param id - The identifier value to look up.
			 */
			getById: async (id: unknown): Promise<Selectable<DB[Table]> | undefined> => {
				const qb = this.selectFrom(table).selectAll()
				const row = await (qb.where as any)(idColumn, '=', id as any).executeTakeFirst()
				return row as unknown as Selectable<DB[Table]> | undefined
			},
			/**
			 * Insert a new row into the table.
			 * @param data - The row data to insert.
			 */
			create: async (data: Insertable<DB[Table]>): Promise<Selectable<DB[Table]> | undefined> => {
				const qb = this.insertInto(table)
					.values(data as any)
					.returningAll()
				const row = await qb.executeTakeFirst()
				return row as unknown as Selectable<DB[Table]> | undefined
			},
			/**
			 * Update an existing row by its identifier.
			 * @param id - The identifier of the row to update.
			 * @param patch - The partial data to apply.
			 */
			updateById: async (
				id: unknown,
				patch: Updateable<DB[Table]>,
			): Promise<Selectable<DB[Table]> | undefined> => {
				const qb = this.updateTable(table)
				const row = await (qb.set as any)(patch as any)
					.where(idColumn, '=', id as any)
					.returningAll()
					.executeTakeFirst()
				return row as unknown as Selectable<DB[Table]> | undefined
			},
			/**
			 * Delete a row by its identifier.
			 * @param id - The identifier of the row to delete.
			 * @returns The number of rows deleted (0 or 1).
			 */
			deleteById: async (id: unknown): Promise<number> => {
				const qb = this.deleteFrom(table)
				const res = await (qb.where as any)(idColumn, '=', id as any).execute()
				return Array.isArray(res) ? res.length : 0
			},
		}
	}
}
