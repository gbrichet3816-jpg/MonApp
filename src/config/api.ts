// src/config/api.ts
// Appels API vers le serveur MonApp (Railway)

export const API_URL = 'https://monapp-server-production.up.railway.app';

const DEFAULT_TIMEOUT_MS = 60000;

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
  return sendToolResultsToAgent({
    messages,
    toolCalls: [toolCall],
    toolResults: [toolResult],
    agentSystemPrompt,
    agentId,
  });
}

export async function sendToolResultsToAgent({
  messages,
  toolCalls,
  toolResults,
  agentSystemPrompt,
  agentId,
}: {
  messages: ApiMessage[];
  toolCalls: ToolCall[];
  toolResults: string[];
  agentSystemPrompt?: string;
  agentId?: string;
}): Promise<AgentReply> {
  if (toolCalls.length !== toolResults.length) {
    throw new Error('toolCalls et toolResults doivent avoir la même longueur');
  }

  const assistantMessage: ApiMessage = {
    role: 'assistant',
    content: '',
    tool_calls: toolCalls.map((tc) => ({
      id: tc.id,
      type: 'function',
      function: {
        name: tc.name,
        arguments: JSON.stringify(tc.arguments || {}),
      },
    })),
  };

  const toolMessages: ApiMessage[] = toolCalls.map((tc, i) => ({
    role: 'tool',
    content: toolResults[i],
    tool_call_id: tc.id,
  }));

  const fullMessages = [...messages, assistantMessage, ...toolMessages];

  console.log('[API] Envoi avec tool results:', {
    count: toolCalls.length,
    toolNames: toolCalls.map((tc) => tc.name),
  });

  const response = await fetchWithTimeout(`${API_URL}/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messages: fullMessages,
      agentSystemPrompt,
      enableTools: false,
      agentId,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.warn('[API] Erreur tool results:', response.status, errorText);
    throw new Error(`Erreur serveur : ${response.status} - ${errorText}`);
  }

  const data = await response.json();

  return {
    reply: data.reply || '',
    toolCalls: data.toolCalls,
  };
}

/**
 * 🆕 Fait juger une réponse de quiz par l'IA (bug #14).
 */
export async function judgeAnswer({
  question,
  expected,
  given,
}: {
  question: string;
  expected: string;
  given: string;
}): Promise<{
  correct: boolean;
  almost: boolean;
  explanation: string | null;
}> {
  try {
    const response = await fetchWithTimeout(
      `${API_URL}/judge-answer`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, expected, given }),
      },
      10000
    );

    if (!response.ok) {
      console.warn('[API] /judge-answer échec:', response.status);
      return { correct: false, almost: false, explanation: null };
    }

    const data = await response.json();
    return {
      correct: !!data.correct,
      almost: !!data.almost,
      explanation: data.explanation || null,
    };
  } catch (error) {
    console.warn('[API] Erreur judgeAnswer:', error);
    return { correct: false, almost: false, explanation: null };
  }
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