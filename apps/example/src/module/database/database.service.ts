export class DatabaseService {
    private users = new Map<string, any>()

    async findUserById(id: string) {
        return this.users.get(id)
    }

    async listUsers() {
        return Array.from(this.users.values())
    }

    async saveUser(user: any) {
        this.users.set(user.id, user)
        return user
    }
}
