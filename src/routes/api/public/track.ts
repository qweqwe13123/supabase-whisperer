import { createFileRoute } from "@tanstack/react-router";

// Records a website visit + unique visitor + page view.
// Public endpoint — called from the browser on every page load.
export const Route = createFileRoute("/api/public/track")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = (await request.json().catch(() => ({}))) as {
            visitor_id?: string;
            path?: string;
            lang?: string;
            referrer?: string;
          };
          const visitorId = String(body.visitor_id ?? "").slice(0, 100);
          if (!visitorId) {
            return Response.json({ ok: false, error: "missing visitor_id" }, { status: 400 });
          }

          const path = body.path ? String(body.path).slice(0, 300) : null;
          const lang = body.lang ? String(body.lang).slice(0, 10) : null;
          const referrer = body.referrer ? String(body.referrer).slice(0, 500) : null;
          const headers = request.headers;
          const userAgent = (headers.get("user-agent") ?? "").slice(0, 500) || null;
          const country = headers.get("cf-ipcountry") ?? headers.get("x-vercel-ip-country") ?? null;
          const city =
            headers.get("cf-ipcity") ?? headers.get("x-vercel-ip-city")
              ? decodeURIComponent(
                  headers.get("cf-ipcity") ?? headers.get("x-vercel-ip-city") ?? "",
                )
              : null;

          // Derive traffic source from referrer
          let source: string | null = null;
          if (referrer) {
            try {
              const host = new URL(referrer).hostname.replace(/^www\./, "");
              if (/google\./.test(host)) source = "google";
              else if (/yandex\./.test(host)) source = "yandex";
              else if (/bing\./.test(host)) source = "bing";
              else if (/facebook\.|fb\.com|instagram\./.test(host)) source = "social";
              else if (/t\.me|telegram\./.test(host)) source = "telegram";
              else if (/youtube\./.test(host)) source = "youtube";
              else source = host;
            } catch {
              source = null;
            }
          } else {
            source = "direct";
          }

          const { getAdmin } = await import("@/lib/notifications.server");
          const admin = getAdmin();

          // Keep legacy raw visits log (used by existing weekly-report job)
          await admin.from("visits").insert({ visitor_id: visitorId, path, lang });

          // Upsert visitor — first_seen on insert, last_seen on update.
          await admin.from("visitors").upsert(
            {
              visitor_id: visitorId,
              last_seen_at: new Date().toISOString(),
              country,
              city,
              source,
              referrer,
              user_agent: userAgent,
              lang,
            },
            { onConflict: "visitor_id" },
          );

          // Page view
          if (path) {
            await admin.from("page_views").insert({
              visitor_id: visitorId,
              path,
              referrer,
              source,
              country,
              city,
              user_agent: userAgent,
              lang,
            });
          }

          return Response.json({ ok: true });
        } catch (err) {
          console.error("track error", err);
          return Response.json({ ok: false }, { status: 500 });
        }
      },
    },
  },
});
