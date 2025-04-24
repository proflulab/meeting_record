/*
 * @Author: 杨仕明 shiming.y@qq.com
 * @Date: 2025-04-23 14:28:53
 * @LastEditors: 杨仕明 shiming.y@qq.com
 * @LastEditTime: 2025-04-24 17:17:16
 * @FilePath: /meeting_record/src/utils/ai/openai/openai_chat.ts
 * @Description: 
 * 
 * Copyright (c) 2025 by ${git_name_email}, All Rights Reserved. 
 */


import OpenAI from 'openai';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY || '',
    baseURL: process.env.OPENAI_BASE_URL || '',
});

/**
 * 标准请求：返回完整回复内容
 * @param {Array} messages - 消息数组，格式同 OpenAI API
 * @param {string} model - 模型名称
 * @param {object} [options] - 其他可选参数
 * @returns {Promise<string>} - 回复内容
 */
export async function chatCompletion({ messages, model }: { messages: Array<{ role: string; content: string }>, model: string }) {
    try {
        const completion = await openai.chat.completions.create({
            messages: messages as OpenAI.ChatCompletionMessageParam[],
            model,
        });
        return completion.choices[0]?.message?.content || '';
    } catch (error) {
        console.error('chatCompletion error:', error);
        throw error;
    }
}

/**
 * 流式请求：以流方式处理回复内容
 * @param {Array} messages - 消息数组，格式同 OpenAI API
 * @param {string} model - 模型名称
 * @param {function} onData - 每次收到新内容时的回调 (content: string) => void
 * @param {object} [options] - 其他可选参数
 */
export async function chatCompletionStream({ messages, model, onData }: { messages: Array<{ role: string; content: string }>, model: string, onData: (content: string) => void }) {
    try {
        const stream = await openai.chat.completions.create({
            messages: messages as OpenAI.ChatCompletionMessageParam[],
            model,
            stream: true,
        });
        for await (const part of stream) {
            const content = part.choices[0]?.delta?.content || '';
            if (content && typeof onData === 'function') {
                onData(content);
            }
        }
    } catch (error) {
        console.error('chatCompletionStream error:', error);
        throw error;
    }
}
