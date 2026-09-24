import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-admin-role, x-outlet-id",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Helper functions to categorize order outlet
function isSudirmanOutlet(val: string | null | undefined): boolean {
  if (!val) return false;
  const s = String(val).toLowerCase().trim();
  return (
    s === 'sudirman' ||
    s.includes('sudirman') ||
    s === 'chapter-5' ||
    s === 'chapter_5' ||
    s === 'chapter5' ||
    s.includes('chapter 5') ||
    s.includes('chapter-5') ||
    s.includes('ch-5')
  );
}

function isKelakapOutlet(val: string | null | undefined): boolean {
  if (!val) return false;
  const s = String(val).toLowerCase().trim();
  return (
    s === 'kelakap_7' ||
    s === 'kelakap' ||
    s === 'ratusima' ||
    s.includes('kelakap') ||
    s.includes('ratusima') ||
    s === 'chapter-6' ||
    s === 'chapter_6' ||
    s === 'chapter6' ||
    s.includes('chapter 6') ||
    s.includes('chapter-6') ||
    s.includes('ch-6')
  );
}

function isLetgoOutlet(val: string | null | undefined): boolean {
  if (!val) return false;
  const s = String(val).toLowerCase().trim();
  return (
    s === 'letgo' ||
    s === 'letgo-mpp' ||
    s === 'let_go' ||
    s === 'let-go' ||
    s.includes('letgo') ||
    s.includes('let-go') ||
    s.includes('mpp')
  );
}

function normalizeOutlet(val: string | null | undefined): string {
  const combined = String(val || "").toLowerCase();
  if (isSudirmanOutlet(combined)) return "sudirman";
  if (isKelakapOutlet(combined)) return "kelakap_7";
  if (isLetgoOutlet(combined)) return "letgo";
  if (combined === "all" || combined === "central" || combined === "pusat") return "central";
  return "";
}

