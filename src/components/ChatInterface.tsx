'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Activity, Play, RotateCcw, Zap } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import ChatMessageComponent from './ChatMessage';
import ConversationGroupComponent from './ConversationGroup';

import {
  ChatEvent,
  ChatMessage,
  ConversationGroup,
  MessageChunkData,
  ReasoningData,
  ToolCallData,
} from '@/types/chat';

const ChatInterface = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversationGroups, setConversationGroups] = useState<
    ConversationGroup[]
  >([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [eventSource, setEventSource] = useState<EventSource | null>(null);
  const [stats, setStats] = useState({
    reasoning: 0,
    toolCalls: 0,
    messages: 0,
    total: 0,
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageBuffer = useRef<Map<string, ChatMessage>>(new Map());
  const responseMessageId = useRef<string>('');
  const currentSessionMessages = useRef<ChatMessage[]>([]); // 跟踪当前会话的所有消息

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, conversationGroups]);

  const updateStats = (type: string) => {
    setStats((prev) => ({
      ...prev,
      [type === 'reasoning'
        ? 'reasoning'
        : type === 'tool_call'
        ? 'toolCalls'
        : type === 'message'
        ? 'messages'
        : 'total']:
        prev[
          type === 'reasoning'
            ? 'reasoning'
            : type === 'tool_call'
            ? 'toolCalls'
            : type === 'message'
            ? 'messages'
            : 'total'
        ] + 1,
      total: prev.total + 1,
    }));
  };

  const createMessageId = (event: ChatEvent, _eventType?: string) => {
    // 为不同类型的事件创建唯一ID
    if (event.event_type === 'tool_calls') {
      const toolData = event.data as unknown as ToolCallData;
      return `${toolData.tool_call_id}_${toolData.phase}`;
    }
    if (event.event_type === 'reasoning') {
      const reasoningData = event.data as unknown as ReasoningData;
      return reasoningData.reasoning_id;
    }
    if (event.event_type === 'message_chunk') {
      // message_chunk的message_id通常为空，使用响应ID
      if (!responseMessageId.current) {
        responseMessageId.current = `response_${Date.now()}_${Math.random()
          .toString(36)
          .slice(2)}`;
      }
      return responseMessageId.current;
    }
    return event.message_id;
  };

  const processEvent = (event: ChatEvent) => {
    if (event.event_type === 'chat_start') {
      return;
    }

    // 处理聊天结束事件
    if (event.event_type === 'end') {
      handleChatEnd();
      return;
    }

    // 如果是新的reasoning或tool_call，并且当前有response消息，重置response ID
    if (
      (event.event_type === 'reasoning' || event.event_type === 'tool_calls') &&
      responseMessageId.current &&
      messages.some((msg) => msg.type === 'message')
    ) {
      responseMessageId.current = '';
    }

    const messageId = createMessageId(event);
    let message = messageBuffer.current.get(messageId);

    // 处理不同类型的事件
    switch (event.event_type) {
      case 'reasoning': {
        const reasoningData = event.data as unknown as ReasoningData;
        if (!message) {
          message = {
            id: messageId,
            agent: event.agent_name,
            content: reasoningData.text_chunk || '',
            type: 'reasoning',
            eventType: event.event_type,
            timestamp: Date.now(),
            isComplete: false,
          };
          updateStats('reasoning');
        } else {
          message.content += reasoningData.text_chunk || '';
        }
        break;
      }

      case 'tool_calls': {
        const toolData = event.data as unknown as ToolCallData;
        if (!message) {
          message = {
            id: messageId,
            agent: event.agent_name,
            content: toolData.phase === 'start' ? '' : toolData.content || '',
            type: 'tool_call',
            eventType: event.event_type,
            timestamp: Date.now(),
            isComplete: toolData.phase === 'end',
            toolName: toolData.tool_name,
            toolPhase: toolData.phase,
            args: toolData.phase === 'start' ? toolData.args : undefined,
          };
          updateStats('tool_call');
        } else {
          if (toolData.phase === 'end') {
            message.content = toolData.content || '';
            message.isComplete = true;
            message.toolPhase = 'end';
          }
        }
        break;
      }

      case 'message_chunk': {
        const msgData = event.data as unknown as MessageChunkData;
        if (!message) {
          message = {
            id: messageId,
            agent: event.agent_name,
            content: msgData.content || '',
            type: 'message',
            eventType: event.event_type,
            timestamp: Date.now(),
            isComplete: false,
            thinkingTime: msgData.thinking_time,
          };
          updateStats('message');
        } else {
          message.content += msgData.content || '';
        }
        break;
      }

      default:
        return;
    }

    messageBuffer.current.set(messageId, message);

    // 将消息添加到当前会话跟踪中
    const existingIndex = currentSessionMessages.current.findIndex(
      (m) => m.id === messageId
    );
    if (existingIndex >= 0) {
      currentSessionMessages.current[existingIndex] = { ...message };
    } else {
      currentSessionMessages.current.push({ ...message });
    }

    // 实时更新消息列表
    setMessages((prev) => {
      const existing = prev.findIndex((m) => m.id === messageId);
      if (existing >= 0) {
        const updated = [...prev];
        updated[existing] = { ...message };
        return updated;
      }
      return [...prev, { ...message }];
    });
  };

  const startStreaming = () => {
    if (eventSource) {
      eventSource.close();
    }

    setMessages([]);
    setConversationGroups([]);
    messageBuffer.current.clear();
    responseMessageId.current = '';
    currentSessionMessages.current = [];
    setStats({ reasoning: 0, toolCalls: 0, messages: 0, total: 0 });
    setIsStreaming(true);

    const es = new EventSource('/api/chat-stream?delay=30');

    es.onmessage = (event) => {
      if (event.data === '[DONE]') {
        // 在处理聊天结束前，先暂停一下让最后的更新处理完
        setTimeout(() => {
          handleChatEnd();
          setIsStreaming(false);
          es.close();
        }, 100);
        return;
      }

      try {
        const chatEvent: ChatEvent = JSON.parse(event.data);
        processEvent(chatEvent);
      } catch (error) {
        // Handle parsing error silently
      }
    };

    es.onerror = () => {
      setIsStreaming(false);
      es.close();
    };

    setEventSource(es);
  };

  const handleChatEnd = () => {
    // 将所有未完成的消息标记为完成
    const allSessionMessages = currentSessionMessages.current.map((msg) => ({
      ...msg,
      isComplete: true,
    }));

    // 更新当前实时消息状态为完成
    setMessages((prev) =>
      prev.map((msg) => ({
        ...msg,
        isComplete: true,
      }))
    );

    // 更新messageBuffer中的消息状态
    messageBuffer.current.forEach((msg, id) => {
      messageBuffer.current.set(id, { ...msg, isComplete: true });
    });

    if (allSessionMessages.length > 0) {
      const responseMessages = allSessionMessages.filter(
        (msg) => msg.type === 'message'
      );
      const thinkingMessages = allSessionMessages.filter(
        (msg) => msg.type === 'reasoning' || msg.type === 'tool_call'
      );

      // 如果有思考过程和最终回复，创建对话组
      if (thinkingMessages.length > 0 && responseMessages.length > 0) {
        const finalResponse = responseMessages[responseMessages.length - 1]; // 取最后一个回复作为最终回复

        const newGroup: ConversationGroup = {
          id: `group_final_${Date.now()}_${Math.random()
            .toString(36)
            .slice(2)}`,
          messages: thinkingMessages,
          finalResponse: finalResponse,
          isCollapsed: true,
          hasResponse: true,
        };

        setConversationGroups((prev) => [...prev, newGroup]);
        setMessages([]); // 清空实时消息
      } else if (responseMessages.length > 0) {
        // 如果只有回复没有思考过程，也创建一个组但不折叠
        const finalResponse = responseMessages[responseMessages.length - 1];
        const newGroup: ConversationGroup = {
          id: `group_final_${Date.now()}_${Math.random()
            .toString(36)
            .slice(2)}`,
          messages: [],
          finalResponse: finalResponse,
          isCollapsed: false,
          hasResponse: true,
        };

        setConversationGroups((prev) => [...prev, newGroup]);
        setMessages([]); // 清空实时消息
      }
    }

    // 清空会话跟踪
    currentSessionMessages.current = [];
  };

  const resetChat = () => {
    if (eventSource) {
      eventSource.close();
      setEventSource(null);
    }
    setMessages([]);
    setConversationGroups([]);
    messageBuffer.current.clear();
    responseMessageId.current = '';
    currentSessionMessages.current = [];
    setStats({ reasoning: 0, toolCalls: 0, messages: 0, total: 0 });
    setIsStreaming(false);
  };

  return (
    <div className='min-h-screen bg-gradient-to-br from-slate-100 via-slate-50 to-white h-screen overflow-hidden w-full'>
      {/* 桌面端布局 */}
      <div className='hidden lg:flex h-screen w-full'>
        {/* 左侧控制面板 */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className='w-96 min-w-96 bg-white/90 backdrop-blur-sm border-r border-slate-200/50 p-6 flex flex-col shadow-lg overflow-y-auto'
        >
          {/* 头部控制区 */}
          <div className='space-y-6'>
            <div>
              <div className='flex items-center gap-3 mb-4'>
                <div className='p-2 bg-gradient-to-r from-teal-500 to-teal-600 rounded-xl flex-shrink-0'>
                  <Zap className='w-6 h-6 text-white' />
                </div>
                <div className='min-w-0'>
                  <h1 className='text-2xl font-bold text-slate-800 leading-tight'>
                    AI Agent Chat
                  </h1>
                </div>
              </div>
              <p className='text-slate-600 text-sm leading-relaxed mb-6'>
                Multi-agent conversation analysis with intelligent reasoning
              </p>
            </div>

            {/* 按钮区域 */}
            <div className='flex flex-col gap-3'>
              {!isStreaming ? (
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={startStreaming}
                  className='flex items-center justify-center gap-2 w-full py-3 px-4 bg-gradient-to-r from-teal-500 to-teal-600 text-white rounded-xl hover:from-teal-600 hover:to-teal-700 transition-all duration-200 shadow-lg'
                >
                  <Play className='w-4 h-4' />
                  Start Analysis
                </motion.button>
              ) : (
                <div className='flex items-center justify-center gap-2 w-full py-3 px-4 bg-gradient-to-r from-teal-500/20 to-teal-600/20 text-teal-600 rounded-xl border border-teal-200'>
                  <Activity className='w-4 h-4' />
                  Analyzing...
                </div>
              )}

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={resetChat}
                className='flex items-center justify-center gap-2 w-full py-3 px-4 bg-gradient-to-r from-slate-400 to-slate-500 text-white rounded-xl hover:from-slate-500 hover:to-slate-600 transition-all duration-200 shadow-lg'
              >
                <RotateCcw className='w-4 h-4' />
                Reset
              </motion.button>
            </div>

            {/* 状态指示器 */}
            <div className='flex items-center gap-2 py-3 px-4 bg-slate-50/80 rounded-xl border border-slate-200/50'>
              <Activity
                className={`w-4 h-4 ${
                  isStreaming ? 'text-teal-600' : 'text-slate-400'
                }`}
              />
              <span
                className={`text-sm font-medium ${
                  isStreaming ? 'text-teal-600' : 'text-slate-400'
                }`}
              >
                {isStreaming ? 'Analyzing' : 'Ready'}
              </span>
            </div>

            {/* 统计数据 */}
            <div className='space-y-3'>
              <h3 className='text-sm font-semibold text-slate-700 uppercase tracking-wide'>
                Statistics
              </h3>
              <div className='grid grid-cols-2 gap-3'>
                <div className='bg-slate-50/80 rounded-lg p-3 border border-slate-200/50'>
                  <div className='text-xs text-slate-500 mb-1'>
                    Conversations
                  </div>
                  <div className='text-lg font-bold text-slate-800 font-mono'>
                    {conversationGroups.length}
                  </div>
                </div>
                <div className='bg-slate-50/80 rounded-lg p-3 border border-slate-200/50'>
                  <div className='text-xs text-slate-500 mb-1'>Messages</div>
                  <div className='text-lg font-bold text-slate-800 font-mono'>
                    {messages.length}
                  </div>
                </div>
                <div className='bg-teal-50/80 rounded-lg p-3 border border-teal-200/50'>
                  <div className='text-xs text-teal-600 mb-1'>Thinking</div>
                  <div className='text-lg font-bold text-teal-700 font-mono'>
                    {stats.reasoning}
                  </div>
                </div>
                <div className='bg-cyan-50/80 rounded-lg p-3 border border-cyan-200/50'>
                  <div className='text-xs text-cyan-600 mb-1'>Tools</div>
                  <div className='text-lg font-bold text-cyan-700 font-mono'>
                    {stats.toolCalls}
                  </div>
                </div>
                <div className='bg-emerald-50/80 rounded-lg p-3 border border-emerald-200/50 col-span-2'>
                  <div className='text-xs text-emerald-600 mb-1'>Responses</div>
                  <div className='text-lg font-bold text-emerald-700 font-mono'>
                    {stats.messages}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 底部信息 */}
          <div className='mt-auto pt-6 border-t border-slate-200/50'>
            <div className='text-xs text-slate-400 text-center'>
              Multi-agent AI Analysis Platform
            </div>
          </div>
        </motion.div>

        {/* 右侧聊天内容区域 */}
        <div className='flex-1 flex flex-col h-screen min-w-0 overflow-hidden'>
          {/* 对话组和实时消息列表区域 */}
          <div className='flex-1 overflow-y-auto space-y-6 p-6 custom-scrollbar'>
            {/* 已完成的对话组 */}
            <AnimatePresence mode='popLayout'>
              {conversationGroups.map((group, index) => (
                <ConversationGroupComponent
                  key={group.id}
                  group={group}
                  index={index}
                />
              ))}
            </AnimatePresence>

            {/* 实时消息列表 */}
            {messages.length > 0 && (
              <div className='space-y-3'>
                <AnimatePresence mode='popLayout'>
                  {messages.map((message, index) => (
                    <ChatMessageComponent
                      key={message.id}
                      message={message}
                      index={index}
                    />
                  ))}
                </AnimatePresence>
              </div>
            )}

            {conversationGroups.length === 0 && messages.length === 0 && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className='flex items-center justify-center h-full'
              >
                <div className='text-center py-20 max-w-md'>
                  <div className='p-6 bg-gradient-to-r from-teal-500/10 to-cyan-500/10 rounded-2xl border border-slate-200/50 backdrop-blur-sm'>
                    <Zap className='w-16 h-16 mx-auto mb-4 text-slate-400' />
                    <h2 className='text-2xl font-bold text-slate-800 mb-2'>
                      Ready for Agent Analysis
                    </h2>
                    <p className='text-slate-600'>
                      Click "Start Analysis" to explore multi-agent
                      conversations with intelligent reasoning breakdown
                    </p>
                  </div>
                </div>
              </motion.div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>
      </div>

      {/* 移动端布局 - 保持原有设计 */}
      <div className='lg:hidden h-screen flex flex-col overflow-hidden'>
        <div className='w-full p-3 sm:p-6 h-screen flex flex-col min-w-0'>
          {/* 头部控制区 */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className='bg-white/90 backdrop-blur-sm rounded-2xl border border-slate-200/50 p-4 lg:p-6 mb-6 shadow-lg min-w-0'
          >
            <div className='flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 min-w-0'>
              <div className='flex items-center gap-3 min-w-0'>
                <div className='p-2 bg-gradient-to-r from-teal-500 to-teal-600 rounded-xl flex-shrink-0'>
                  <Zap className='w-5 h-5 lg:w-6 lg:h-6 text-white' />
                </div>
                <div className='min-w-0'>
                  <h1 className='text-xl lg:text-2xl font-bold text-slate-800 leading-tight'>
                    AI Agent Chat
                  </h1>
                  <p className='text-slate-600 text-xs lg:text-sm leading-relaxed'>
                    Multi-agent conversation analysis with intelligent reasoning
                  </p>
                </div>
              </div>

              <div className='flex items-center gap-2 lg:gap-3 flex-shrink-0'>
                {!isStreaming ? (
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={startStreaming}
                    className='flex items-center gap-2 px-4 py-2 lg:px-6 lg:py-3 bg-gradient-to-r from-teal-500 to-teal-600 text-white rounded-xl hover:from-teal-600 hover:to-teal-700 transition-all duration-200 shadow-lg text-sm lg:text-base'
                  >
                    <Play className='w-4 h-4' />
                    <span className='hidden sm:inline'>Start Analysis</span>
                    <span className='sm:hidden'>Start</span>
                  </motion.button>
                ) : (
                  <div className='flex items-center gap-2 px-4 py-2 lg:px-6 lg:py-3 bg-gradient-to-r from-teal-500/20 to-teal-600/20 text-teal-600 rounded-xl border border-teal-200 text-sm lg:text-base'>
                    <Activity className='w-4 h-4' />
                    <span className='hidden sm:inline'>Analyzing...</span>
                    <span className='sm:hidden'>Analysis</span>
                  </div>
                )}

                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={resetChat}
                  className='flex items-center gap-2 px-4 py-2 lg:px-6 lg:py-3 bg-gradient-to-r from-slate-400 to-slate-500 text-white rounded-xl hover:from-slate-500 hover:to-slate-600 transition-all duration-200 shadow-lg text-sm lg:text-base'
                >
                  <RotateCcw className='w-4 h-4' />
                  <span className='hidden sm:inline'>Reset</span>
                </motion.button>
              </div>
            </div>

            {/* Stats */}
            <div className='flex flex-wrap items-center gap-3 lg:gap-6 mt-4 pt-4 border-t border-slate-200/50'>
              <div className='flex items-center gap-2 flex-shrink-0'>
                <Activity
                  className={`w-4 h-4 ${
                    isStreaming ? 'text-teal-600' : 'text-slate-400'
                  }`}
                />
                <span
                  className={`text-xs lg:text-sm font-medium ${
                    isStreaming ? 'text-teal-600' : 'text-slate-400'
                  }`}
                >
                  {isStreaming ? 'Analyzing' : 'Ready'}
                </span>
              </div>

              <div className='flex flex-wrap items-center gap-2 lg:gap-4 text-xs lg:text-sm text-slate-600'>
                <span className='whitespace-nowrap'>
                  Conv:{' '}
                  <span className='text-slate-800 font-mono'>
                    {conversationGroups.length}
                  </span>
                </span>
                <span className='whitespace-nowrap'>
                  Msg:{' '}
                  <span className='text-slate-800 font-mono'>
                    {messages.length}
                  </span>
                </span>
                <span className='whitespace-nowrap'>
                  Think:{' '}
                  <span className='text-teal-600 font-mono'>
                    {stats.reasoning}
                  </span>
                </span>
                <span className='whitespace-nowrap'>
                  Tools:{' '}
                  <span className='text-cyan-600 font-mono'>
                    {stats.toolCalls}
                  </span>
                </span>
                <span className='whitespace-nowrap'>
                  Resp:{' '}
                  <span className='text-emerald-600 font-mono'>
                    {stats.messages}
                  </span>
                </span>
              </div>
            </div>
          </motion.div>

          {/* 对话组和实时消息列表区域 */}
          <div className='flex-1 overflow-y-auto py-6 px-2 space-y-6 pb-4 custom-scrollbar min-w-0'>
            {/* 已完成的对话组 */}
            <AnimatePresence mode='popLayout'>
              {conversationGroups.map((group, index) => (
                <ConversationGroupComponent
                  key={group.id}
                  group={group}
                  index={index}
                />
              ))}
            </AnimatePresence>

            {/* 实时消息列表 */}
            {messages.length > 0 && (
              <div className='space-y-3'>
                <AnimatePresence mode='popLayout'>
                  {messages.map((message, index) => (
                    <ChatMessageComponent
                      key={message.id}
                      message={message}
                      index={index}
                    />
                  ))}
                </AnimatePresence>
              </div>
            )}

            {conversationGroups.length === 0 && messages.length === 0 && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className='text-center py-20'
              >
                <div className='p-6 bg-gradient-to-r from-teal-500/10 to-cyan-500/10 rounded-2xl border border-slate-200/50 backdrop-blur-sm'>
                  <Zap className='w-16 h-16 mx-auto mb-4 text-slate-400' />
                  <h2 className='text-2xl font-bold text-slate-800 mb-2'>
                    Ready for Agent Analysis
                  </h2>
                  <p className='text-slate-600'>
                    Click "Start Analysis" to explore multi-agent conversations
                    with intelligent reasoning breakdown
                  </p>
                </div>
              </motion.div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatInterface;
