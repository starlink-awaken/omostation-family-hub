export function authenticateCron(request: Request): { ok: boolean; error?: string } {
	const url = new URL(request.url);
	const token = url.searchParams.get("cron_token");

	if (!token || token !== process.env.FAMILY_CRON_TOKEN) {
		return { ok: false, error: "unauthorized" };
	}

	return { ok: true };
}
