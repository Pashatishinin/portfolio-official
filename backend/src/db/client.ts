import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { env } from "../env";
import * as schema from "./schema";

// HTTP driver: one request per query, no open connections — ideal for Vercel functions.
export const db = drizzle({ client: neon(env.DATABASE_URL), schema });
