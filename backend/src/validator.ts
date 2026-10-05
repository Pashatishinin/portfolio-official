import { zValidator as baseValidator } from "@hono/zod-validator";
import type { ValidationTargets } from "hono";
import type { ZodType } from "zod";

/** zValidator with a compact, frontend-friendly 400 body instead of the raw ZodError. */
export const validate = <T extends ZodType, Target extends keyof ValidationTargets>(
	target: Target,
	schema: T,
) =>
	baseValidator(target, schema, (result, c) => {
		if (!result.success) {
			return c.json(
				{
					error: "validation_error",
					issues: result.error.issues.map((issue) => ({
						path: issue.path.join("."),
						message: issue.message,
					})),
				},
				400,
			);
		}
	});
