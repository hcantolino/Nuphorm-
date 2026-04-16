import { ENV } from "./env";

export type Role = "system" | "user" | "assistant" | "tool" | "function";

export type TextContent = {
  type: "text";
  text: string;
};

export type ImageContent = {
  type: "image_url";
  image_url: {
    url: string;
    detail?: "auto" | "low" | "high";
  };
};

export type FileContent = {
  type: "file_url";
  file_url: {
    url: string;
    mime_type?: "audio/mpeg" | "audio/wav" | "application/pdf" | "audio/mp4" | "video/mp4";
  };
};

export type MessageContent = string | TextContent | ImageContent | FileContent;

export type Message = {
  role: Role;
  content: MessageContent | MessageContent[];
  name?: string;
  tool_call_id?: string;
  tool_calls?: ToolCall[];
};

export type Tool = {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
  };
};

export type ToolChoicePrimitive = "none" | "auto" | "required";
export type ToolChoiceByName = { name: string };
export type ToolChoiceExplicit = {
  type: "function";
  function: {
    name: string;
  };
};

export type ToolChoice =
  | ToolChoicePrimitive
  | ToolChoiceByName
  | ToolChoiceExplicit;

export type InvokeParams = {
  messages: Message[];
  tools?: Tool[];
  toolChoice?: ToolChoice;
  tool_choice?: ToolChoice;
  maxTokens?: number;
  max_tokens?: number;
  outputSchema?: OutputSchema;
  output_schema?: OutputSchema;
  responseFormat?: ResponseFormat;
  response_format?: ResponseFormat;
  temperature?: number;
};

export type ToolCall = {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
};

export type InvokeResult = {
  id: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: Role;
      content: string | Array<TextContent | ImageContent | FileContent>;
      tool_calls?: ToolCall[];
    };
    finish_reason: string | null;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
};

export type JsonSchema = {
  name: string;
  schema: Record<string, unknown>;
  strict?: boolean;
};

export type OutputSchema = JsonSchema;

export type ResponseFormat =
  | { type: "text" }
  | { type: "json_object" }
  | { type: "json_schema"; json_schema: JsonSchema };

// ─── Helpers (OpenAI-compatible path) ─────────────────────────────────────────

const ensureArray = (
  value: MessageContent | MessageContent[]
): MessageContent[] => (Array.isArray(value) ? value : [value]);

const normalizeContentPart = (
  part: MessageContent
): TextContent | ImageContent | FileContent => {
  if (typeof part === "string") return { type: "text", text: part };
  if (part.type === "text") return part;
  if (part.type === "image_url") return part;
  if (part.type === "file_url") return part;
  throw new Error("Unsupported message content part");
};

const normalizeMessage = (message: Message) => {
  const { role, name, tool_call_id } = message;

  if (role === "tool" || role === "function") {
    const content = ensureArray(message.content)
      .map(part => (typeof part === "string" ? part : JSON.stringify(part)))
      .join("\n");
    return { role, name, tool_call_id, content };
  }

  const contentParts = ensureArray(message.content).map(normalizeContentPart);

  if (contentParts.length === 1 && contentParts[0].type === "text") {
    return { role, name, content: contentParts[0].text };
  }

  return { role, name, content: contentParts };
};

const normalizeToolChoice = (
  toolChoice: ToolChoice | undefined,
  tools: Tool[] | undefined
): "none" | "auto" | ToolChoiceExplicit | undefined => {
  if (!toolChoice) return undefined;
  if (toolChoice === "none" || toolChoice === "auto") return toolChoice;

  if (toolChoice === "required") {
    if (!tools || tools.length === 0)
      throw new Error("tool_choice 'required' was provided but no tools were configured");
    if (tools.length > 1)
      throw new Error("tool_choice 'required' needs a single tool or specify the tool name explicitly");
    return { type: "function", function: { name: tools[0].function.name } };
  }

  if ("name" in toolChoice) {
    return { type: "function", function: { name: toolChoice.name } };
  }

  return toolChoice;
};

const normalizeResponseFormat = ({
  responseFormat,
  response_format,
  outputSchema,
  output_schema,
}: {
  responseFormat?: ResponseFormat;
  response_format?: ResponseFormat;
  outputSchema?: OutputSchema;
  output_schema?: OutputSchema;
}):
  | { type: "json_schema"; json_schema: JsonSchema }
  | { type: "text" }
  | { type: "json_object" }
  | undefined => {
  const explicitFormat = responseFormat || response_format;
  if (explicitFormat) {
    if (
      explicitFormat.type === "json_schema" &&
      !explicitFormat.json_schema?.schema
    )
      throw new Error("responseFormat json_schema requires a defined schema object");
    return explicitFormat;
  }

  const schema = outputSchema || output_schema;
  if (!schema) return undefined;
  if (!schema.name || !schema.schema)
    throw new Error("outputSchema requires both name and schema");

  return {
    type: "json_schema",
    json_schema: {
      name: schema.name,
      schema: schema.schema,
      ...(typeof schema.strict === "boolean" ? { strict: schema.strict } : {}),
    },
  };
};

