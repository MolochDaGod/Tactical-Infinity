import { useEffect, useRef } from 'react';
import type { ChatMessage } from './types';

interface Props {
  messages: ChatMessage[];
}

export function CinzelChat({ messages }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  // Auto-scroll to newest message.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages]);

  return (
    <div
      className="ui-element panel-style chat-section"
      style={{ height: 132 }}
      data-testid="cinzel-chat"
    >
      <div className="chat-log" ref={ref}>
        {messages.length === 0 && (
          <div className="chat-system">— silence on the seas —</div>
        )}
        {messages.map(m => {
          const cls =
            m.kind === 'system' ? 'chat-system' :
            m.kind === 'self'   ? 'chat-self'   :
            m.kind === 'loot'   ? 'chat-loot'   : '';
          return (
            <div key={m.id} className={cls} data-testid={`chat-msg-${m.id}`}>
              {m.sender ? <strong>{m.sender}: </strong> : null}{m.text}
            </div>
          );
        })}
      </div>
    </div>
  );
}
