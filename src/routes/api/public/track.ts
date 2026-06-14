import { createFileRoute } from "@tanstack/react-router";

// Records a website visit. Public endpoint — called from the browser on page load.
export const Route = createFileRoute("/api/public/track")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = (await request.json().catch(() => ({}))) as {
            visitor_id?: string;
            path?: string;
            lang?: string;
          };
          const visitorId = String(body.visitor_id ?? "").slice(0, 100);
          if (!visitorId) {
            return Response.json({ ok: false, error: "missing visitor_id" }, { status: 400 });
          }
          const { getAdmin } = await import("@/lib/notifications.server");
          await getAdmin().from("visits").insert({
            visitor_id: visitorId,
            path: body.path ? String(body.path).slice(0, 300) : null,
            lang: body.lang ? String(body.lang).slice(0, 10) : null,
          });
          return Response.json({ ok: true });
        } catch (err) {
          console.error("track error", err);
          return Response.json({ ok: false }, { status: 500 });
        }
      },
    },
  },
});