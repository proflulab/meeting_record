/*
 * @Author: 杨仕明 shiming.y@qq.com
 * @Date: 2025-03-10 14:13:25
 * @LastEditors: 杨仕明 shiming.y@qq.com
 * @LastEditTime: 2025-05-08 18:20:52
 * @FilePath: /meeting_record/src/utils/lark/bitable/bitable.ts
 * @Description: 飞书多维表格操作工具函数
 */

import { BaseClient } from '@lark-base-open/node-sdk';
import * as fs from 'fs';
import * as path from 'path';

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
 // 添加日志输出
        const response = await client.base.appTableRecord.create({
            path: { table_id: tableId },
            data: {
                fields,
            },
        });
        // console.log(response.data);
        return response.data;
    } catch (error: unknown) {
        if (error instanceof Error) {
            throw new Error(`创建记录失败: ${error.message}`);
        }
        throw new Error('创建记录失败: 未知错误');
    }
}

/** * 更新记录
 * @param tableId 表格ID
 * @param fields 记录字段ID
 * @param fields 记录字段数据
 * @returns 创建的记录列表
 */
export async function updateRecords(tableId: string, recordId: string, fields: Record<string, FieldValue>) {
    try {
        // 验证环境变量配置
        if (!process.env.LARK_BASE_APP_TOKEN || !process.env.LARK_BASE_PERSONAL_TOKEN) {
            throw new Error('缺少必要的飞书多维表格配置，请检查环境变量 LARK_BASE_APP_TOKEN 和 LARK_BASE_PERSONAL_TOKEN');
        }

        const response = await client.base.appTableRecord.update({
            path: { table_id: tableId, record_id: recordId, },
            data: {
                fields,
            },
        });
        // console.log(response.data);
        return response.data;
    } catch (error: unknown) {
        if (error instanceof Error) {
            throw new Error(`创建记录失败: ${error.message}`);
        }
        throw new Error('创建记录失败: 未知错误');
    }
}

/** * 列出记录
 * @param tableId 表格ID
 * @param params 列出条件
 * @returns 列出的记录列表
 */
export async function searchRecords(tableId: string, params: {
    view_id?: string;
    filter?: string;
    sort?: string;
    field_names?: string;
    text_field_as_array?: boolean;
    user_id_type?: "user_id" | "union_id" | "open_id";
    display_formula_ref?: boolean;
    automatic_fields?: boolean;
    page_token?: string;
    page_size?: number;
}) {
    try {
        // 验证环境变量配置
        if (!process.env.LARK_BASE_APP_TOKEN || !process.env.LARK_BASE_PERSONAL_TOKEN) {
            throw new Error('缺少必要的飞书多维表格配置，请检查环境变量 LARK_BASE_APP_TOKEN 和 LARK_BASE_PERSONAL_TOKEN');
        }

        const response = await client.base.appTableRecord.list({
            path: { table_id: tableId },
            params: {
                ...params,
                user_id_type:"open_id", // 确保 user_id_type 默认为 open_id
            },
        });
        // console.log(response.data);
        return response.data;
    } catch (error: unknown) {
        if (error instanceof Error) {
            throw new Error(`创建记录失败: ${error.message}`);
        }
        throw new Error('创建记录失败: 未知错误');
    }
}


/** * 上传文件并创建记录
 * @param filePath 文件路径
 * @param isImage 是否为图片类型
 * @returns 创建的file_token
 */
export async function uploadFile(filePath: string, isImage: boolean = true) {
    try {
        // 验证环境变量配置
        if (!process.env.LARK_BASE_APP_TOKEN || !process.env.LARK_BASE_PERSONAL_TOKEN) {
            throw new Error('缺少必要的飞书多维表格配置，请检查环境变量 LARK_BASE_APP_TOKEN 和 LARK_BASE_PERSONAL_TOKEN');
        }

        // 获取文件信息
        const fileName = path.basename(filePath);
        const fileSize = fs.statSync(filePath).size;
        const fileStream = fs.createReadStream(filePath);

        // 上传文件
        const data = await client.drive.media.uploadAll({
            data: {
                file_name: fileName,
                parent_type: isImage ? 'bitable_image' : 'bitable_file',
                parent_node: client.appToken,
                size: fileSize,
                file: fileStream,
            }
        });

        if (!data) {
            throw new Error('上传文件失败：未获取到文件token');
        }
        return data.file_token;

    } catch (error: unknown) {
        if (error instanceof Error) {
            throw new Error(`上传文件并创建记录失败: ${error.message}`);
        }
        throw new Error('上传文件并创建记录失败: 未知错误');
    }
}


