/*
 * @Author: 杨仕明 shiming.y@qq.com
 * @Date: 2025-03-10 14:13:25
 * @LastEditors: 杨仕明 shiming.y@qq.com
 * @LastEditTime: 2025-03-10 22:39:29
 * @FilePath: /meeting_record/src/utils/bitable.ts
 * @Description: 飞书多维表格操作工具函数
 */

import { BaseClient } from '@lark-base-open/node-sdk';

// 新建 BaseClient，从环境变量中读取 appToken 和 personalBaseToken
const client = new BaseClient({
    appToken: process.env.LARK_BASE_APP_TOKEN || '',
    personalBaseToken: process.env.LARK_BASE_PERSONAL_TOKEN || ''
});


/** * 创建新记录
 * @param tableId 表格ID
 * @param fields 记录字段数据
 * @returns 创建的记录列表
 */
// 定义字段值类型
type FieldValue = string | number | boolean | {
    text?: string;
    link?: string;
} | {
    location?: string;
    pname?: string;
    cityname?: string;
    adname?: string;
    address?: string;
    name?: string;
    full_address?: string;
} | Array<{
    id?: string;
    name?: string;
    avatar_url?: string;
}> | Array<string> | Array<{
    id?: string;
    name?: string;
    en_name?: string;
    email?: string;
}> | Array<{
    file_token?: string;
    name?: string;
    type?: string;
    size?: number;
    url?: string;
    tmp_url?: string;
}>;

/** * 创建新记录
 * @param tableId 表格ID
 * @param fields 记录字段数据
 * @returns 创建的记录列表
 */
export async function createRecords(tableId: string, fields: Record<string, FieldValue>) {
    try {
        // 验证环境变量配置
        if (!process.env.LARK_BASE_APP_TOKEN || !process.env.LARK_BASE_PERSONAL_TOKEN) {
            throw new Error('缺少必要的飞书多维表格配置，请检查环境变量 LARK_BASE_APP_TOKEN 和 LARK_BASE_PERSONAL_TOKEN');
        }

        const response = await client.base.appTableRecord.create({
            path: { table_id: tableId },
            data: {
                fields,
            },
        });
        console.log(response.data);
        return response.data;
    } catch (error: unknown) {
        if (error instanceof Error) {
            throw new Error(`创建记录失败: ${error.message}`);
        }
        throw new Error('创建记录失败: 未知错误');
    }
}



