import Stripe from "npm:stripe@22.0.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!);
const MONTHLY_PRICE_ID = Deno.env.get("FIEXEA_STRIPE_MONTHLY_PRICE_ID") || "price_1UKNzzHkKOD8h4WURGR6uJvl";
const ANNUAL_PRICE_ID = Deno.env.get("FIEXEA_STRIPE_ANNUAL_PRICE_ID") || "price_1UKNvhHkKOD8h4WU54JJKtve";
const appBase = "https://fiexea.es/app.html";
const allowedOrigins = new Set(["https://fiexea.es", "https://www.fiexea.es", "https://josmi0125-coder.github.io"]);
async function billingStatus() {
  try {
    const prices = await Promise.all([stripe.prices.retrieve(MONTHLY_PRICE_ID), stripe.prices.retrieve(ANNUAL_PRICE_ID)]);
    const live = prices.every(price => price.livemode);
    const valid = prices.every((price, i) => price.active && price.currency === "eur" && price.unit_amount === (i ? 4500 : 499) && price.recurring?.interval === (i ? "year" : "month") && price.recurring?.interval_count === 1);
    return { billing_available: live && valid, mode: live ? "live" : "test", prices_valid: valid };
  } catch (_) { return { billing_available: false, mode: "unavailable", prices_valid: false }; }
}
Deno.serve(async req => {
  const origin = req.headers.get("origin");
  const cors = { "Access-Control-Allow-Origin": origin && allowedOrigins.has(origin) ? origin : "https://fiexea.es", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Cache-Control": "no-store", "Vary": "Origin" };
  const json = (body: unknown, status = 200) => Response.json(body, { status, headers: cors });
  if (origin && !allowedOrigins.has(origin)) return json({ error: "Origen no permitido" }, 403);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  // This GET is public and reveals only non-sensitive checkout availability, never keys or customer data.
  if (req.method === "GET") return json(await billingStatus());
  if (req.method !== "POST") return json({ error: "Método no permitido" }, 405);
  try {
    const bearer = req.headers.get("Authorization") || "";
    if (!/^Bearer\s+\S+$/i.test(bearer)) return json({ error: "Inicia sesión para continuar." }, 401);
    const client = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: bearer } }, auth: { persistSession: false, autoRefreshToken: false } });
    const { data: { user }, error } = await client.auth.getUser();
    if (error || !user) return json({ error: "Sesión no válida." }, 401);
    const { plan, action } = await req.json().catch(() => ({}));
    if (action === "portal") {
      // Only the authenticated account's customer may be used. No client-supplied customer IDs.
      const { data: subscriptions, error: subscriptionError } = await client.from("subscriptions")
        .select("stripe_customer_id,livemode,updated_at").eq("user_id", user.id).order("updated_at", { ascending: false });
      if (subscriptionError) throw subscriptionError;
      const liveMode = Deno.env.get("STRIPE_SECRET_KEY")?.startsWith("sk_live_") || Deno.env.get("STRIPE_SECRET_KEY")?.startsWith("rk_live_");
      const subscription = subscriptions?.find(row => row.livemode === !!liveMode && row.stripe_customer_id);
      if (!subscription) return json({ error: "No hay una suscripción de Stripe asociada a tu cuenta en este entorno. Para ayuda, escribe a soporte@fiexea.es." }, 404);
      try {
        const portal = await stripe.billingPortal.sessions.create({ customer: subscription.stripe_customer_id, return_url: appBase });
        return json({ url: portal.url });
      } catch (_) {
        return json({ error: "No se pudo abrir la gestión de suscripciones. Contacta con soporte@fiexea.es.", code: "portal_unavailable" }, 503);
      }
    }
    if (action && action !== "checkout") return json({ error: "Acción no válida." }, 400);
    if (!["monthly", "annual"].includes(plan)) return json({ error: "Plan no válido." }, 400);
    const availability = await billingStatus();
    if (!availability.billing_available) return json({ error: "Los pagos reales todavía no están disponibles. No se ha realizado ningún cargo.", code: "billing_not_ready" }, 503);
    const { data: access, error: accessError } = await client.rpc("fiexea_access_status");
    if (accessError) throw accessError;
    if (access?.state === "paid") return json({ error: "Ya tienes una suscripción activa." }, 409);
    // Admin and preserved accounts can also have a paid subscription: check the actual billing record.
    const { data: subscriptions, error: subscriptionError } = await client.from("subscriptions")
      .select("status").eq("user_id", user.id).eq("livemode", true).in("status", ["active", "trialing", "past_due", "unpaid", "incomplete", "paused"]);
    if (subscriptionError) throw subscriptionError;
    if (subscriptions?.length) return json({ error: "Ya tienes una suscripción. Abre Gestionar suscripción para revisarla." }, 409);
    const priceId = plan === "monthly" ? MONTHLY_PRICE_ID : ANNUAL_PRICE_ID;
    const session = await stripe.checkout.sessions.create({
      mode: "subscription", line_items: [{ price: priceId, quantity: 1 }],
      client_reference_id: user.id, customer_email: user.email,
      metadata: { user_id: user.id, plan },
      // The single app trial is recorded in Supabase. Checkout never starts another trial.
      subscription_data: { metadata: { user_id: user.id, plan } },
      success_url: appBase + "?checkout=success", cancel_url: appBase + "?checkout=cancelled",
      billing_address_collection: "auto"
    }, { idempotencyKey: "fiexea-" + user.id + "-" + plan + "-" + Math.floor(Date.now() / 600000) });
    return json({ url: session.url });
  } catch (_) { return json({ error: "No se pudo iniciar el pago. Inténtalo de nuevo." }, 500); }
});

