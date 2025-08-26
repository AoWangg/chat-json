export interface ChatEvent {
  event_type:
    | 'chat_start'
    | 'tool_calls'
    | 'reasoning'
    | 'message_chunk'
    | 'end';
  data: Record<string, unknown>;
  agent_name: string;
  message_id: string;
  thread_id: string;
}

export interface ToolCallData {
  phase: 'start' | 'end';
  tool_call_id: string;
  tool_name: string;
  args: Record<string, unknown>;
  args_chunk: string;
  content: string;
  success: boolean;
}

export interface ReasoningData {
  reasoning_id: string;
  text_chunk: string;
  index: number;
  session_started: boolean;
}

export interface MessageChunkData {
  content: string;
  message_id: string;
  thinking_time: number;
}

export interface ChatMessage {
  id: string;
  agent: string;
  content: string;
  type: 'reasoning' | 'tool_call' | 'message' | 'system';
  eventType: string;
  timestamp: number;
  isComplete: boolean;
  toolName?: string;
  toolPhase?: 'start' | 'end';
  args?: Record<string, unknown>;
  thinkingTime?: number;
}

export interface ConversationGroup {
  id: string;
  messages: ChatMessage[];
  finalResponse?: ChatMessage;
  isCollapsed: boolean;
  hasResponse: boolean;
}
