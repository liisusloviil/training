import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function AppIndexPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("training_plans")
    .select("id")
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (data?.id) {
    redirect("/plan");
  }

  redirect("/import");
}
