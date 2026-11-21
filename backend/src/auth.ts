import type { Context } from "hono";
import {
	createAuth,
	googleProvider,
	setSessionCookies,
	signSessionToken,
	type CookieConfig,
	type JwtConfig,
	type SessionPayload,
} from "hono-auth-core";
import { env } from "./env";

export type AuthUser = SessionPayload & {
	email: string;
	name?: string;
	avatarUrl?: string;
	/** How the session was created. Clients sign in with an emailed code; the owner with Google. */
	via?: "google" | "email-code";
};

export type Role = "owner" | "client";

class NotOwnerError extends Error {
	constructor(email: string | undefined) {
		super(`Sign-in rejected for ${email ?? "unknown email"}`);
	}
}

export const isOwner = (email: unknown): email is string =>
	typeof email === "string" && env.OWNER_EMAILS.includes(email.toLowerCase());

/**
 * The role is always derived on the server: an owner email is only "owner"
 * when it came in through Google, never through an emailed code.
 */
export const roleOf = (user: AuthUser): Role =>
	user.via !== "email-code" && isOwner(user.email) ? "owner" : "client";

const frontend = (path: string) => `${env.FRONTEND_URL}${path}`;

const ACCESS_TTL = "15m";
const REFRESH_TTL = "30d";

const jwtConfig: JwtConfig = {
	secret: env.JWT_SECRET,
	accessTokenExpiresIn: ACCESS_TTL,
	refreshTokenExpiresIn: REFRESH_TTL,
	issuer: "aquarium-api",
};

const cookieConfig: CookieConfig = {
	domain: env.COOKIE_DOMAIN,
	secure: env.COOKIE_SECURE,
	sameSite: "Lax",
};

/**
 * Signs a client in after a correct emailed code: the same cookies and token
 * format as the Google flow, so /auth/refresh and /auth/logout work unchanged.
 */
export async function issueClientSession(c: Context, email: string) {
	const payload: AuthUser = { sub: `client:${email}`, email, via: "email-code" };
	const accessToken = await signSessionToken(payload, jwtConfig, ACCESS_TTL);
	const refreshToken = await signSessionToken(payload, jwtConfig, REFRESH_TTL);
	setSessionCookies(c, { accessToken, refreshToken }, cookieConfig);
}

export const auth = createAuth<AuthUser>({
	jwt: jwtConfig,
	providers: [
		googleProvider({
			clientId: env.GOOGLE_CLIENT_ID,
			clientSecret: env.GOOGLE_CLIENT_SECRET,
			redirectUri: `${env.API_URL}/api/auth/google/callback`,
		}),
	],
	cookies: cookieConfig,
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
		via: "google",
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
