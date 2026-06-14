import { createFileRoute } from "@tanstack/react-router";

// Stores a submitted application form and sends a Telegram notification.
export const Route = createFileRoute("/api/public/lead")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const data = (await request.json().catch(() => ({}))) as Record<string, unknown>;
          // Plain JSON-safe clone for the jsonb column.
          const detailsJson = JSON.parse(JSON.stringify(data));
          const { getAdmin, sendTelegramMessage, formatLeadMessage } = await import(
            "@/lib/notifications.server"
          );

          await getAdmin().from("leads").insert({
            name: data.name ? String(data.name).slice(0, 200) : null,
            email: data.email ? String(data.email).slice(0, 200) : null,
            phone: data.phone ? String(data.phone).slice(0, 50) : null,
            plan: data.plan ? String(data.plan).slice(0, 20) : null,
            lang: data.lang ? String(data.lang).slice(0, 30) : null,
            details: detailsJson,
          });

          await sendTelegramMessage(formatLeadMessage(data));
          return Response.json({ ok: true });
        } catch (err) {
          console.error("lead error", err);
          return Response.json({ ok: false }, { status: 500 });
        }
      },
    },
  },
});