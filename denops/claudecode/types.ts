// Define types based on stream.json format
interface TextContent {
  type: "text";
  text: string;
}

interface AssistantMessage {
  id: string;
  type: "message";
  role: "assistant";
  model: string;
  content: TextContent[];
  stop_reason: string | null;
  stop_sequence: string | null;
  usage: {
    input_tokens: number;
    cache_creation_input_tokens?: number;
    cache_read_input_tokens?: number;
    output_tokens: number;
    service_tier: string;
  };
}

export interface StreamMessage {
  type: "system" | "assistant" | "result";
  message?: AssistantMessage;
  usage?: {
    input_tokens: number;
    output_tokens: number;
    cache_creation_input_tokens?: number;
    cache_read_input_tokens?: number;
  };
  // Other fields we don't need to track
  [key: string]: unknown;
}

export type Session = {
  id: string;
  model: string;
  bufnr: number;
  messages: AssistantMessage[];
  active: boolean;
  lastActivity: number;
};
