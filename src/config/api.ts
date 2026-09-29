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

export async function sendMessageToAgent({
  messages,
  agentSystemPrompt,
  enableTools = false,
}: {
  messages: { role: 'user' | 'assistant'; content: string }[];
  agentSystemPrompt?: string;
  enableTools?: boolean;
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