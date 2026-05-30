import { Hono } from "hono";

type Bindings = Env & {
	STRIPE_SECRET_KEY?: string;
};

const app = new Hono<{ Bindings: Bindings }>();

const pricingTiers = {
	single: { label: "DataReady Starter File", cents: 500, min: 101, max: 1000 },
	large: { label: "DataReady Work File", cents: 1200, min: 1001, max: 10000 },
	batch: { label: "DataReady Batch File", cents: 1900, min: 10001, max: 50000 },
	enterprise: { label: "DataReady Human Review / Oversized File", cents: 4900, min: 50001, max: Number.POSITIVE_INFINITY },
};

app.get("/api/", (c) => c.json({ name: "DataReady API", checkout: "available when Stripe is configured" }));

app.post("/api/create-checkout-session", async (c) => {
	const stripeKey = c.env.STRIPE_SECRET_KEY;
	if (!stripeKey) {
		return c.json({ error: "Stripe checkout is not configured yet." }, 501);
	}

	const body = await c.req.json().catch(() => null) as {
		tierId?: keyof typeof pricingTiers;
		rowCount?: number;
		fileName?: string;
		successUrl?: string;
		cancelUrl?: string;
	} | null;

	const tierId = body?.tierId;
	const rowCount = Number(body?.rowCount || 0);
	if (!tierId || !(tierId in pricingTiers) || rowCount <= 100) {
		return c.json({ error: "This file does not need paid checkout." }, 400);
	}

	const tier = pricingTiers[tierId];
	if (rowCount < tier.min || rowCount > tier.max) {
		return c.json({ error: "The selected price tier does not match the file size." }, 400);
	}

	const origin = new URL(c.req.url).origin;
	const successUrl = withCheckoutSuccess(safeReturnUrl(body?.successUrl, origin));
	const cancelUrl = safeReturnUrl(body?.cancelUrl, origin);
	const fileName = String(body?.fileName || "Uploaded file").slice(0, 80);
	const params = new URLSearchParams({
		mode: "payment",
		success_url: successUrl,
		cancel_url: cancelUrl,
		"line_items[0][quantity]": "1",
		"line_items[0][price_data][currency]": "usd",
		"line_items[0][price_data][unit_amount]": String(tier.cents),
		"line_items[0][price_data][product_data][name]": tier.label,
		"line_items[0][price_data][product_data][description]": `${rowCount.toLocaleString()} cleaned rows for ${fileName}`,
		"metadata[row_count]": String(rowCount),
		"metadata[file_name]": fileName,
		"metadata[tier]": tierId,
	});

	const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
		method: "POST",
		headers: {
			Authorization: `Bearer ${stripeKey}`,
			"Content-Type": "application/x-www-form-urlencoded",
		},
		body: params,
	});

	const result = await response.json() as { id?: string; url?: string; error?: { message?: string } };
	if (!response.ok || !result.url) {
		return c.json({ error: result.error?.message || "Stripe could not create checkout." }, 502);
	}

	return c.json({ url: result.url, sessionId: result.id });
});

app.get("/api/verify-checkout-session", async (c) => {
	const sessionId = c.req.query("session_id");
	if (!sessionId || !sessionId.startsWith("cs_")) {
		return c.json({ error: "Missing checkout session." }, 400);
	}

	const stripeKey = c.env.STRIPE_SECRET_KEY;
	if (!stripeKey) {
		return c.json({ error: "Stripe checkout is not configured yet." }, 501);
	}

	const response = await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`, {
		headers: { Authorization: `Bearer ${stripeKey}` },
	});
	const result = await response.json() as { payment_status?: string; status?: string; amount_total?: number; metadata?: Record<string, string>; error?: { message?: string } };
	if (!response.ok) {
		return c.json({ error: result.error?.message || "Stripe could not verify checkout." }, 502);
	}

	return c.json({
		paid: result.payment_status === "paid",
		status: result.status,
		amountTotal: result.amount_total,
		rowCount: result.metadata?.row_count,
		tier: result.metadata?.tier,
	});
});

function safeReturnUrl(value: string | undefined, origin: string) {
	if (!value) return origin;
	try {
		const url = new URL(value);
		return url.origin === origin ? url.toString() : origin;
	} catch {
		return origin;
	}
}

function withCheckoutSuccess(value: string) {
	const url = new URL(value);
	url.searchParams.set("checkout", "success");
	url.searchParams.set("session_id", "{CHECKOUT_SESSION_ID}");
	return url.toString().replace("%7BCHECKOUT_SESSION_ID%7D", "{CHECKOUT_SESSION_ID}");
}

export default app;
