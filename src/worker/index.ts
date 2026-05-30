import { Hono } from "hono";

type Bindings = Env & {
	STRIPE_SECRET_KEY?: string;
};

const app = new Hono<{ Bindings: Bindings }>();

const pricingTiers = {
	single: { label: "DataReady Single File", cents: 300, min: 101, max: 2500 },
	large: { label: "DataReady Large File", cents: 700, min: 2501, max: 15000 },
	batch: { label: "DataReady Batch File", cents: 1200, min: 15001, max: 50000 },
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
	const successUrl = safeReturnUrl(body?.successUrl, origin);
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

	const result = await response.json() as { url?: string; error?: { message?: string } };
	if (!response.ok || !result.url) {
		return c.json({ error: result.error?.message || "Stripe could not create checkout." }, 502);
	}

	return c.json({ url: result.url });
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

export default app;
