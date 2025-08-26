import { NextRequest, NextResponse } from 'next/server';

export interface ChatEvent {
  event_type: string;
  data: Record<string, unknown>;
  agent_name: string;
  message_id: string;
  thread_id: string;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const delay = parseInt(searchParams.get('delay') || '100'); // 默认100ms延迟

  // 创建可读流
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        // 从public目录读取数据
        const response = await fetch(
          `${request.nextUrl.origin}/data/chat-data.json`
        );
        const data: ChatEvent[] = await response.json();

        // 按顺序发送每个事件
        for (const event of data) {
          // 将事件数据格式化为Server-Sent Events格式
          const eventData = `data: ${JSON.stringify(event)}\n\n`;

          controller.enqueue(encoder.encode(eventData));

          // 添加延迟模拟流式传输
          await new Promise((resolve) => setTimeout(resolve, delay));
        }

        // 发送结束信号
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      } catch (error) {
        controller.error(error);
      }
    },
  });

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET',
      'Access-Control-Allow-Headers': 'Cache-Control',
    },
  });
}
