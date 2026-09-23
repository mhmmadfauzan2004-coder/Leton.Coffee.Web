// Supabase Edge Function: send-order-push (OneSignal Engine)
// Receives Database Webhook from PostgreSQL (AFTER INSERT ON public.orders)
// and dispatches targeted background push notifications to Outlet Admins via OneSignal.

import { withSupabase } from "npm:@supabase/server";

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

// In-memory cache for idempotency within warm container
const processedOrderIds = new Set<string>();

Deno.serve(
  withSupabase({ auth: "secret" }, async (req) => {
    console.log("[send-order-push:OneSignal] Invoked Edge Function");

    try {
      const payload = await req.json();
      console.log("[send-order-push:OneSignal] Received webhook payload:", JSON.stringify(payload));

      // Support both direct payloads or Supabase db webhook structure
      const isWebhook = payload.type && payload.table && payload.record;
      const type = isWebhook ? payload.type : "INSERT";
      const record = isWebhook ? payload.record : payload;

      // 1. Trigger ONLY for INSERT events
      if (type !== "INSERT") {
        console.log(`[send-order-push:OneSignal] Ignored event type "${type}". We only send notifications for INSERT.`);
        return new Response(JSON.stringify({ success: true, message: "Ignored non-INSERT event" }), {
          headers: { "Content-Type": "application/json" }
        });
      }

      if (!record || !record.id) {
        return new Response(JSON.stringify({ error: "Invalid record data structure" }), {
          status: 400,
          headers: { "Content-Type": "application/json" }
        });
      }

      const orderId = String(record.id);
      const orderNum = record.order_number || record.orderNumber || record.id;
      const orderOutlet = String(record.outlet_id || record.outletId || "").trim();
      const orderOutletName = String(record.outlet_name || record.outletName || "").trim();
      const customerName = String(record.customer_name || record.customerName || "Pelanggan").trim();
      const rawTotal = record.total_amount ?? record.totalAmount ?? record.total ?? 0;
      const totalFormatted = `Rp${Number(rawTotal).toLocaleString("id-ID")}`;

      // 2. Idempotency Check: Prevent duplicate sends for same order
      if (processedOrderIds.has(orderId)) {
        console.log(`[send-order-push:OneSignal] Order #${orderNum} (${orderId}) already processed recently. Skipping duplicate.`);
        return new Response(JSON.stringify({ success: true, message: "Duplicate order skipped by idempotency cache." }), {
          headers: { "Content-Type": "application/json" }
        });
      }

      // 3. Determine target outlet tag
      const combined = `${orderOutlet} ${orderOutletName}`.toLowerCase();
      let targetOutletTag = '';

      if (isSudirmanOutlet(combined)) {
        targetOutletTag = 'sudirman';
      } else if (isKelakapOutlet(combined)) {
        targetOutletTag = 'kelakap_7';
      } else if (isLetgoOutlet(combined)) {
        targetOutletTag = 'letgo';
      }

      // Central / Super Admin MUST NOT receive operational order pushes
      if (!targetOutletTag) {
        console.log(`[send-order-push:OneSignal] Outlet "${combined}" not recognized as operational outlet. Push skipped.`);
        return new Response(JSON.stringify({ success: true, message: "Non-operational or unknown outlet. Skipped." }), {
          headers: { "Content-Type": "application/json" }
        });
      }

      console.log(`[send-order-push:OneSignal] Target outlet identified: "${targetOutletTag}" for Order #${orderNum}`);

      // 4. Retrieve OneSignal Credentials
      const oneSignalAppId = Deno.env.get("ONESIGNAL_APP_ID") || Deno.env.get("VITE_ONESIGNAL_APP_ID") || "517cbdc4-cd11-4661-b4e6-aec93387acb1";
      const oneSignalApiKey = Deno.env.get("ONESIGNAL_REST_API_KEY");

      if (!oneSignalAppId || !oneSignalApiKey) {
        console.error("[send-order-push:OneSignal] Missing ONESIGNAL_APP_ID or ONESIGNAL_REST_API_KEY in Edge Function secrets.");
        return new Response(JSON.stringify({
          error: "ONESIGNAL_APP_ID or ONESIGNAL_REST_API_KEY environment variable is not configured."
        }), {
          status: 500,
          headers: { "Content-Type": "application/json" }
        });
      }

      // 5. Construct notification payload for OneSignal REST API
      const notificationTitle = "🔔 Leton Coffee";
      const notificationBody = `Pesanan Baru Masuk!\n#${orderNum} • ${customerName} • ${totalFormatted}`;
      const targetUrl = `https://leton-coffee-web.pages.dev/#admin?tab=orders&orderId=${encodeURIComponent(orderId)}&outletId=${encodeURIComponent(targetOutletTag)}`;

      const oneSignalPayload = {
        app_id: oneSignalAppId,
        headings: {
          en: notificationTitle
        },
        contents: {
          en: notificationBody
        },
        // Filter specifically for devices tagged with target outlet_id
        filters: [
          { field: "tag", key: "outlet_id", relation: "=", value: targetOutletTag }
        ],
        url: targetUrl,
        web_url: targetUrl,
        chrome_web_icon: "https://leton-coffee-web.pages.dev/logo_icon_small.png",
        chrome_web_badge: "https://leton-coffee-web.pages.dev/logo_icon_small.png",
        data: {
          type: "NEW_ORDER",
          orderId: orderId,
          orderNumber: String(orderNum),
          outletId: targetOutletTag,
          url: targetUrl
        },
        // OneSignal collapse_id prevents duplicate popups on devices
        collapse_id: `order-${orderId}`
      };

      console.log(`[send-order-push:OneSignal] Calling OneSignal API for Order #${orderNum}...`);

      const osRes = await fetch("https://onesignal.com/api/v1/notifications", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Key ${oneSignalApiKey}`
        },
        body: JSON.stringify(oneSignalPayload)
      });

      const osData = await osRes.json();
      console.log("[send-order-push:OneSignal] OneSignal response:", JSON.stringify(osData));

      if (!osRes.ok || osData.errors) {
        const errStr = JSON.stringify(osData.errors || "");
        if (errStr.includes("not subscribed") || errStr.includes("no players") || errStr.includes("All included players")) {
          console.log(`[send-order-push:OneSignal] Notice: No active device subscriptions found with tag outlet_id = "${targetOutletTag}".`);
          return new Response(JSON.stringify({
            success: true,
            message: `OneSignal notification accepted, but 0 active devices are tagged for outlet "${targetOutletTag}".`,
            recipients: 0,
            target_outlet: targetOutletTag
          }), {
            status: 200,
            headers: { "Content-Type": "application/json" }
          });
        }

        console.error("[send-order-push:OneSignal] OneSignal API returned errors:", osData);
        return new Response(JSON.stringify({
          success: false,
          error: osData.errors || "OneSignal notification dispatch failed",
          details: osData
        }), {
          status: osRes.status >= 400 ? osRes.status : 500,
          headers: { "Content-Type": "application/json" }
        });
      }

      // Mark order as processed in memory
      processedOrderIds.add(orderId);
      if (processedOrderIds.size > 200) {
        const first = processedOrderIds.values().next().value;
        if (first) processedOrderIds.delete(first);
      }

      return new Response(JSON.stringify({
        success: true,
        message: "Notification successfully dispatched via OneSignal",
        onesignal_id: osData.id,
        recipients: osData.recipients,
        target_outlet: targetOutletTag
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    } catch (err: any) {
      console.error("[send-order-push:OneSignal] Unhandled exception:", err);
      return new Response(JSON.stringify({
        success: false,
        error: err?.message || String(err)
      }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }
  })
);
