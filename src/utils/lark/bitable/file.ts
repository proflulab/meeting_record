/*
 * @Author: 杨仕明 shiming.y@qq.com
 * @Date: 2025-03-11 18:43:59
 * @LastEditors: 杨仕明 shiming.y@qq.com
 * @LastEditTime: 2025-04-22 17:06:53
 * @FilePath: /meeting_record/src/utils/file.ts
 * @Description: 文件处理相关工具函数
 */

/**
 * 从URL获取文本文件内容
 * @param url 文件URL
 * @returns 文件内容，如果获取失败则返回null
 */
export async function fetchTextFromUrl(url: string): Promise<string | null> {
    try {

        if (!url || typeof url !== 'string' || !/^https?:\/\//.test(url)) {
            throw new Error(`Invalid URL: "${url}"`);
        }

        const response = await fetch(url);

        if (!response.ok) {
            throw new Error('Network response was not ok');
        }

        const text = await response.text();
        return text;
    } catch (error) {
        console.error('Error fetching the text file:', error);
        return null;
    }
}