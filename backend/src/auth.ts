import { createAuth, googleProvider, type SessionPayload } from "hono-auth-core";
import { env } from "./env";

export type AuthUser = SessionPayload & {
	email: string;
	name?: string;
	avatarUrl?: string;
};

class NotOwnerError extends Error {
	constructor(email: string | undefined) {
		super(`Sign-in rejected for ${email ?? "unknown email"}`);
	}
}

export const isOwner = (email: unknown): email is string =>
	typeof email === "string" && env.OWNER_EMAILS.includes(email.toLowerCase());

const frontend = (path: string) => `${env.FRONTEND_URL}${path}`;

export const auth = createAuth<AuthUser>({
	jwt: {
		secret: env.JWT_SECRET,
		accessTokenExpiresIn: "15m",
		refreshTokenExpiresIn: "30d",
		issuer: "aquarium-api",
	},
	providers: [
		googleProvider({
			clientId: env.GOOGLE_CLIENT_ID,
			clientSecret: env.GOOGLE_CLIENT_SECRET,
			redirectUri: `${env.API_URL}/api/auth/google/callback`,
		}),
	],
	cookies: {
		domain: env.COOKIE_DOMAIN,
		secure: env.COOKIE_SECURE,
		sameSite: "Lax",
	},
	// Only the owner may get in — every other Google account is turned away
	// before a session is ever issued.
	beforeCreateUser: (profile) => {
		const verified = profile.raw.email_verified === true || profile.raw.email_verified === "true";
		if (!verified || !isOwner(profile.email)) {
			throw new NotOwnerError(profile.email);
		}
	},
	onSuccess: (profile) => ({
		sub: profile.id,
		email: profile.email!.toLowerCase(),
		name: profile.name,
		avatarUrl: profile.avatarUrl,
	}),
	redirectTo: () => frontend("/aquarium"),
	onError: (error) => {
		if (error instanceof NotOwnerError) {
			console.warn(error.message);
			return frontend("/aquarium/login?error=forbidden");
		}
		console.error("OAuth error:", error);
		return frontend("/aquarium/login?error=oauth_failed");
	},
});
