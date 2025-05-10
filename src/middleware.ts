/*
 * @Author: 杨仕明 shiming.y@qq.com
 * @Date: 2025-05-10 22:09:26
 * @LastEditors: 杨仕明 shiming.y@qq.com
 * @LastEditTime: 2025-05-10 22:09:27
 * @FilePath: /meeting_record/src/middleware.ts
 * @Description: 
 * 
 * Copyright (c) 2025 by ${git_name_email}, All Rights Reserved. 
 */
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
    // 跳过 /api/webhook 路径下的请求
    if (request.nextUrl.pathname.startsWith('/api/webhook')) {
        return NextResponse.next();
    }

    // 对除了 /api/webhook 以外的所有 /api 路径下的请求进行处理
    if (request.nextUrl.pathname.startsWith('/api')) {
        // 从请求头中获取token
        const token = request.headers.get('Authorization')?.replace('Bearer ', '');

        // 如果没有token，返回401未授权错误
        if (!token) {
            return new NextResponse(
                JSON.stringify({
                    code: 401,
                    message: '未授权访问',
                    data: null
                }),
                {
                    status: 401,
                    headers: {
                        'Content-Type': 'application/json',
                    },
                }
            );
        }

        // 验证token是否有效
        // 这里应该根据实际需求实现token的验证逻辑
        // 例如：验证token格式、过期时间、签名等
        const isValidToken = token === process.env.API_TOKEN;

        if (!isValidToken) {
            return new NextResponse(
                JSON.stringify({
                    code: 401,
                    message: 'token无效',
                    data: null
                }),
                {
                    status: 401,
                    headers: {
                        'Content-Type': 'application/json',
                    },
                }
            );
        }
    }

    return NextResponse.next();
}

// 配置中间件匹配的路径
export const config = {
    matcher: '/api/:path*',
};