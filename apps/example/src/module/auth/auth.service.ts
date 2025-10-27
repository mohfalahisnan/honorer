export class AuthService {
	validateToken(token: string) {
		return token === "valid-token"
	}
}
