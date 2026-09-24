import { createHmac, timingSafeEqual } from "node:crypto";
import type { Request } from "express";
import { getAuth } from "@clerk/express";

export type DemoRole = "restaurant" | "organization" | "admin";

const secret = process.env.SESSION_SECRET ?? "foodrescue-development-secret";
const clerkRoles = new Map<string, DemoRole>();

function encode(value: object) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

export function createDemoToken(role: DemoRole) {
  const payload = encode({ role, iat: Date.now() });
  const signature = createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export function getDemoTokenRole(req: Request): DemoRole | null {
  const header = req.header("authorization");
  if (!header?.startsWith("Bearer ")) return null;

  const token = header.slice("Bearer ".length);
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;

  const expected = createHmac("sha256", secret).update(payload).digest("base64url");
  const valid =
    expected.length === signature.length &&
    timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  if (!valid) return null;

  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      role?: DemoRole;
    };
    return parsed.role === "restaurant" || parsed.role === "admin" ? parsed.role : "organization";
  } catch {
    return null;
  }
}

export function hasValidDemoToken(req: Request) {
  return getDemoTokenRole(req) !== null;
}

export function setClerkRole(req: Request, role: DemoRole) {
  const userId = getAuth(req).userId;
  if (userId) clerkRoles.set(userId, role);
}

export function getDemoRole(req: Request): DemoRole {
  const userId = getAuth(req).userId;
  const clerkRole = userId ? clerkRoles.get(userId) : undefined;
  if (clerkRole) return clerkRole;
  return getDemoTokenRole(req) ?? "organization";
}