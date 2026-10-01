export const API_URL = 'https://monapp-server-production.up.railway.app';

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
  role: 'user' | 'assistant';
  content: MessageContent;
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
  const response = await fetch(`${API_URL}/chat`, {
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