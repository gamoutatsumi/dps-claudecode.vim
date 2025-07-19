// Mock implementation of Claude Code SDK for testing

export interface MockMessage {
  type: string;
  message?: {
    content: Array<{
      type: string;
      text: string;
    }>;
  };
  usage?: {
    input_tokens: number;
    output_tokens: number;
  };
  [key: string]: unknown;
}

export function createMockQuery(
  responses: MockMessage[] | Error,
): (prompt: string) => AsyncGenerator<MockMessage> {
  return async function* mockQuery(
    _prompt: string,
  ): AsyncGenerator<MockMessage> {
    if (responses instanceof Error) {
      throw responses;
    }

    // Simulate delay for more realistic testing
    await new Promise((resolve) => setTimeout(resolve, 10));

    for (const response of responses) {
      // Simulate streaming delay
      await new Promise((resolve) => setTimeout(resolve, 5));
      yield response;
    }
  };
}

// Pre-defined response patterns for common test scenarios
export const mockResponses = {
  simpleResponse: [
    {
      type: "system",
    },
    {
      type: "assistant",
      message: {
        content: [{
          type: "text",
          text: "Hello! How can I help you today?",
        }],
      },
    },
    {
      type: "result",
      usage: {
        input_tokens: 15,
        output_tokens: 8,
      },
    },
  ] as MockMessage[],

  codeResponse: [
    {
      type: "system",
    },
    {
      type: "assistant",
      message: {
        content: [{
          type: "text",
          text:
            "Here's a simple function:\n\n```typescript\nfunction greet(name: string): string {\n  return `Hello, ${name}!`;\n}\n```",
        }],
      },
    },
    {
      type: "result",
      usage: {
        input_tokens: 20,
        output_tokens: 35,
      },
    },
  ] as MockMessage[],

  errorResponse: new Error("API rate limit exceeded"),

  emptyResponse: [
    {
      type: "assistant",
      message: {
        content: [{
          type: "text",
          text: "",
        }],
      },
    },
    {
      type: "result",
      usage: {
        input_tokens: 10,
        output_tokens: 0,
      },
    },
  ] as MockMessage[],

  multipartResponse: [
    {
      type: "assistant",
      message: {
        content: [{
          type: "text",
          text: "Let me help you with that. ",
        }],
      },
    },
    {
      type: "assistant",
      message: {
        content: [{
          type: "text",
          text: "First, we need to understand the problem. ",
        }],
      },
    },
    {
      type: "assistant",
      message: {
        content: [{
          type: "text",
          text: "Then we can work on a solution.",
        }],
      },
    },
    {
      type: "result",
      usage: {
        input_tokens: 25,
        output_tokens: 20,
      },
    },
  ] as MockMessage[],
};

// Mock abort controller for testing cancellation
export class MockAbortController {
  signal: AbortSignal;
  private abortHandler?: () => void;

  constructor() {
    this.signal = {
      aborted: false,
      addEventListener: (event: string, handler: () => void) => {
        if (event === "abort") {
          this.abortHandler = handler;
        }
      },
      removeEventListener: () => {},
    } as unknown as AbortSignal;
  }

  abort(): void {
    (this.signal as unknown as { aborted: boolean }).aborted = true;
    if (this.abortHandler) {
      this.abortHandler();
    }
  }
}
