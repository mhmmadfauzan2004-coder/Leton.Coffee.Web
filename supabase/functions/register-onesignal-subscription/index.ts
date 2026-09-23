import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-admin-role, x-outlet-id",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ALLOWED_OUTLETS = new Set(["sudirman", "kelakap_7", "letgo", "central"]);

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ success: false, error: "Method not allowed. Use POST." }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const body = await req.json().catch(() => null);
    if (!body) {
      return new Response(
        JSON.stringify({ success: false, error: "Request body cannot be empty." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { subscription_id, subscriptionId, username, outlet_id, outletId, role, device_info, deviceInfo } = body;
    
    // Normalize parameters
    const finalSubId = String(subscription_id || subscriptionId || "").trim();
    let finalOutlet = String(outlet_id || outletId || "").trim().toLowerCase();
    const finalUsername = String(username || "admin").trim();
    const finalRole = String(role || "outlet_admin").trim();
    const finalDeviceInfo = String(device_info || deviceInfo || "web").trim();

    console.log(`[register-onesignal-subscription] Received payload: subId=${finalSubId}, outlet=${finalOutlet}, user=${finalUsername}`);

    // 1. Validation: subscription_id cannot be empty
    if (!finalSubId) {
      return new Response(
        JSON.stringify({ success: false, error: "subscription_id is required and cannot be empty." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Map common aliases to allowed outlets if necessary
    if (finalOutlet.includes("sudirman") || finalOutlet.includes("chapter-5") || finalOutlet.includes("chapter_5")) {
      finalOutlet = "sudirman";
    } else if (finalOutlet.includes("kelakap") || finalOutlet.includes("ratusima") || finalOutlet.includes("chapter-6") || finalOutlet.includes("chapter_6")) {
      finalOutlet = "kelakap_7";
    } else if (finalOutlet.includes("letgo") || finalOutlet.includes("let_go") || finalOutlet.includes("mpp")) {
      finalOutlet = "letgo";
    } else if (finalOutlet === "all" || finalOutlet === "pusat" || finalOutlet === "admin" || finalOutlet.includes("central")) {
      finalOutlet = "central";
    }

    // 2. Validation: outlet_id must be in ALLOWED_OUTLETS
    if (!ALLOWED_OUTLETS.has(finalOutlet)) {
      return new Response(
        JSON.stringify({
          success: false,
          error: `Invalid outlet_id: "${finalOutlet}". Allowed: sudirman, kelakap_7, letgo, central.`
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Supabase server-side client with SERVICE_ROLE_KEY
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "https://galwyavdonfzuibrmswt.supabase.co";
    const supabaseServiceKey =
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ||
      Deno.env.get("SUPABASE_SERVICE_KEY") ||
      Deno.env.get("SUPABASE_ANON_KEY") ||
      "";

    if (!supabaseServiceKey) {
      console.error("[register-onesignal-subscription] SUPABASE_SERVICE_ROLE_KEY is not available in environment.");
      return new Response(
        JSON.stringify({ success: false, error: "Supabase service credentials are missing in Edge Function runtime." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      }
    });

    // 4. UPSERT into public.admin_onesignal_subscriptions
    const recordToUpsert = {
      subscription_id: finalSubId,
      username: finalUsername,
      outlet_id: finalOutlet,
      role: finalRole,
      device_info: finalDeviceInfo,
      updated_at: new Date().toISOString()
    };

    console.log(`[register-onesignal-subscription] Executing UPSERT on admin_onesignal_subscriptions:`, recordToUpsert);

    const { error: upsertErr } = await supabase
      .from("admin_onesignal_subscriptions")
      .upsert(recordToUpsert, { onConflict: "subscription_id" });

    if (upsertErr) {
      console.error("[register-onesignal-subscription] UPSERT failed:", upsertErr);
      return new Response(
        JSON.stringify({
          success: false,
          error: `UPSERT error: ${upsertErr.message}`,
          code: upsertErr.code
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 5. Direct SELECT verification to guarantee row actually exists in database
    console.log(`[register-onesignal-subscription] Verifying row existence for subscription_id: ${finalSubId}`);
    const { data: verifiedRow, error: selectErr } = await supabase
      .from("admin_onesignal_subscriptions")
      .select("*")
      .eq("subscription_id", finalSubId)
      .maybeSingle();

    if (selectErr) {
      console.error("[register-onesignal-subscription] SELECT verification error:", selectErr);
      return new Response(
        JSON.stringify({
          success: false,
          error: `Verification query error: ${selectErr.message}`
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!verifiedRow) {
      console.error("[register-onesignal-subscription] Verification failed: row not found after upsert.");
      return new Response(
        JSON.stringify({
          success: false,
          error: "Verification failed: row was not found in admin_onesignal_subscriptions after upsert."
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[register-onesignal-subscription] SUCCESS! Row confirmed in database:`, verifiedRow);

    // 6. Return verified success
    return new Response(
      JSON.stringify({
        success: true,
        verified: true,
        data: verifiedRow,
        message: `Subscription successfully saved and verified for outlet ${finalOutlet}.`
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("[register-onesignal-subscription] Unhandled exception:", err);
    return new Response(
      JSON.stringify({
        success: false,
        error: err?.message || String(err)
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