// ─── Routing helpers ───────────────────────────────────────────────────────────

/** True when only ANTHROPIC_API_KEY is set (no Forge or OpenAI key). */
const isAnthropicMode = (): boolean =>
  !!process.env.ANTHROPIC_API_KEY &&
  !process.env.BUILT_IN_FORGE_API_KEY &&
  !process.env.OPENAI_API_KEY;

const resolveApiUrl = () => {
  if (ENV.forgeApiUrl && ENV.forgeApiUrl.trim().length > 0) {
    return `${ENV.forgeApiUrl.replace(/\/$/, "")}/v1/chat/completions`;
  }
  if (process.env.OPENAI_API_KEY && !process.env.BUILT_IN_FORGE_API_KEY) {
    return "https://api.openai.com/v1/chat/completions";
  }
  return "https://forge.manus.im/v1/chat/completions";
};

const assertApiKey = () => {
  const hasKey =
    !!process.env.ANTHROPIC_API_KEY ||
    !!process.env.OPENAI_API_KEY ||
    !!ENV.forgeApiKey;
  if (!hasKey) {
    throw new Error(
      "No LLM API key configured. Set ANTHROPIC_API_KEY (recommended), OPENAI_API_KEY, or BUILT_IN_FORGE_API_KEY in .env"
    );
  }
};

// ─── Anthropic Messages API ────────────────────────────────────────────────────

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";

/** Extract plain text from a MessageContent or array. */
function extractText(content: MessageContent | MessageContent[]): string {
  const parts = Array.isArray(content) ? content : [content];
  return parts
    .map(p => (typeof p === "string" ? p : p.type === "text" ? p.text : ""))
    .join("");
}

/**
 * Convert OpenAI-format messages → Anthropic format.
 *   - system role  →  pulled out into top-level `system` string
 *   - tool role    →  wrapped as tool_result inside a user message
 *   - assistant with tool_calls → content array with tool_use blocks
 */
function toAnthropicMessages(messages: Message[]): {
  system: string | undefined;
  messages: Array<{ role: "user" | "assistant"; content: any }>;
} {
  let system: string | undefined;
  const out: Array<{ role: "user" | "assistant"; content: any }> = [];

  for (const msg of messages) {
    if (msg.role === "system") {
      const text = extractText(msg.content);
      system = system ? `${system}\n${text}` : text;
      continue;
    }

    if (msg.role === "tool" || msg.role === "function") {
      out.push({
        role: "user",
        content: [
          {
            type: "tool_result",
            tool_use_id: msg.tool_call_id ?? "",
            content: extractText(msg.content),
          },
        ],
      });
      continue;
    }

    if (msg.role === "assistant" && msg.tool_calls && msg.tool_calls.length > 0) {
      const blocks: any[] = [];
      const textPart = extractText(msg.content);
      if (textPart) blocks.push({ type: "text", text: textPart });
      for (const tc of msg.tool_calls) {
        blocks.push({
          type: "tool_use",
          id: tc.id,
          name: tc.function.name,
          input: (() => {
            try { return JSON.parse(tc.function.arguments || "{}"); }
            catch { return {}; }
          })(),
        });
      }
      out.push({ role: "assistant", content: blocks });
      continue;
    }

    out.push({
      role: msg.role as "user" | "assistant",
      content: extractText(msg.content),
    });
  }

  return { system, messages: out };
}

function toAnthropicTools(tools: Tool[]) {
  return tools.map(t => ({
    name: t.function.name,
    description: t.function.description ?? "",
    input_schema: t.function.parameters ?? { type: "object", properties: {} },
  }));
}

function toAnthropicToolChoice(
  toolChoice: ToolChoice | undefined
): Record<string, unknown> | undefined {
  if (!toolChoice || toolChoice === "auto") return { type: "auto" };
  if (toolChoice === "none") return undefined; // Anthropic has no "none" — omit the field
  if (toolChoice === "required") return { type: "any" };
  if ("name" in toolChoice) return { type: "tool", name: toolChoice.name };
  if (
    typeof toolChoice === "object" &&
    "type" in toolChoice &&
    toolChoice.type === "function"
  ) {
    return { type: "tool", name: (toolChoice as ToolChoiceExplicit).function.name };
  }
  return { type: "auto" };
}

