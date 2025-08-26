'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { ChevronRight, MessageSquare } from 'lucide-react';
import { useState } from 'react';

import ChatMessageComponent from './ChatMessage';

import { ConversationGroup } from '@/types/chat';

interface ConversationGroupProps {
  group: ConversationGroup;
  index: number;
}

const ConversationGroupComponent = ({
  group,
  index,
}: ConversationGroupProps) => {
  const [isExpanded, setIsExpanded] = useState(!group.hasResponse);

  const thinkingMessages = group.messages.filter(
    (msg) => msg.type === 'reasoning' || msg.type === 'tool_call'
  );
  const responseMessage = group.finalResponse;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.5,
        delay: index * 0.1,
        ease: [0.25, 0.46, 0.45, 0.94],
      }}
      className='space-y-3'
    >
      {/* Final Response (if exists) */}
      {responseMessage && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: index * 0.1 + 0.2 }}
          className='relative'
        >
          {/* Response highlight border */}
          <div className='absolute -inset-2 bg-gradient-to-r from-teal-400/40 to-cyan-400/40 rounded-2xl blur-md' />
          <div className='relative bg-gradient-to-r from-teal-50/90 to-cyan-50/90 rounded-xl border-2 border-teal-200/50 shadow-lg'>
            <ChatMessageComponent
              message={responseMessage}
              index={0}
              showHeader={true}
            />
          </div>
        </motion.div>
      )}

      {/* Thinking Process Section */}
      {thinkingMessages.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: index * 0.1 + 0.3 }}
          className='space-y-2'
        >
          {/* Collapsible Header */}
          <motion.button
            onClick={() => setIsExpanded(!isExpanded)}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className='w-full flex items-center gap-3 p-3 bg-white/50 hover:bg-white/80 rounded-lg border border-slate-200/50 hover:border-slate-300/50 transition-all duration-200 shadow-sm group'
          >
            <div className='flex items-center gap-2'>
              <motion.div
                animate={{ rotate: isExpanded ? 90 : 0 }}
                transition={{ duration: 0.2 }}
              >
                <ChevronRight className='w-4 h-4 text-slate-500 group-hover:text-slate-600' />
              </motion.div>
              <MessageSquare className='w-4 h-4 text-slate-400' />
              <span className='text-sm text-slate-500 group-hover:text-slate-600'>
                思考过程详情
              </span>
            </div>

            <div className='flex items-center gap-3 ml-auto'>
              <span className='text-xs text-slate-400 bg-slate-100/80 px-2 py-1 rounded-full border border-slate-200/50'>
                {thinkingMessages.length} steps
              </span>
              {!isExpanded && (
                <span className='text-xs text-slate-500'>
                  {isExpanded ? 'Hide' : 'Show'} details
                </span>
              )}
            </div>
          </motion.button>

          {/* Collapsible Content */}
          <AnimatePresence initial={false}>
            {isExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{
                  height: { duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] },
                  opacity: { duration: 0.2, delay: 0.1 },
                }}
                className='overflow-hidden'
              >
                <div className='space-y-3 pt-2'>
                  {thinkingMessages.map((message, msgIndex) => (
                    <motion.div
                      key={message.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{
                        delay: msgIndex * 0.05,
                        duration: 0.3,
                      }}
                      className='relative'
                    >
                      {/* Indent line for thinking messages */}
                      <div className='absolute left-4 top-0 bottom-0 w-px bg-gradient-to-b from-slate-300/50 to-transparent' />
                      <div className='pl-6'>
                        <ChatMessageComponent
                          message={message}
                          index={msgIndex}
                          showHeader={true}
                        />
                      </div>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}

      {/* Show all messages if no response yet */}
      {!responseMessage && thinkingMessages.length === 0 && (
        <div className='space-y-3'>
          {group.messages.map((message, msgIndex) => (
            <ChatMessageComponent
              key={message.id}
              message={message}
              index={msgIndex}
            />
          ))}
        </div>
      )}
    </motion.div>
  );
};

export default ConversationGroupComponent;