/** * 通过URL上传文件
 * @param fileUrl 文件URL
 * @param fileName 文件名称
 * @param isImage 是否为图片类型
 * @returns 创建的file_token
 */
export async function uploadFileFromUrl(fileUrl: string, fileName: string, isImage: boolean = false) {
    try {
        // 验证环境变量配置
        if (!process.env.LARK_BASE_APP_TOKEN || !process.env.LARK_BASE_PERSONAL_TOKEN) {
            throw new Error('缺少必要的飞书多维表格配置，请检查环境变量');
        }

        // 获取文件内容
        const response = await fetch(fileUrl);

        // 从响应头中获取文件名
        const contentDisposition = response.headers.get('content-disposition');
        let finalFileName = fileName;
        if (contentDisposition) {
            const matches = contentDisposition.toString().match(/filename=(.*)/);
            if (matches && matches[1]) {
                finalFileName = matches[1].replace(/["';]/g, '');
            }
        }

        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const contentLength = buffer.length;

        // 上传文件
        const data = await client.drive.media.uploadAll({
            data: {
                file_name: finalFileName,
                parent_type: isImage ? 'bitable_image' : 'bitable_file',
                parent_node: client.appToken,
                size: contentLength,
                file: buffer,
            }
        });

        if (!data) {
            throw new Error('上传文件失败：未获取到文件token');
        }
        console.log('上传文件成功：', data.file_token);
        return data.file_token;

    } catch (error: unknown) {
        if (error instanceof Error) {
            throw new Error(`通过URL上传文件失败: ${error.message}`);
        }
        throw new Error('通过URL上传文件失败: 未知错误');
    }
}


/** * 批量创建多条记录
 * @param tableId 表格ID
 * @param recordsList 记录字段数据列表
 * @returns 创建的记录列表
 */
export async function batchCreateRecords(tableId: string, recordsList: Record<string, FieldValue>[]) {
    try {
        // 验证环境变量配置
        if (!process.env.LARK_BASE_APP_TOKEN || !process.env.LARK_BASE_PERSONAL_TOKEN) {
            throw new Error('缺少必要的飞书多维表格配置，请检查环境变量 LARK_BASE_APP_TOKEN 和 LARK_BASE_PERSONAL_TOKEN');
        }

        // 构建记录数据结构
        const records = recordsList.map(fields => ({ fields }));

        const response = await client.base.appTableRecord.batchCreate({
            path: { table_id: tableId },
            data: {
                records,
            },
        });
        // console.log(response.data);
        return response.data;
    } catch (error: unknown) {
        if (error instanceof Error) {
            throw new Error(`批量创建记录失败: ${error.message}`);
        }
        throw new Error('批量创建记录失败: 未知错误');
    }
}

/** * 批量更新多条记录
 * @param tableId 表格ID
 * @param recordsData 记录数据列表，每条包含记录ID和字段数据
 * @returns 更新的记录列表
 */
export async function batchUpdateRecords(tableId: string, recordsData: Array<{
    record_id: string;
    fields: Record<string, FieldValue>;
}>) {
    try {
        // 验证环境变量配置
        if (!process.env.LARK_BASE_APP_TOKEN || !process.env.LARK_BASE_PERSONAL_TOKEN) {
            throw new Error('缺少必要的飞书多维表格配置，请检查环境变量 LARK_BASE_APP_TOKEN 和 LARK_BASE_PERSONAL_TOKEN');
        }
        console.log('飞书 createRecords API 调用参数:', JSON.stringify({ recordsData }, null, 2));
        const response = await client.base.appTableRecord.batchUpdate({
            path: { table_id: tableId },
            data: {
                records: recordsData,
            },
        });
        console.log('飞书 batchUpdateRecords API 完整返回:', JSON.stringify(response, null, 2)); // 添加日志输出
        return response.data;
    } catch (error: unknown) {
        if (error instanceof Error) {
            throw new Error(`批量更新记录失败: ${error.message}`);
        }
        throw new Error('批量更新记录失败: 未知错误');
    }
}

/** * 通过唯一键查找记录
 * @param tableId 表格ID
 * @param uniqueKeyField 唯一键字段名
 * @param uniqueKeyValue 唯一键字段值
 * @returns 找到的记录ID，如果未找到或找到多个则返回 null
 */
export async function findRecordByUniqueKey(tableId: string, uniqueKeyField: string, uniqueKeyValue: string): Promise<string | null> {
    try {
        // 验证环境变量配置
        if (!process.env.LARK_BASE_APP_TOKEN || !process.env.LARK_BASE_PERSONAL_TOKEN) {
            throw new Error('缺少必要的飞书多维表格配置，请检查环境变量 LARK_BASE_APP_TOKEN 和 LARK_BASE_PERSONAL_TOKEN');
        }

        // 构建过滤器，精确匹配唯一键字段
        // 注意：字段名需要用方括号括起来，字符串值需要用双引号括起来
        const filter = `CurrentValue.[${uniqueKeyField}]="${uniqueKeyValue}"`;

        console.log(`Searching in table ${tableId} with filter: ${filter}`);

        const response = await client.base.appTableRecord.list({
            path: { table_id: tableId },
            params: {
                filter: filter,
                page_size: 2 // 只需检查是否存在以及是否唯一
            },
        });

        if (response.data && response.data.items && response.data.items.length === 1) {
            console.log(`Found record with unique key ${uniqueKeyValue}: ${response.data.items[0].record_id}`);
            return response.data.items[0].record_id || null;
        } else if (response.data && response.data.items && response.data.items.length > 1) {
            console.warn(`Found multiple records with unique key ${uniqueKeyValue} in table ${tableId}. Cannot determine unique record.`);
            return null; // 找到多个记录，无法确定唯一性
        } else {
            console.log(`No record found with unique key ${uniqueKeyValue} in table ${tableId}.`);
            return null; // 未找到记录
        }
    } catch (error: unknown) {
        if (error instanceof Error) {
            console.error(`通过唯一键查找记录失败 (${uniqueKeyValue}): ${error.message}`);
            throw new Error(`通过唯一键查找记录失败: ${error.message}`);
        }
        console.error(`通过唯一键查找记录失败 (${uniqueKeyValue}): 未知错误`);
        throw new Error('通过唯一键查找记录失败: 未知错误');
    }
}

/**
 * 通过唯一键查找所有匹配记录ID
 * @param tableId 表格ID
 * @param uniqueKeyField 唯一键字段名
 * @param uniqueKeyValue 唯一键字段值
 * @returns 匹配的所有记录ID数组
 */
export async function findAllRecordsByUniqueKey(tableId: string, uniqueKeyField: string, uniqueKeyValue: string): Promise<string[]> {
    try {
        if (!process.env.LARK_BASE_APP_TOKEN || !process.env.LARK_BASE_PERSONAL_TOKEN) {
            throw new Error('缺少必要的飞书多维表格配置，请检查环境变量 LARK_BASE_APP_TOKEN 和 LARK_BASE_PERSONAL_TOKEN');
        }
        const filter = `CurrentValue.[${uniqueKeyField}]=\"${uniqueKeyValue}\"`;
        let pageToken = undefined;
        let allIds: string[] = [];
        do {
            const response = await client.base.appTableRecord.list({
                path: { table_id: tableId },
                params: {
                    filter,
                    page_size: 100,
                    page_token: pageToken
                },
            });
            const items = response.data?.items || [];
            allIds.push(...items.map((item: any) => item.record_id));
            pageToken = response.data?.page_token;
        } while (pageToken);
        return allIds;
    } catch (error: unknown) {
        if (error instanceof Error) {
            throw new Error(`通过唯一键查找所有记录失败: ${error.message}`);
        }
        throw new Error('通过唯一键查找所有记录失败: 未知错误');
    }
}
