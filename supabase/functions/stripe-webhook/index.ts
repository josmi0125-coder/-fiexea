import Stripe from "npm:stripe@22.0.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!);
const cryptoProvider = Stripe.createSubtleCryptoProvider();
const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false, autoRefreshToken: false } });
const iso = (value: unknown) => typeof value === "number" && Number.isFinite(value) ? new Date(value * 1000).toISOString() : null;
Deno.serve(async req => {
  if (req.method !== "POST") return new Response("Método no permitido", { status: 405 });
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(await req.text(), req.headers.get("stripe-signature") || "", Deno.env.get("STRIPE_WEBHOOK_SIGNING_SECRET")!, undefined, cryptoProvider);
  } catch (_) { return new Response("Firma no válida", { status: 400 }); }
  const supported = ["checkout.session.completed", "customer.subscription.created", "customer.subscription.updated", "customer.subscription.deleted", "invoice.paid", "invoice.payment_failed"];
  if (!supported.includes(event.type)) return Response.json({ received: true });
  try {
    const object = event.data.object as any;
    let id: string | null = null;
    if (event.type.startsWith("customer.subscription.")) id = object.id;
    else {
      const reference = object.subscription || object.parent?.subscription_details?.subscription;
      id = typeof reference === "string" ? reference : reference?.id || null;
    }
    if (!id) return Response.json({ received: true });
    // Retrieve the current Stripe state rather than replaying an old event's status.
    const subscription = await stripe.subscriptions.retrieve(id);
    const item = subscription.items.data[0];
    let userId = subscription.metadata?.user_id || (event.type === "checkout.session.completed" ? object.metadata?.user_id || object.client_reference_id : null);
    if (!userId) {
      const { data, error } = await admin.from("subscriptions").select("user_id").eq("stripe_subscription_id", id).maybeSingle();
      if (error) throw error;
      userId = data?.user_id;
    }
    if (!userId) return Response.json({ received: true });
    const { error } = await admin.from("subscriptions").upsert({
      user_id: userId,
      stripe_customer_id: typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id,
      stripe_subscription_id: subscription.id,
      stripe_price_id: item?.price?.id || null,
      status: subscription.status,
      livemode: subscription.livemode,
      trial_ends_at: iso(subscription.trial_end),
      current_period_end: iso(item?.current_period_end),
      cancel_at_period_end: subscription.cancel_at_period_end,
      updated_at: new Date().toISOString()
    }, { onConflict: "stripe_subscription_id" });
    if (error) throw error;
    return Response.json({ received: true });
  } catch (_) { return new Response("No se pudo sincronizar la suscripción", { status: 500 }); }
});
