/*
 * @Author: 杨仕明 shiming.y@qq.com
 * @Date: 2025-05-03 23:44:23
 * @LastEditors: 杨仕明 shiming.y@qq.com
 * @LastEditTime: 2025-05-03 23:56:14
 * @FilePath: /meeting_record/src/app/api/stream/route.ts
 * @Description: 
 * 
 * Copyright (c) 2025 by ${git_name_email}, All Rights Reserved. 
 */

export const runtime = 'edge'; // 可选：使用 Edge Runtime

export async function GET() {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
        async start(controller) {
            for (let i = 1; i <= 50; i++) {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ count: i })}\n\n`));
                await new Promise(res => setTimeout(res, 100));
            }
            controller.close();
        }
    });

    return new Response(stream, {
        headers: {
            'Content-Type': 'text/event-stream; charset=utf-8',  // SSE 格式
            'Cache-Control': 'no-cache, no-transform',
            'Connection': 'keep-alive',
        }
    });
}

