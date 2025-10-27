import { Inject } from "@honorer/core"
import { DatabaseService } from "../database/database.service"

export class UserService {
    constructor(@Inject(DatabaseService) private db: DatabaseService) {}

    async listUsers() {
        return this.db.listUsers()
    }

    async getUser(id: string) {
        const user = await this.db.findUserById(id)
        if (!user) throw new Error("User not found")
        return user
    }

    async createUser(data: any) {
        return this.db.saveUser({ id: crypto.randomUUID(), ...data })
    }
}
