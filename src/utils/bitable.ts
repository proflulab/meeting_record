/*
 * @Author: 杨仕明 shiming.y@qq.com
 * @Date: 2025-03-10 14:13:25
 * @LastEditors: 杨仕明 shiming.y@qq.com
 * @LastEditTime: 2025-03-10 14:57:36
 * @FilePath: /meeting_record/src/utils/bitable.ts
 * @Description: 飞书多维表格操作工具函数
 */

import { BaseClient } from '@lark-base-open/node-sdk';

// 新建 BaseClient，从环境变量中读取 appToken 和 personalBaseToken
const client = new BaseClient({
    appToken: process.env.LARK_BASE_APP_TOKEN || '',
    personalBaseToken: process.env.LARK_BASE_PERSONAL_TOKEN || ''
});


// 记录类型定义
interface IRecord {
    record_id: string;
    fields: Record<string, any>
}


// 错误类型
class BitableError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'BitableError';
    }
}


/**
 * 创建新记录
 * @param records 要创建的记录列表
 * @returns 创建的记录列表
 */
export async function createRecords(tableId: string, records: Omit<IRecord, 'record_id'>[]): Promise<IRecord[]> {
    try {
        const response = await client.base.appTableRecord.batchCreate({
            path: { table_id: tableId },
            data: { records }
        });
        return response?.data?.records || [];
    } catch (error) {
        throw new BitableError(`创建记录失败: ${error.message}`);
    }
}



