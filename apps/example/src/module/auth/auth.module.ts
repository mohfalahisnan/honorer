import { Module } from "@honorer/core"
import { authMiddleware } from "./auth.middleware"
import { AuthService } from "./auth.service"

@Module({
	providers: [AuthService],
	exports: [AuthService],
	middleware: [authMiddleware],
})
export class AuthModule {}
