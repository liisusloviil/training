import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const env = {
  url: process.env.NEXT_PUBLIC_SUPABASE_URL,
  anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  userAEmail: process.env.TEST_USER_A_EMAIL,
  userAPassword: process.env.TEST_USER_A_PASSWORD,
  userBEmail: process.env.TEST_USER_B_EMAIL,
  userBPassword: process.env.TEST_USER_B_PASSWORD,
};

const hasLiveEnv = Object.values(env).every(
  (value) => typeof value === "string" && value.length > 0,
);

type SignedClient = {
  client: SupabaseClient;
  userId: string;
};

function createAnonClient(): SupabaseClient {
  if (!hasLiveEnv) {
    throw new Error("Live security env is not configured.");
  }

  return createClient(env.url!, env.anonKey!, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

async function signIn(email: string, password: string): Promise<SignedClient> {
  const client = createAnonClient();
  const { data, error } = await client.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.user) {
    throw new Error(`Не удалось авторизовать smoke-пользователя ${email}: ${error?.message ?? "no-user"}`);
  }

  return {
    client,
    userId: data.user.id,
  };
}

const describeLive = hasLiveEnv ? describe : describe.skip;

describeLive("security smoke: live RLS/storage", () => {
  let userA: SignedClient;
  let userB: SignedClient;
  const createdPlanIds: string[] = [];
  const createdStoragePaths: string[] = [];

  beforeAll(async () => {
    userA = await signIn(env.userAEmail!, env.userAPassword!);
    userB = await signIn(env.userBEmail!, env.userBPassword!);
  });

  afterAll(async () => {
    if (createdPlanIds.length) {
      await userA.client.from("training_plans").delete().in("id", createdPlanIds);
      createdPlanIds.length = 0;
    }

    if (createdStoragePaths.length) {
      await userA.client.storage.from("plan-files").remove(createdStoragePaths);
      createdStoragePaths.length = 0;
    }
  });

  it("user B cannot read user A training_plans", async () => {
    const planName = `security-smoke-${Date.now()}-${randomUUID()}`;

    const { data: inserted, error: insertError } = await userA.client
      .from("training_plans")
      .insert({
        user_id: userA.userId,
        name: planName,
        source_filename: "security-smoke.xlsx",
        source_file_path: null,
        is_active: false,
      })
      .select("id")
      .single<{ id: string }>();

    if (insertError || !inserted) {
      throw new Error(`Не удалось подготовить данные для security smoke: ${insertError?.message ?? "insert-failed"}`);
    }

    createdPlanIds.push(inserted.id);

    const { data: visibleForB, error: readError } = await userB.client
      .from("training_plans")
      .select("id")
      .eq("id", inserted.id)
      .maybeSingle<{ id: string }>();

    expect(readError).toBeNull();
    expect(visibleForB).toBeNull();
  });

  it("user B cannot update user A training_plans", async () => {
    const planName = `security-update-${Date.now()}-${randomUUID()}`;

    const { data: inserted, error: insertError } = await userA.client
      .from("training_plans")
      .insert({
        user_id: userA.userId,
        name: planName,
        source_filename: "security-update.xlsx",
        source_file_path: null,
        is_active: false,
      })
      .select("id, name")
      .single<{ id: string; name: string }>();

    if (insertError || !inserted) {
      throw new Error(`Не удалось подготовить данные для update smoke: ${insertError?.message ?? "insert-failed"}`);
    }

    createdPlanIds.push(inserted.id);

    const { data: updatedByB, error: updateError } = await userB.client
      .from("training_plans")
      .update({ name: "hacked-by-user-b" })
      .eq("id", inserted.id)
      .select("id, name");

    expect(updateError).toBeNull();
    expect(updatedByB ?? []).toHaveLength(0);

    const { data: sourceForA, error: sourceReadError } = await userA.client
      .from("training_plans")
      .select("name")
      .eq("id", inserted.id)
      .single<{ name: string }>();

    expect(sourceReadError).toBeNull();
    expect(sourceForA?.name).toBe(planName);
  });

  it("storage access is limited by auth.uid() prefix", async () => {
    const ownPath = `${userA.userId}/security-smoke/${Date.now()}-${randomUUID()}.txt`;
    createdStoragePaths.push(ownPath);

    const { error: uploadOwnError } = await userA.client.storage
      .from("plan-files")
      .upload(ownPath, "ok", {
        contentType: "text/plain",
        upsert: false,
      });

    expect(uploadOwnError).toBeNull();

    const { data: foreignFile, error: foreignReadError } = await userB.client.storage
      .from("plan-files")
      .download(ownPath);

    expect(foreignFile).toBeNull();
    expect(foreignReadError).not.toBeNull();

    const forbiddenUploadPath = `${userA.userId}/security-smoke/${Date.now()}-forbidden-${randomUUID()}.txt`;
    createdStoragePaths.push(forbiddenUploadPath);

    const { error: uploadForeignError } = await userB.client.storage
      .from("plan-files")
      .upload(forbiddenUploadPath, "forbidden", {
        contentType: "text/plain",
        upsert: false,
      });

    expect(uploadForeignError).not.toBeNull();
  });

});
