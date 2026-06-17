import { z } from "zod";

export const symbolSchema = z
  .string()
  .trim()
  .min(1)
  .max(16)
  .regex(/^[A-Za-z0-9.^-]+$/, "Symbols may only contain letters, numbers, dots, carets, and hyphens.")
  .transform((value) => value.toUpperCase());

export const cryptoIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(/^[a-zA-Z0-9-]+$/, "Crypto ids may only contain letters, numbers, and hyphens.")
  .transform((value) => value.toLowerCase());

export const rangeSchema = z.enum(["1D", "5D", "1M", "3M", "6M", "YTD", "1Y", "5Y", "MAX"]).default("1Y");
export const intervalSchema = z.enum(["1m", "5m", "15m", "30m", "1h", "1D", "1W", "1M"]).default("1D");

export const booleanStringSchema = z
  .enum(["true", "false"])
  .optional()
  .transform((value) => value === "true");

export const safeQuerySchema = z.string().trim().max(80).default("");

export const badRequest = (message: string) => ({
  error: "bad_request",
  message
});

export const parseOrBadRequest = <T>(schema: z.ZodType<T, z.ZodTypeDef, unknown>, value: unknown) => {
  const parsed = schema.safeParse(value);
  if (parsed.success) return { data: parsed.data, error: null };
  return {
    data: null,
    error: badRequest(parsed.error.issues.map((issue) => issue.message).join(" "))
  };
};
