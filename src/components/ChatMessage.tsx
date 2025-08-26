'use client';

import { motion } from 'framer-motion';
import {
  Bot,
  Brain,
  Clock,
  Code,
  Cog,
  Globe,
  MessageSquare,
  Play,
  Search,
  Sparkles,
  Square,
  User,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import rehypeRaw from 'rehype-raw';
import remarkGfm from 'remark-gfm';

import 'highlight.js/styles/github.css';

import { ChatMessage } from '@/types/chat';

interface ChatMessageProps {
  message: ChatMessage;
  index: number;
  showHeader?: boolean;
}

const getAgentIcon = (agent: string, type: string, toolName?: string) => {
  if (type === 'reasoning') return <Brain className='w-4 h-4' />;
  if (type === 'tool_call') {
    switch (toolName) {
      case 'web_search':
        return <Search className='w-4 h-4' />;
      case 'web_fetch':
        return <Globe className='w-4 h-4' />;
      case 'repl':
        return <Code className='w-4 h-4' />;
      default:
        return <Cog className='w-4 h-4' />;
    }
  }
  if (type === 'message') return <MessageSquare className='w-4 h-4' />;
  if (agent === 'user') return <User className='w-4 h-4' />;
  return <Bot className='w-4 h-4' />;
};

const getAgentColor = (agent: string, type: string, toolName?: string) => {
  if (type === 'reasoning') {
    return agent === 'super'
      ? 'bg-teal-600 text-teal-100'
      : 'bg-teal-500 text-teal-100';
  }
  if (type === 'tool_call') {
    switch (toolName) {
      case 'web_search':
        return 'bg-cyan-600 text-cyan-100';
      case 'web_fetch':
        return 'bg-emerald-600 text-emerald-100';
      case 'repl':
        return 'bg-amber-600 text-amber-100';
      default:
        return 'bg-slate-600 text-slate-100';
    }
  }
  if (type === 'message') return 'bg-teal-600 text-teal-100';
  if (agent === 'system') return 'bg-slate-600 text-slate-100';
  return 'bg-cyan-600 text-cyan-100';
};

const getAgentLabel = (agent: string, type: string) => {
  if (type === 'reasoning')
    return agent === 'super' ? 'Deep Analysis' : 'Agent Reasoning';
  if (type === 'tool_call') return 'Tool Execution';
  if (type === 'message') return 'Agent Response';
  return agent;
};

const formatToolArgs = (args?: Record<string, unknown>) => {
  if (!args) return '';

  const query = args.query as string;
  if (query) {
    return query.length > 100 ? `${query.substring(0, 100)}...` : query;
  }

  return JSON.stringify(args, null, 2);
};

const ChatMessageComponent = ({
  message,
  index,
  showHeader = true,
}: ChatMessageProps) => {
  const isToolCall = message.type === 'tool_call';
  const isReasoning = message.type === 'reasoning';
  const isMessage = message.type === 'message';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, x: -20 }}
      animate={{ opacity: 1, y: 0, x: 0 }}
      transition={{
        duration: 0.4,
        delay: index * 0.02,
        ease: [0.25, 0.46, 0.45, 0.94],
      }}
      className='group relative w-full min-w-0'
    >
      <div
        className={`flex gap-3 p-4 rounded-xl bg-white/70 border border-slate-200/50 hover:bg-white/90 hover:border-slate-300/50 transition-all duration-200 shadow-sm w-full min-w-0 ${
          isMessage ? 'bg-white/90 border-slate-300/70 shadow-md' : ''
        }`}
      >
        {showHeader && (
          <>
            {/* Avatar */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{
                delay: index * 0.02 + 0.1,
                type: 'spring',
                stiffness: 400,
                damping: 20,
              }}
              className={`flex items-center justify-center w-8 h-8 rounded-full ${getAgentColor(
                message.agent,
                message.type,
                message.toolName
              )} shadow-lg`}
            >
              {getAgentIcon(message.agent, message.type, message.toolName)}
            </motion.div>
          </>
        )}

        <div className={`${showHeader ? 'flex-1' : 'w-full'} min-w-0`}>
          {showHeader && (
            <>
              {/* Header */}
              <div className='flex items-center gap-3 mb-2'>
                <span className='text-sm font-medium text-slate-700 capitalize'>
                  {getAgentLabel(message.agent, message.type)}
                </span>

                {isToolCall && message.toolName && (
                  <span className='text-xs px-2 py-1 bg-slate-100/80 text-slate-600 rounded-full font-mono border border-slate-200'>
                    {message.toolName}
                  </span>
                )}

                {isToolCall && message.toolPhase && (
                  <div className='flex items-center gap-1'>
                    {message.toolPhase === 'start' ? (
                      <Play className='w-3 h-3 text-emerald-400' />
                    ) : (
                      <Square className='w-3 h-3 text-rose-400' />
                    )}
                    <span className='text-xs text-slate-500 font-mono'>
                      {message.toolPhase}
                    </span>
                  </div>
                )}

                {isMessage && message.thinkingTime && (
                  <div className='flex items-center gap-1'>
                    <Clock className='w-3 h-3 text-cyan-400' />
                    <span className='text-xs text-cyan-600 font-mono'>
                      {message.thinkingTime.toFixed(2)}s
                    </span>
                  </div>
                )}

                {!message.isComplete && (
                  <motion.div
                    // animate={{ rotate: 360 }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      ease: 'linear',
                    }}
                    className='flex items-center gap-1'
                  >
                    <Sparkles className='w-3 h-3 text-amber-400' />
                    <span className='text-xs text-amber-600'>
                      processing...
                    </span>
                  </motion.div>
                )}

                <span className='text-xs text-slate-400 ml-auto font-mono'>
                  {new Date(message.timestamp).toLocaleTimeString()}
                </span>
              </div>

              {/* Tool Arguments (for tool calls) */}
              {isToolCall && message.args && message.toolPhase === 'start' && (
                <motion.div
                  className='mb-3 p-3 bg-slate-50/80 rounded-lg border border-slate-200/50'
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  transition={{ delay: index * 0.02 + 0.2 }}
                >
                  <div className='text-xs text-slate-500 mb-1 font-semibold'>
                    Query:
                  </div>
                  <div className='text-sm text-slate-600 font-mono leading-relaxed'>
                    {formatToolArgs(message.args)}
                  </div>
                </motion.div>
              )}
            </>
          )}

          {/* Main Content */}
          <motion.div
            className={`leading-relaxed w-full min-w-0 ${
              isReasoning
                ? 'text-slate-600 bg-slate-50/50 p-3 rounded border border-slate-200/30'
                : isMessage
                ? 'text-slate-700'
                : isToolCall && message.toolPhase === 'end'
                ? 'text-slate-600 bg-slate-50/80 p-3 rounded-lg border border-slate-200/50 font-mono text-xs overflow-x-auto'
                : 'text-slate-600 text-sm'
            }`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: index * 0.02 + 0.3 }}
          >
            {message.content ? (
              isMessage || isReasoning ? (
                <div
                  className={`prose prose-slate prose-sm max-w-none w-full min-w-0 overflow-hidden ${
                    isReasoning ? 'prose-reasoning' : ''
                  }`}
                >
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    rehypePlugins={[rehypeRaw, rehypeHighlight]}
                    components={{
                      p: ({ children }) => (
                        <p className='mb-3 leading-relaxed'>{children}</p>
                      ),
                      pre: ({ children }) => (
                        <pre className='bg-slate-100/80 border border-slate-200/50 rounded-lg p-4 overflow-x-auto mb-4'>
                          {children}
                        </pre>
                      ),
                      code: ({ children, className, ...props }) => {
                        const match = /language-(\w+)/.exec(className || '');
                        const isInline = !match && !className;
                        return isInline ? (
                          <code
                            className='bg-slate-100/80 px-1.5 py-0.5 rounded text-sm font-mono border border-slate-200/30'
                            {...props}
                          >
                            {children}
                          </code>
                        ) : (
                          <code className={className} {...props}>
                            {children}
                          </code>
                        );
                      },
                      blockquote: ({ children }) => (
                        <blockquote className='border-l-4 border-teal-400/60 pl-4 italic text-slate-600 mb-4'>
                          {children}
                        </blockquote>
                      ),
                      ul: ({ children }) => (
                        <ul className='list-none mb-4 space-y-1'>{children}</ul>
                      ),
                      ol: ({ children }) => (
                        <ol className='list-none mb-4 space-y-1'>{children}</ol>
                      ),
                      li: ({ children, ...props }) => {
                        // 获取父元素类型来判断是否为有序列表
                        const isOrderedList =
                          (props.node as Element)?.parent?.tagName === 'ol';
                        const index =
                          (props.node as Element)?.parent?.children
                            ?.filter((child: Element) => child.tagName === 'li')
                            .indexOf(props.node as Element) + 1;

                        if (isOrderedList) {
                          return (
                            <li className='leading-relaxed mb-1 flex'>
                              <span className='text-slate-600 font-mono mr-2 flex-shrink-0'>
                                {index}.
                              </span>
                              <div className='flex-1 min-w-0'>{children}</div>
                            </li>
                          );
                        }

                        return (
                          <li className='leading-relaxed mb-1 flex'>
                            <span className='text-slate-600 mr-2 flex-shrink-0'>
                              •
                            </span>
                            <div className='flex-1 min-w-0'>{children}</div>
                          </li>
                        );
                      },
                      h1: ({ children }) => (
                        <h1 className='text-xl font-bold mb-4 mt-6 first:mt-0'>
                          {children}
                        </h1>
                      ),
                      h2: ({ children }) => (
                        <h2 className='text-lg font-bold mb-3 mt-5 first:mt-0'>
                          {children}
                        </h2>
                      ),
                      h3: ({ children }) => (
                        <h3 className='text-base font-bold mb-2 mt-4 first:mt-0'>
                          {children}
                        </h3>
                      ),
                      table: ({ children }) => (
                        <div className='overflow-x-auto mb-4'>
                          <table className='min-w-full border-collapse border border-slate-200/50'>
                            {children}
                          </table>
                        </div>
                      ),
                      th: ({ children }) => (
                        <th className='border border-slate-200/50 px-4 py-2 bg-slate-50/80 font-medium text-left'>
                          {children}
                        </th>
                      ),
                      td: ({ children }) => (
                        <td className='border border-slate-200/50 px-4 py-2'>
                          {children}
                        </td>
                      ),
                    }}
                  >
                    {message.content}
                  </ReactMarkdown>
                </div>
              ) : (
                message.content
              )
            ) : (
              <span className='italic text-slate-400'>
                {isReasoning
                  ? 'Agent Analyzing...'
                  : isToolCall
                  ? 'Tool Executing...'
                  : 'Initializing...'}
              </span>
            )}
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
};

export default ChatMessageComponent;
