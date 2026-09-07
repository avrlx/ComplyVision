// @vitest-environment node
import { readFileSync, readdirSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, afterAll, expect, it } from "vitest";

let db: PGlite;
const alice = "11111111-1111-4111-8111-111111111111";
const bob = "22222222-2222-4222-8222-222222222222";
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create schema auth;
    create table auth.users(id uuid primary key, raw_user_meta_data jsonb);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create function auth.jwt() returns jsonb language sql stable as $$ select current_setting('request.jwt.claims', true)::jsonb $$;
    grant usage on schema public, auth to anon, authenticated;
    grant execute on function auth.uid(), auth.jwt() to anon, authenticated;`);
  const root = new URL("../../../supabase/migrations/", import.meta.url);
  for (const file of readdirSync(root).filter(name => name.endsWith(".sql")).sort()) await db.exec(readFileSync(new URL(file, root), "utf8"));
  // The SQL Editor bundle also supports deployments with existing migrations.
  const setup = readFileSync(new URL("../../../supabase/setup.sql", import.meta.url), "utf8");
  await db.exec(setup);
  await db.exec(setup);
  await db.query("insert into auth.users values ($1, '{\"full_name\":\"Alice\",\"role\":\"admin\"}'), ($2, '{}')", [alice, bob]);
}, 30000);
afterAll(async () => { await db?.close(); });
async function asUser(id: string, anonymous = false) {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub',$1,false), set_config('request.jwt.claims',$2,false)", [id, JSON.stringify({ sub: id, is_anonymous: anonymous })]);
  await db.exec("set role authenticated");
}
it("isolates two accounts, denies anonymous access and prevents role/report edits", async () => {
  await asUser(alice);
  const profiles = await db.query<{ id: string; role: string }>("select id, role from profiles");
  expect(profiles.rows).toEqual([{ id: alice, role: "inspector" }]);
  await expect(db.exec("update profiles set role='admin'")).rejects.toThrow(/permission denied/i);
  await db.exec("update profiles set full_name='Updated name'");
  await db.query("insert into inspections (user_id,status,report) values ($1,'REVIEW','{\"summary\":{\"overall_status\":\"REVIEW\"}}')", [alice]);
  await db.query("insert into inspections (user_id,status,report) values ($1,'NOT_APPLICABLE','{\"summary\":{\"overall_status\":\"NOT_APPLICABLE\"}}')", [alice]);
  await expect(db.query("insert into inspections (user_id,status,report) values ($1,'PASS','{\"summary\":{\"overall_status\":\"REVIEW\"}}')", [alice])).rejects.toThrow(/check constraint/i);
  await expect(db.query("insert into inspections (user_id,status,report) values ($1,'REVIEW','{\"summary\":{\"overall_status\":\"REVIEW\"}}')", [bob])).rejects.toThrow(/row-level security/i);
  await expect(db.exec("update inspections set status='PASS'")).rejects.toThrow(/permission denied/i);
  await expect(db.exec("delete from inspections")).rejects.toThrow(/permission denied/i);
  await asUser(bob);
  expect((await db.query("select * from inspections")).rows).toEqual([]);
  expect((await db.query("select id from profiles")).rows).toEqual([{ id: bob }]);
  await asUser(alice, true);
  expect((await db.query("select * from inspections")).rows).toEqual([]);
  expect((await db.query("select * from profiles")).rows).toEqual([]);
  await expect(db.query("insert into inspections (user_id,status,report) values ($1,'REVIEW','{\"summary\":{\"overall_status\":\"REVIEW\"}}')", [alice])).rejects.toThrow(/row-level security/i);
  await db.exec("reset role; set role anon");
  await expect(db.exec("select * from inspections")).rejects.toThrow(/permission denied/i);
});
