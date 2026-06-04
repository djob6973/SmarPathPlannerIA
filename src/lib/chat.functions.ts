import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";

const inputSchema = z.object({
  conversationId: z.string().uuid().optional(),
  message: z.string().min(1).max(4000),
  selectedAreaId: z.string().uuid().nullable().optional(),
});

interface ToolCallCreateRequest {
  title: string;
  description: string;
  objective?: string;
  process?: string;
  priority?: "low" | "medium" | "high" | "urgent";
}

function getSupabaseClient(token: string) {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) return null;
  return createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
}

async function getAuthContext() {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;

  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    return { error: "Supabase no está configurado. Agrega SUPABASE_URL y SUPABASE_PUBLISHABLE_KEY en .env" };
  }

  const request = getRequest();
  const authHeader = request?.headers?.get("authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return { error: "No autorizado: sesión no iniciada" };
  }

  const token = authHeader.replace("Bearer ", "");
  const supabase = getSupabaseClient(token)!;

  try {
    const { data, error } = await supabase.auth.getClaims(token);
    if (error || !data?.claims?.sub) {
      return { error: "No autorizado: token inválido" };
    }
    return { supabase, userId: data.claims.sub as string };
  } catch (e: any) {
    console.error("[Auth] getClaims failed:", e?.message ?? e);
    return { error: "No autorizado: error verificando sesión" };
  }
}

export const sendChatMessage = createServerFn({ method: "POST" })
  .inputValidator((input) => inputSchema.parse(input))
  .handler(async ({ data }) => {
    try {
      const auth = await getAuthContext();
      if ("error" in auth) return auth;
      const { supabase, userId } = auth;

      // Get user's area_id from profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("area_id")
        .eq("id", userId)
        .single();

      const userAreaId = profile?.area_id ?? null;
      // Use selected area if provided, otherwise use user's area
      const effectiveAreaId = data.selectedAreaId ?? userAreaId;

      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        return {
          error: "OPENAI_API_KEY no está configurada. Agrégala en .env para activar el chat.",
        };
      }

      // get or create conversation
      let convId = data.conversationId;
      if (!convId) {
        const { data: conv, error } = await supabase
          .from("chat_conversations")
          .insert({ user_id: userId, title: data.message.slice(0, 60) })
          .select("id")
          .single();
        if (error || !conv) return { error: error?.message ?? "No se pudo crear la conversación" };
        convId = conv.id;
      }

      // load AI settings
      const { data: settings } = await supabase
        .from("ai_settings")
        .select("system_prompt, intake_questions, model")
        .eq("is_active", true)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const systemPrompt =
        (settings?.system_prompt ?? "Eres un asistente útil.") +
        (Array.isArray(settings?.intake_questions) && settings.intake_questions.length
          ? "\n\nPreguntas guía sugeridas:\n- " + (settings.intake_questions as string[]).join("\n- ")
          : "");

      // save user message
      await supabase.from("chat_messages").insert({
        conversation_id: convId,
        role: "user",
        content: data.message,
      });

      // load history
      const { data: history } = await supabase
        .from("chat_messages")
        .select("role, content")
        .eq("conversation_id", convId)
        .order("created_at", { ascending: true })
        .limit(50);

      const messages: Array<{ role: string; content: string; tool_call_id?: string; name?: string }> = [
        { role: "system", content: systemPrompt },
        ...(history ?? []).map((m) => ({ role: m.role, content: m.content })),
      ];

      const tools = [
        {
          type: "function",
          function: {
            name: "create_request",
            description:
              "Crea una nueva solicitud de proyecto en el roadmap cuando hayas recopilado información suficiente (al menos título, objetivo y descripción).",
            parameters: {
              type: "object",
              properties: {
                title: { type: "string", description: "Título conciso del proyecto" },
                description: { type: "string", description: "Descripción detallada" },
                objective: { type: "string", description: "Objetivo principal" },
                process: { type: "string", description: "Pasos/procesos involucrados" },
                priority: { type: "string", enum: ["low", "medium", "high", "urgent"] },
              },
              required: ["title", "description"],
            },
          },
        },
      ];

      let createdRequestId: string | null = null;
      let assistantContent = "";

      for (let i = 0; i < 3; i++) {
        const res = await fetch(OPENAI_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: settings?.model ?? "gpt-4o-mini",
            messages,
            tools,
            tool_choice: "auto",
          }),
        });

        if (!res.ok) {
          const t = await res.text();
          return { error: `OpenAI error ${res.status}: ${t.slice(0, 300)}`, conversationId: convId };
        }

        const json = (await res.json()) as any;
        const choice = json.choices?.[0]?.message;
        if (!choice) break;

        messages.push(choice);

        const toolCalls = choice.tool_calls as Array<any> | undefined;
        if (!toolCalls || toolCalls.length === 0) {
          assistantContent = choice.content ?? "";
          break;
        }

        for (const tc of toolCalls) {
          if (tc.function?.name === "create_request") {
            try {
              const args: ToolCallCreateRequest = JSON.parse(tc.function.arguments ?? "{}");
              const { data: firstCol } = await supabase
                .from("kanban_columns")
                .select("id")
                .order("position", { ascending: true })
                .limit(1)
                .maybeSingle();

              const { data: req, error: reqErr } = await supabase
                .from("requests")
                .insert({
                  title: args.title,
                  description: args.description,
                  objective: args.objective ?? null,
                  process: args.process ?? null,
                  priority: args.priority ?? "medium",
                  created_by: userId,
                  status_column_id: firstCol?.id ?? null,
                  area_id: effectiveAreaId,
                })
                .select("id")
                .single();

              if (reqErr) {
                messages.push({
                  role: "tool",
                  tool_call_id: tc.id,
                  content: JSON.stringify({ error: reqErr.message }),
                });
              } else {
                createdRequestId = req.id;
                await supabase
                  .from("chat_conversations")
                  .update({ request_id: req.id, title: args.title.slice(0, 60) })
                  .eq("id", convId);
                messages.push({
                  role: "tool",
                  tool_call_id: tc.id,
                  content: JSON.stringify({ success: true, request_id: req.id, title: args.title }),
                });
              }
            } catch (e: any) {
              messages.push({
                role: "tool",
                tool_call_id: tc.id,
                content: JSON.stringify({ error: e?.message ?? "Invalid args" }),
              });
            }
          }
        }
      }

      if (!assistantContent) {
        assistantContent = createdRequestId
          ? "He registrado tu solicitud en el roadmap. ¿Algo más que quieras añadir?"
          : "¿Puedes darme más detalles?";
      }

      await supabase.from("chat_messages").insert({
        conversation_id: convId,
        role: "assistant",
        content: assistantContent,
      });

      return {
        conversationId: convId,
        assistant: assistantContent,
        createdRequestId,
      };
    } catch (e: any) {
      console.error("[sendChatMessage] Unexpected error:", e);
      return { error: e?.message ?? "Error inesperado en el servidor" };
    }
  });

export const getConversation = createServerFn({ method: "GET" })
  .inputValidator((input: { conversationId: string }) => input)
  .handler(async ({ data }) => {
    try {
      const auth = await getAuthContext();
      if ("error" in auth) return { messages: [] };
      const { supabase } = auth;
      const { data: messages } = await supabase
        .from("chat_messages")
        .select("id, role, content, created_at")
        .eq("conversation_id", data.conversationId)
        .order("created_at", { ascending: true });
      return { messages: messages ?? [] };
    } catch {
      return { messages: [] };
    }
  });
