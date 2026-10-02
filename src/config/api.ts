// src/config/api.ts
// Appels API vers le serveur MonApp (Railway)

export const API_URL = 'https://monapp-server-production.up.railway.app';

const DEFAULT_TIMEOUT_MS = 60000;

/**
 * Wrapper fetch avec timeout automatique.
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    console.warn(`[API] Timeout après ${timeoutMs}ms pour ${url}`);
    controller.abort();
  }, timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } catch (error: any) {
    if (error.name === 'AbortError') {
      throw new Error(
        `Le serveur met trop de temps à répondre (plus de ${timeoutMs / 1000} secondes). Réessaie dans un instant.`
      );
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

export type ToolCall = {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
};

export type AgentReply = {
  reply: string;
  toolCalls?: ToolCall[];
};

export type MessageContent =
  | string
  | (
      | { type: 'text'; text: string }
      | { type: 'image_url'; image_url: { url: string } }
    )[];

export type ApiMessage = {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: MessageContent;
  tool_call_id?: string;
  tool_calls?: any[];
  name?: string;
};

/**
 * Envoie un message à un agent via le serveur.
 */
export async function sendMessageToAgent({
  messages,
  agentSystemPrompt,
  enableTools = false,
  agentId,
}: {
  messages: ApiMessage[];
  agentSystemPrompt?: string;
  enableTools?: boolean;
  agentId?: string;
}): Promise<AgentReply> {
  const response = await fetchWithTimeout(`${API_URL}/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messages,
      agentSystemPrompt,
      enableTools,
      agentId,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Erreur serveur : ${response.status} - ${errorText}`);
  }

  const data = await response.json();

  return {
    reply: data.reply || '',
    toolCalls: data.toolCalls,
  };
}

/**
 * 🆕 Envoie le résultat d'un tool call à Prof (2ème appel).
 * Respecte le format OpenAI/DeepSeek :
 *   [user] → [assistant with tool_calls] → [tool with result]
 */
export async function sendToolResultToAgent({
  messages,
  toolCall,
  toolResult,
  agentSystemPrompt,
  agentId,
}: {
  messages: ApiMessage[];
  toolCall: ToolCall;
  toolResult: string;
  agentSystemPrompt?: string;
  agentId?: string;
}): Promise<AgentReply> {
  // Construire le message assistant avec le tool_call
  const assistantMessage: ApiMessage = {
    role: 'assistant',
    content: '',
    tool_calls: [
      {
        id: toolCall.id,
        type: 'function',
        function: {
          name: toolCall.name,
          arguments: JSON.stringify(toolCall.arguments || {}),
        },
      },
    ],
  };

  // Construire le message tool avec le résultat
  const toolMessage: ApiMessage = {
    role: 'tool',
    content: toolResult,
    tool_call_id: toolCall.id,
  };

  const fullMessages = [...messages, assistantMessage, toolMessage];

  console.log('[API] Envoi avec tool result:', {
    toolName: toolCall.name,
    toolId: toolCall.id,
    resultLength: toolResult.length,
  });

  const response = await fetchWithTimeout(`${API_URL}/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messages: fullMessages,
      agentSystemPrompt,
      enableTools: false, // Désactiver les tools pour forcer une réponse en texte
      agentId,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.warn('[API] Erreur tool result:', response.status, errorText);
    throw new Error(`Erreur serveur : ${response.status} - ${errorText}`);
  }

  const data = await response.json();

  return {
    reply: data.reply || '',
    toolCalls: data.toolCalls,
  };
}

/**
 * Extrait le texte d'un PDF via le serveur.
 */
export async function extractPdfText(base64Data: string): Promise<{
  success: boolean;
  text?: string;
  pages?: number;
  error?: string;
}> {
  try {
    const response = await fetchWithTimeout(
      `${API_URL}/extract-pdf`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileData: base64Data }),
      },
      30000
    );

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      return { success: false, error: data.error || 'Erreur extraction PDF' };
    }

    const data = await response.json();
    return {
      success: true,
      text: data.text || '',
      pages: data.pages || 0,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erreur réseau',
    };
  }
}