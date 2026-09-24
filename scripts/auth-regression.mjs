import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const domain = process.env.AUTH_TEST_BASE_URL
  ?? (process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : "http://127.0.0.1:80");
const base = domain.replace(/\/+$/, "");

async function request(path, options) {
  const response = await fetch(`${base}${path}`, options);
  const text = await response.text();
  let body = text;
  try {
    body = JSON.parse(text);
  } catch {
    // HTML responses are intentionally kept as text for route assertions.
  }
  return { response, body };
}

function assertStatus(result, expected, label) {
  assert.equal(result.response.status, expected, `${label}: expected ${expected}, received ${result.response.status}`);
}

const landing = await request("/");
assertStatus(landing, 200, "public landing");
assert.match(String(landing.body), /FoodRescue|id="root"/, "public landing should return the app shell");

for (const path of ["/sign-in", "/sign-up"]) {
  const authRoute = await request(path);
  assertStatus(authRoute, 200, `${path} route`);
  assert.match(String(authRoute.body), /id="root"/, `${path} should resolve through the client app`);
}

const health = await request("/api/healthz");
assertStatus(health, 200, "health check");
assert.deepEqual(health.body, { status: "ok" }, "health check should remain public");

const unauthenticatedMe = await request("/api/auth/me");
assertStatus(unauthenticatedMe, 401, "unauthenticated current-user request");
assert.deepEqual(unauthenticatedMe.body, { error: "Authentication required." });

const unauthenticatedRole = await request("/api/auth/role", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ role: "restaurant" }),
});
assertStatus(unauthenticatedRole, 401, "unauthenticated role onboarding request");

const demoLogin = await request("/api/auth/demo-login", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ role: "restaurant" }),
});
assertStatus(demoLogin, 200, "demo compatibility login");
assert.ok(demoLogin.body?.token, "demo compatibility login should return a token");

const authenticatedMe = await request("/api/auth/me", {
  headers: { authorization: `Bearer ${demoLogin.body.token}` },
});
assertStatus(authenticatedMe, 200, "authenticated current-user request");
assert.equal(authenticatedMe.body?.role, "restaurant", "authenticated role should be preserved");

const authenticatedDonations = await request("/api/donations", {
  headers: { authorization: `Bearer ${demoLogin.body.token}` },
});
assertStatus(authenticatedDonations, 200, "authenticated donations request");
assert.ok(Array.isArray(authenticatedDonations.body), "authenticated donations should return an array");

const appSource = await readFile("artifacts/food-rescue/src/App.tsx", "utf8");
assert.match(appSource, /path="\/sign-in\/\*\?"/, "sign-in must support Clerk callback subpaths");
assert.match(appSource, /path="\/sign-up\/\*\?"/, "sign-up must support Clerk callback subpaths");
assert.match(appSource, /credentials:\s*"include"/, "role onboarding must send the Clerk session cookie");
assert.match(appSource, /\/api\/auth\/role/, "role onboarding must call the server");

const serverSource = await readFile("artifacts/api-server/src/routes/foodrescue.ts", "utf8");
assert.match(serverSource, /router\.use\(requireAppAuth\)/, "protected API routes must use auth middleware");

console.log(`Auth regression checks passed against ${base}`);