'use client';

interface MessagePart {
  type: string;
  data: unknown;
}

interface Message {
  role: string;
  parts: MessagePart[];
}

export function MessageTimeline({ messages }: { messages: Message[] }) {
  if (!messages || messages.length === 0) {
    return (
      <p className="text-sm text-text-secondary">No messages yet.</p>
    );
  }

  return (
    <div className="space-y-3">
      {messages.map((msg, i) => {
        const isAgent = msg.role === 'agent';
        return (
          <div
            key={i}
            className={`flex ${isAgent ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-lg border border-border p-3 text-sm ${
                isAgent
                  ? 'bg-nexus-600/10 border-nexus-600/30'
                  : 'bg-surface-raised'
              }`}
            >
              <div className="mb-1 text-xs font-medium text-text-secondary">
                {isAgent ? 'Agent' : 'User'}
              </div>
              {msg.parts.map((part, j) => (
                <div key={j}>
                  {part.type === 'text' ? (
                    <p className="whitespace-pre-wrap">{String(part.data)}</p>
                  ) : (
                    <pre className="overflow-auto text-xs">{JSON.stringify(part.data, null, 2)}</pre>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
