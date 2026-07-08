import { slackifyMarkdown } from "slackify-markdown";
import { db } from "./db";

export interface SlackConfig {
  enabled: boolean;
  auto_notify: boolean;
  channel: string;
}

// Our fields are authored as CommonMark (react-markdown in the app UI), but Slack's
// "mrkdwn" is a different, non-standard syntax (single-asterisk bold, no headings, etc.).
// Converting via slackify-markdown also protects plain text from Slack's naive
// mrkdwn parser (e.g. "user_id_migration" would otherwise italicize "id").
function toSlackText(markdown: string): string {
  return slackifyMarkdown(markdown).trim();
}

// Renders as bold in Slack even for plain (non-markdown) text, by bolding the
// CommonMark source before conversion instead of wrapping the already-converted output
// (which would nest asterisks and break Slack's parser if the source has its own formatting).
function toSlackBoldText(markdown: string): string {
  return toSlackText(`**${markdown}**`);
}

export async function getSlackConfigFromDb(): Promise<SlackConfig> {
  const rows = await db<{ key: string; value: string | null }[]>`
    SELECT key, value FROM platform_settings
    WHERE key IN ('slack_enabled', 'slack_auto_notify', 'slack_channel')
  `;
  const map: Record<string, string | null> = {};
  for (const r of rows) map[r.key] = r.value;
  return {
    enabled:      map["slack_enabled"]     === "true",
    auto_notify:  map["slack_auto_notify"] === "true",
    channel:      map["slack_channel"]     ?? "",
  };
}

const PRIORITY_LABELS: Record<string, string> = {
  urgent: "Urgente 🔴",
  high:   "Alta 🟠",
  medium: "Media 🟡",
  low:    "Baja 🟢",
};

export async function postSlackMessage(
  requestId: string,
  channelOverride?: string,
  deliverableIds?: string[],
): Promise<void> {
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) throw new Error("SLACK_BOT_TOKEN no está configurado en el servidor");

  const config = await getSlackConfigFromDb();
  const channel = channelOverride || config.channel;
  if (!channel) throw new Error("No hay canal de Slack configurado. Configúralo en Ajustes → Slack.");

  const rows = await db<{
    title: string;
    priority: string;
    completed_at: string | null;
    assigned_name: string | null;
    area_name: string | null;
  }[]>`
    SELECT
      r.title,
      r.priority,
      r.completed_at,
      p.full_name AS assigned_name,
      a.name      AS area_name
    FROM requests r
    LEFT JOIN profiles p ON p.id = r.assigned_to
    LEFT JOIN areas    a ON a.id = r.area_id
    WHERE r.id = ${requestId}
  `;
  const req = rows[0];
  if (!req) throw new Error("Solicitud no encontrada");

  const completedDate = req.completed_at
    ? new Date(req.completed_at).toLocaleDateString("es", {
        day: "2-digit", month: "2-digit", year: "numeric",
        hour: "2-digit", minute: "2-digit",
      })
    : new Date().toLocaleDateString("es", { day: "2-digit", month: "2-digit", year: "numeric" });

  const fields: { type: string; text: string }[] = [
    { type: "mrkdwn", text: `*👤 Responsable*\n${req.assigned_name ?? "Sin asignar"}` },
    { type: "mrkdwn", text: `*📅 Completado*\n${completedDate}` },
    { type: "mrkdwn", text: `*⚡ Prioridad*\n${PRIORITY_LABELS[req.priority] ?? req.priority}` },
  ];
  if (req.area_name) {
    fields.push({ type: "mrkdwn", text: `*🏢 Área*\n${req.area_name}` });
  }

  const blocks: object[] = [
    {
      type: "header",
      text: { type: "plain_text", text: "✅  Solicitud completada", emoji: true },
    },
    {
      type: "section",
      text: { type: "mrkdwn", text: toSlackBoldText(req.title) },
    },
    { type: "section", fields },
    { type: "divider" },
  ];

  // Deliverables section
  if (deliverableIds && deliverableIds.length > 0) {
    const deliverables = await db<{ title: string; notes: string | null }[]>`
      SELECT title, notes FROM request_deliverables
      WHERE id = ANY(${deliverableIds})
      ORDER BY created_at
    `;
    if (deliverables.length > 0) {
      const lines = deliverables
        .map((d) => `• ${toSlackBoldText(d.title)}${d.notes ? `\n  ${toSlackText(d.notes)}` : ""}`)
        .join("\n");
      blocks.push({
        type: "section",
        text: { type: "mrkdwn", text: `*📦 Entregables incluidos*\n${lines}` },
      });
      blocks.push({ type: "divider" });
    }
  }

  const response = await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      channel,
      text: `✅ Solicitud completada: ${req.title}`,
      blocks,
    }),
  });

  const result = (await response.json()) as { ok: boolean; error?: string };
  if (!result.ok) throw new Error(`Error de Slack: ${result.error ?? "unknown"}`);
}

export async function postSlackTestMessage(channel: string): Promise<void> {
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) throw new Error("SLACK_BOT_TOKEN no está configurado en el servidor");
  if (!channel) throw new Error("Introduce un ID de canal antes de probar");

  const response = await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      channel,
      text: "✅ Conexión con SmartPath Planner verificada correctamente.",
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: "✅ *Conexión verificada*\nSmartPath Planner puede enviar notificaciones a este canal.",
          },
        },
      ],
    }),
  });

  const result = (await response.json()) as { ok: boolean; error?: string };
  if (!result.ok) throw new Error(`Error de Slack: ${result.error ?? "unknown"}`);
}
