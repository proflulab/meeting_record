/*
 * @Author: 杨仕明 shiming.y@qq.com
 * @Date: 2025-05-06 14:40:10
 * @LastEditors: 杨仕明 shiming.y@qq.com
 * @LastEditTime: 2025-05-06 17:03:49
 * @FilePath: /meeting_record/src/utils/ai/summarize.ts
 * @Description: 
 * 
 * Copyright (c) 2025 by ${git_name_email}, All Rights Reserved. 
 */

import { chatCompletion } from './openai/openai_chat';

type SummarizeFunction = (chunk: string[]) => Promise<string>;

const MAX_CHUNK_LENGTH = 100000;
const DEFAULT_MODEL = 'deepseek-v3-250324';

/**
 * 拆分数组为多个数据块，保证每块字符串总长度不超过MAX_CHUNK_LENGTH
 */
function splitIntoChunks(data: string[], maxLength: number): string[][] {
    // ... existing code ...
    const chunks: string[][] = [];
    let currentChunk: string[] = [];
    let currentLength = 0;

    for (const item of data) {
        if (currentLength + item.length > maxLength) {
            chunks.push(currentChunk);
            currentChunk = [item];
            currentLength = item.length;
        } else {
            currentChunk.push(item);
            currentLength += item.length;
        }
    }

    if (currentChunk.length > 0) {
        chunks.push(currentChunk);
    }

    return chunks;
}

/**
 * 递归总结函数
 */
export async function recursiveSummarize(data: string[], summarizeFn: SummarizeFunction): Promise<string> {
    // ... existing code ...
    if (data.length === 1) return data[0];

    const chunks = splitIntoChunks(data, MAX_CHUNK_LENGTH);
    const summaries: string[] = [];

    for (const chunk of chunks) {
        const summary = await summarizeFn(chunk);
        summaries.push(summary);
    }

    return await recursiveSummarize(summaries, summarizeFn);
}

/**
 * 使用OpenAI API进行文本摘要
 * @param chunk 需要摘要的文本数组
 * @param model 可选，指定使用的模型
 * @returns 摘要结果
 */
export const openAISummarize: SummarizeFunction = async (chunk, model = DEFAULT_MODEL) => {
    const content = chunk.join('\n');
    const messages = [
        { role: 'system', content: '你是一个专业的会议记录摘要助手，请对以下内容进行简洁、全面的摘要。保留关键信息，去除冗余内容。' },
        { role: 'user', content: `请对以下内容进行摘要：\n\n${content}` }
    ];

    return await chatCompletion({
        messages,
        model: model || DEFAULT_MODEL
    });
};

// 示例调用
// 注释掉示例代码，实际使用时可以取消注释
/*
(async () => {
    const sampleData = new Array(100).fill(0).map((_, i) => `这是第 ${i + 1} 条数据，它的内容可以很长也可以很短。`);
    const result = await recursiveSummarize(sampleData, openAISummarize);
    console.log('最终总结结果：', result);
})();
*/