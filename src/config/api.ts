// URL du serveur Railway
export const API_URL = 'https://monapp-server-production.up.railway.app';

// Fonction pour envoyer un message à un agent
export async function sendMessageToAgent({
  messages,
  agentSystemPrompt,
}: {
  messages: { role: 'user' | 'assistant'; content: string }[];
  agentSystemPrompt?: string;
}) {
  const response = await fetch(`${API_URL}/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messages,
      agentSystemPrompt,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Erreur serveur : ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  return data.reply as string;
}