/** Convert Anthropic response → InvokeResult (OpenAI-compatible shape). */
function fromAnthropicResponse(raw: any): InvokeResult {
  const blocks: any[] = raw.content ?? [];
  let textContent = "";
  const toolCalls: ToolCall[] = [];

  for (const block of blocks) {
    if (block.type === "text") {
      textContent += block.text;
    } else if (block.type === "tool_use") {
      toolCalls.push({
        id: block.id,
        type: "function",
        function: {
          name: block.name,
          arguments: JSON.stringify(block.input ?? {}),
        },
      });
    }
  }

  const message: InvokeResult["choices"][0]["message"] = {
    role: "assistant",
    content: textContent,
  };
  if (toolCalls.length > 0) message.tool_calls = toolCalls;

  const finishReason =
    raw.stop_reason === "end_turn"
      ? "stop"
      : raw.stop_reason === "tool_use"
      ? "tool_calls"
      : raw.stop_reason ?? null;

  return {
    id: raw.id ?? `anthropic-${Date.now()}`,
    created: Math.floor(Date.now() / 1000),
    model: raw.model ?? (process.env.ANTHROPIC_MODEL ?? "claude-opus-4-6"),
    choices: [{ index: 0, message, finish_reason: finishReason }],
    usage: {
      prompt_tokens: raw.usage?.input_tokens ?? 0,
      completion_tokens: raw.usage?.output_tokens ?? 0,
      total_tokens:
        (raw.usage?.input_tokens ?? 0) + (raw.usage?.output_tokens ?? 0),
    },
  };
}

async function invokeAnthropicLLM(params: InvokeParams): Promise<InvokeResult> {
  const { messages, tools, toolChoice, tool_choice, maxTokens, max_tokens, temperature } = params;

  const { system, messages: anthropicMessages } = toAnthropicMessages(messages);

  const payload: Record<string, unknown> = {
    model: process.env.ANTHROPIC_MODEL ?? "claude-opus-4-6",
    max_tokens: maxTokens ?? max_tokens ?? 16000,
    messages: anthropicMessages,
    temperature: 0,       // Hard-coded to 0 — no hallucination, maximum determinism
  };

  if (system) payload.system = system;
  // Allow caller to override temperature only if explicitly set (default stays 0)
  if (typeof temperature === "number") payload.temperature = temperature;

  if (tools && tools.length > 0) {
    payload.tools = toAnthropicTools(tools);
    const tc = toAnthropicToolChoice(toolChoice ?? tool_choice);
    if (tc) payload.tool_choice = tc;
  }

  // 120-second timeout — biostatistics prompts can include large datasets
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 120_000);

  let response: Response;
  try {
    response = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY!,
        "anthropic-version": ANTHROPIC_VERSION,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } catch (fetchErr: any) {
    if (fetchErr?.name === "AbortError") {
      throw new Error("Anthropic API call timed out after 120 seconds");
    }
    throw fetchErr;
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Anthropic API call failed: ${response.status} ${response.statusText} – ${errorText}`
    );
  }

  return fromAnthropicResponse(await response.json());
}

// ─── OpenAI-compatible path ────────────────────────────────────────────────────

async function invokeOpenAICompatibleLLM(params: InvokeParams): Promise<InvokeResult> {
  const {
    messages,
    tools,
    toolChoice,
    tool_choice,
    outputSchema,
    output_schema,
    responseFormat,
    response_format,
    temperature,
  } = params;

  const resolvedUrl = resolveApiUrl();
  const model =
    process.env.OPENAI_API_KEY &&
    !process.env.BUILT_IN_FORGE_API_KEY &&
    resolvedUrl.includes("openai.com")
      ? (process.env.OPENAI_MODEL ?? "gpt-4o-mini")
      : "gemini-2.5-flash";

  const payload: Record<string, unknown> = {
    model,
    messages: messages.map(normalizeMessage),
  };

  if (typeof temperature === "number") payload.temperature = temperature;

  if (tools && tools.length > 0) payload.tools = tools;

  const normalizedToolChoice = normalizeToolChoice(toolChoice || tool_choice, tools);
  if (normalizedToolChoice) payload.tool_choice = normalizedToolChoice;

  payload.max_tokens = 8192;
  // Only add Gemini-specific thinking budget when routing to a Gemini model via Forge.
  // Omitting it for plain OpenAI-compatible providers avoids 400 errors on unknown fields.
  if (!resolvedUrl.includes("openai.com") && model.startsWith("gemini")) {
    payload.thinking = { budget_tokens: 512 };
  }

  const normalizedResponseFormat = normalizeResponseFormat({
    responseFormat,
    response_format,
    outputSchema,
    output_schema,
  });
  if (normalizedResponseFormat) payload.response_format = normalizedResponseFormat;

  const response = await fetch(resolvedUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${ENV.forgeApiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `LLM invoke failed: ${response.status} ${response.statusText} – ${errorText}`
    );
  }

  return (await response.json()) as InvokeResult;
}

// ─── Public entry point ────────────────────────────────────────────────────────

export async function invokeLLM(params: InvokeParams): Promise<InvokeResult> {
  assertApiKey();
  return isAnthropicMode()
    ? invokeAnthropicLLM(params)
    : invokeOpenAICompatibleLLM(params);
}