// In-memory cache for idempotency within warm container
const processedOrderIds = new Set<string>();

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
    const payload = await req.json().catch(() => null);
    if (!payload) {
      return new Response(
        JSON.stringify({ success: false, error: "Empty request payload" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[send-order-push] Received payload:", JSON.stringify(payload));

    // Support both direct payloads or Supabase db webhook structure
    const isWebhook = Boolean(payload.type && payload.table && payload.record);
    const eventType = isWebhook ? payload.type : (payload.type || payload.action || "INSERT");
    const record = isWebhook ? payload.record : payload;

    // 1. Check for TEST PUSH mode
    const isTestPush =
      eventType === "TEST" ||
      eventType === "test" ||
      payload.action === "test" ||
      payload.type === "TEST_PUSH" ||
      payload.isTest === true;

    if (!isTestPush && eventType !== "INSERT") {
      console.log(`[send-order-push] Ignored event type "${eventType}". We only send notifications for INSERT or TEST.`);
      return new Response(
        JSON.stringify({ success: true, message: `Ignored non-INSERT event (${eventType})` }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Initialize Supabase Client with Service Role Key
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "https://galwyavdonfzuibrmswt.supabase.co";
    const supabaseServiceKey =
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ||
      Deno.env.get("SUPABASE_SERVICE_KEY") ||
      Deno.env.get("SUPABASE_ANON_KEY") ||
      "";

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });

    // 3. OneSignal Configuration
    const oneSignalAppId =
      Deno.env.get("ONESIGNAL_APP_ID") ||
      Deno.env.get("VITE_ONESIGNAL_APP_ID") ||
      "517cbdc4-cd11-4661-b4e6-aec93387acb1";
    const oneSignalApiKey =
      Deno.env.get("ONESIGNAL_REST_API_KEY") ||
      Deno.env.get("ONESIGNAL_API_KEY");

    if (!oneSignalApiKey) {
      console.error("[ONESIGNAL PUSH] Missing ONESIGNAL_REST_API_KEY in environment secrets.");
      return new Response(
        JSON.stringify({
          success: false,
          error: "ONESIGNAL_REST_API_KEY secret is not configured in Supabase Edge Function environment."
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // =========================================================================
    // CASE A: TEST NOTIFICATION MODE
    // =========================================================================
    if (isTestPush) {
      const targetOutletRaw = payload.outlet_id || payload.outletId || payload.outlet || "sudirman";
      const targetOutletTag = normalizeOutlet(targetOutletRaw) || "sudirman";
      const username = payload.username || "Admin";

      console.log(`[send-order-push:TEST] Processing test push for outlet: "${targetOutletTag}"...`);

      // Query registered active subscriptions for this outlet from database
      const { data: subRows, error: subDbErr } = await supabase
        .from("admin_onesignal_subscriptions")
        .select("subscription_id, username, outlet_id, is_active")
        .or(`outlet_id.eq.${targetOutletTag},outlet_id.eq.central,outlet_id.eq.all`)
        .or("is_active.eq.true,is_active.is.null");

      if (subDbErr) {
        console.warn("[send-order-push:TEST] Error fetching subscriptions from DB:", subDbErr);
      }

      const subscriptionIds = (subRows || [])
        .map((r: any) => String(r.subscription_id || "").trim())
        .filter((id: string) => id.length > 5);

      console.log(`[send-order-push:TEST] Found ${subscriptionIds.length} target subscription(s) in DB:`, subscriptionIds);

      const testTitle = "🔔 Leton Coffee";
      const testBody = "TEST — Background notification berhasil dikirim.";
      const targetUrl = `https://leton-coffee-web.pages.dev/#admin?tab=orders&outletId=${encodeURIComponent(targetOutletTag)}`;

      const testPayload: Record<string, any> = {
        app_id: oneSignalAppId,
        headings: { en: testTitle },
        contents: { en: testBody },
        web_url: targetUrl,
        chrome_web_icon: "https://leton-coffee-web.pages.dev/logo_icon_small.png",
        chrome_web_badge: "https://leton-coffee-web.pages.dev/logo_icon_small.png",
        data: {
          type: "TEST_PUSH",
          outletId: targetOutletTag,
          username: username,
          timestamp: new Date().toISOString()
        }
      };

      // Set target: include_subscription_ids or fallback to tag filter
      if (subscriptionIds.length > 0) {
        testPayload.include_subscription_ids = subscriptionIds;
      } else {
        testPayload.filters = [
          { field: "tag", key: "outlet_id", relation: "=", value: targetOutletTag }
        ];
      }

      console.log("[send-order-push:TEST] Sending OneSignal payload:", JSON.stringify(testPayload));

      const osRes = await fetch("https://onesignal.com/api/v1/notifications", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Key ${oneSignalApiKey}`
        },
        body: JSON.stringify(testPayload)
      });

      const osStatus = osRes.status;
      const osData = await osRes.json().catch(() => null);

      // Detect invalid player IDs returned by OneSignal
      const invalidPlayerIds: string[] = Array.isArray(osData?.errors?.invalid_player_ids)
        ? osData.errors.invalid_player_ids
        : [];

      if (invalidPlayerIds.length > 0) {
        console.log(`[send-order-push:TEST] Auto-deactivating ${invalidPlayerIds.length} invalid subscription(s) in DB:`, invalidPlayerIds);
        try {
          await supabase
            .from("admin_onesignal_subscriptions")
            .update({
              is_active: false,
              last_push_status: "invalid",
              last_error: "OneSignal returned invalid_player_ids",
              updated_at: new Date().toISOString()
            })
            .in("subscription_id", invalidPlayerIds);
        } catch (deactErr) {
          console.warn("[send-order-push:TEST] Deactivation update error:", deactErr);
        }
      }

      // Track successful sends on remaining valid subscriptions
      const validSentIds = subscriptionIds.filter((id: string) => !invalidPlayerIds.includes(id));
      if (validSentIds.length > 0 && osRes.ok) {
        try {
          await supabase
            .from("admin_onesignal_subscriptions")
            .update({
              last_push_at: new Date().toISOString(),
              last_push_status: invalidPlayerIds.length > 0 ? "partial" : "sent",
              last_error: null,
              updated_at: new Date().toISOString()
            })
            .in("subscription_id", validSentIds);
        } catch (updErr) {
          console.warn("[send-order-push:TEST] Status update error:", updErr);
        }
      }

      console.log(`[OneSignal] outlet=${targetOutletTag} targeted=${subscriptionIds.length} sent=${validSentIds.length} invalid=${invalidPlayerIds.length}`);

      if (!osRes.ok) {
        return new Response(
          JSON.stringify({
            success: false,
            error: osData?.errors || `OneSignal error (HTTP ${osStatus})`,
            http_status: osStatus,
            target: subscriptionIds.length > 0 ? subscriptionIds : `tag:outlet_id=${targetOutletTag}`,
            recipients: 0
          }),
          { status: osStatus >= 400 ? osStatus : 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: "Test notification dispatched successfully",
          id: osData?.id,
          recipients: osData?.recipients ?? validSentIds.length,
          invalid_count: invalidPlayerIds.length,
          target: subscriptionIds.length > 0 ? subscriptionIds : `tag:outlet_id=${targetOutletTag}`,
          http_status: osStatus
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // =========================================================================
    // CASE B: REAL ORDER NOTIFICATION (AFTER INSERT ON public.orders)
    // =========================================================================
    if (!record || !record.id) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid record data structure (missing id)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const orderId = String(record.id);
    const orderNum = record.order_number || record.orderNumber || orderId.slice(0, 8);
    const orderOutletRaw = String(record.outlet_id || record.outletId || "").trim();
    const orderOutletName = String(record.outlet_name || record.outletName || "").trim();
    const customerName = String(record.customer_name || record.customerName || "Pelanggan").trim();
    const rawTotal = record.total_amount ?? record.totalAmount ?? record.total ?? 0;
    const totalFormatted = `Rp${Number(rawTotal).toLocaleString("id-ID")}`;

    // Idempotency check: prevent duplicate push for the same order within container lifetime
    if (processedOrderIds.has(orderId)) {
      console.log(`[send-order-push] Order #${orderNum} (${orderId}) already processed recently. Skipping duplicate.`);
      return new Response(
        JSON.stringify({ success: true, message: "Duplicate order skipped by idempotency cache." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Determine target operational outlet
    const combinedOutlet = `${orderOutletRaw} ${orderOutletName}`.toLowerCase();
    const targetOutletTag = normalizeOutlet(combinedOutlet);

    if (!targetOutletTag || targetOutletTag === "central") {
      console.log(`[send-order-push] Outlet "${combinedOutlet}" not recognized as operational branch (sudirman/kelakap_7/letgo). Push skipped.`);
      return new Response(
        JSON.stringify({ success: true, message: "Non-operational or central outlet. Skipped." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[send-order-push] Identified target outlet: "${targetOutletTag}" for Order #${orderNum} (${customerName}, ${totalFormatted})`);

    // Fetch registered active subscriptions for this outlet from database (is_active = true)
    const { data: subRows, error: subDbErr } = await supabase
      .from("admin_onesignal_subscriptions")
      .select("subscription_id, username, outlet_id, is_active")
      .or(`outlet_id.eq.${targetOutletTag},outlet_id.eq.central,outlet_id.eq.all`)
      .or("is_active.eq.true,is_active.is.null");

    if (subDbErr) {
      console.warn("[send-order-push] Error querying admin_onesignal_subscriptions:", subDbErr);
    }

    const subscriptionIds = (subRows || [])
      .map((r: any) => String(r.subscription_id || "").trim())
      .filter((id: string) => id.length > 5);

    console.log(`[send-order-push] Found ${subscriptionIds.length} active target subscription(s) for outlet "${targetOutletTag}":`, subscriptionIds);

    // Build notification payload
    const notificationTitle = "🔔 Leton Coffee";
    const notificationBody = `Pesanan Baru Masuk!\n#${orderNum} • ${customerName} • ${totalFormatted}`;
    const targetUrl = `https://leton-coffee-web.pages.dev/#admin?tab=orders&orderId=${encodeURIComponent(orderId)}&outletId=${encodeURIComponent(targetOutletTag)}`;

    const oneSignalPayload: Record<string, any> = {
      app_id: oneSignalAppId,
      headings: { en: notificationTitle },
      contents: { en: notificationBody },
      web_url: targetUrl,
      chrome_web_icon: "https://leton-coffee-web.pages.dev/logo_icon_small.png",
      chrome_web_badge: "https://leton-coffee-web.pages.dev/logo_icon_small.png",
      data: {
        type: "NEW_ORDER",
        orderId: orderId,
        orderNumber: String(orderNum),
        outletId: targetOutletTag,
        customerName: customerName,
        totalAmount: rawTotal,
        url: targetUrl
      },
      collapse_id: `order-${orderId}`
    };

    // Target devices directly via subscription IDs, with tag filter fallback
    if (subscriptionIds.length > 0) {
      oneSignalPayload.include_subscription_ids = subscriptionIds;
    } else {
      oneSignalPayload.filters = [
        { field: "tag", key: "outlet_id", relation: "=", value: targetOutletTag }
      ];
    }

    console.log(`[send-order-push] Calling OneSignal API for Order #${orderNum}...`);

    const osRes = await fetch("https://onesignal.com/api/v1/notifications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Key ${oneSignalApiKey}`
      },
      body: JSON.stringify(oneSignalPayload)
    });

    const osStatus = osRes.status;
    const osData = await osRes.json().catch(() => null);

    // Parse invalid player IDs
    const invalidPlayerIds: string[] = Array.isArray(osData?.errors?.invalid_player_ids)
      ? osData.errors.invalid_player_ids
      : [];

    // Automatically deactivate invalid subscriptions in DB so they won't be queried next time
    if (invalidPlayerIds.length > 0) {
      console.log(`[send-order-push] Auto-deactivating ${invalidPlayerIds.length} invalid subscription(s) in DB:`, invalidPlayerIds);
      try {
        await supabase
          .from("admin_onesignal_subscriptions")
          .update({
            is_active: false,
            last_push_status: "invalid",
            last_error: "OneSignal returned invalid_player_ids",
            updated_at: new Date().toISOString()
          })
          .in("subscription_id", invalidPlayerIds);
      } catch (deactErr) {
        console.warn("[send-order-push] Error deactivating invalid subscriptions in DB:", deactErr);
      }
    }

    // Update status for valid sent subscriptions
    const validSentIds = subscriptionIds.filter((id: string) => !invalidPlayerIds.includes(id));
    if (validSentIds.length > 0 && osRes.ok) {
      try {
        await supabase
          .from("admin_onesignal_subscriptions")
          .update({
            last_push_at: new Date().toISOString(),
            last_push_status: invalidPlayerIds.length > 0 ? "partial" : "sent",
            last_error: null,
            updated_at: new Date().toISOString()
          })
          .in("subscription_id", validSentIds);
      } catch (updErr) {
        console.warn("[send-order-push] Error updating push status in DB:", updErr);
      }
    }

    console.log(`[OneSignal] outlet=${targetOutletTag} targeted=${subscriptionIds.length} sent=${validSentIds.length} invalid=${invalidPlayerIds.length}`);

    if (!osRes.ok) {
      const errStr = JSON.stringify(osData?.errors || "");
      if (errStr.includes("not subscribed") || errStr.includes("no players") || errStr.includes("All included players")) {
        console.warn(`[send-order-push] Notice: No active device subscriptions found on OneSignal for outlet "${targetOutletTag}".`);
        return new Response(
          JSON.stringify({
            success: true,
            message: `OneSignal notification accepted, but 0 active devices are registered for outlet "${targetOutletTag}".`,
            recipients: 0,
            target_outlet: targetOutletTag
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.error("[send-order-push] OneSignal API returned errors:", osData);
      if (subscriptionIds.length > 0) {
        try {
          await supabase
            .from("admin_onesignal_subscriptions")
            .update({
              last_push_status: "failed",
              last_error: JSON.stringify(osData?.errors || `HTTP status ${osStatus}`),
              updated_at: new Date().toISOString()
            })
            .in("subscription_id", subscriptionIds);
        } catch (failErr) {
          console.warn("[send-order-push] Error updating failed status in DB:", failErr);
        }
      }

      return new Response(
        JSON.stringify({
          success: false,
          error: osData?.errors || "OneSignal notification dispatch failed",
          details: osData
        }),
        { status: osStatus >= 400 ? osStatus : 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Mark order as processed in memory
    processedOrderIds.add(orderId);
    if (processedOrderIds.size > 200) {
      const first = processedOrderIds.values().next().value;
      if (first) processedOrderIds.delete(first);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Notification successfully dispatched via OneSignal",
        onesignal_id: osData?.id,
        recipients: osData?.recipients ?? validSentIds.length,
        invalid_count: invalidPlayerIds.length,
        target_outlet: targetOutletTag,
        target: subscriptionIds.length > 0 ? subscriptionIds : `tag:outlet_id=${targetOutletTag}`
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("[send-order-push] Unhandled exception:", err);
    return new Response(
      JSON.stringify({
        success: false,
        error: err?.message || String(err)
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
