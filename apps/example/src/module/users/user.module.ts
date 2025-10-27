import { Module } from "@honorer/core"
import { AuthModule } from "../auth/auth.module"
import { DatabaseModule } from "../database/database.module"
import { UserService } from "./user.service"
import { UserController } from "./users.controller"

@Module({
	controllers: [UserController],
	providers: [UserService],
	imports: [DatabaseModule, AuthModule],
})
export class UserModule {}
