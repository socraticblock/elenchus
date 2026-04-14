// AI client for Elenchus MCP server
// Uses OpenAI-compatible API — supports MiniMax, OpenAI, Azure, any compatible provider

export interface AiConfig {
  baseUrl: string; // e.g., https://api.minimax.io/v1
  apiKey: string;
  model: string;
}

export interface AiMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AiResponse {
  content: string;
  finishReason: string;
}

export class AiClient {
  private baseUrl: string;
  private apiKey: string;
  private model: string;

  constructor(config: AiConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, ''); // remove trailing slash
    this.apiKey = config.apiKey;
    this.model = config.model;
  }

  async chat(messages: AiMessage[]): Promise<AiResponse> {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages,
        temperature: 0.7,
        max_tokens: 2048,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`AI API error ${response.status}: ${errorText}`);
    }

    const data = (await response.json()) as {
      choices: Array<{ message: { content: string }; finish_reason: string }>;
    };

    const choice = data.choices[0];
    return {
      content: choice.message.content || '',
      finishReason: choice.finish_reason || 'stop',
    };
  }

  // Build a system prompt from elenchus context
  static buildSystemPrompt(context?: {
    domain?: string;
    project?: string;
    openQuestion?: string;
    workStyle?: string;
  }): string {
    const parts = [
      'You are Elenchus, a collaborative thinking partner. You engage in Socratic dialogue — asking questions, surfacing contradictions, and helping thinking converge toward clarity.',
      'You do not give answers directly. You help the human think through problems by drawing out implications, challenging assumptions, and identifying where their reasoning conflicts with itself.',
      "When you notice a contradiction in what the human has said, name it clearly but gently: \"It seems like you are saying X and also Y — those seem to point in different directions. What do you make of that?\"",
      "When the human is clearly making a decision, acknowledge it: \"It sounds like you are going with X. Should I note that as the current direction?\"",
      'You keep responses concise and focused. You ask one or two good questions rather than many.',
    ];

    if (context?.domain) {
      parts.push(`Context: The human is working in ${context.domain}.`);
    }
    if (context?.project) {
      parts.push(`Current project: ${context.project}.`);
    }
    if (context?.openQuestion) {
      parts.push(`Their current open question: ${context.openQuestion}.`);
    }
    if (context?.workStyle === 'decisive') {
      parts.push('They prefer decisive mode — help them crystallize and commit to decisions.');
    } else if (context?.workStyle === 'exploratory') {
      parts.push('They prefer exploratory mode — stay in the question, do not rush to conclusions.');
    }

    return parts.join('\n');
  }

  // Build the conversation context from thread exchanges
  static buildConversationContext(
    exchanges: Array<{
      participant: string;
      content: string;
      timestamp: string;
    }>
  ): AiMessage[] {
    return exchanges.map((ex) => ({
      role: ex.participant === 'human' ? 'user' : 'assistant',
      content: ex.content,
    }));
  }
}
