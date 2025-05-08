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
            params: params,
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

        const response = await client.base.appTableRecord.batchUpdate({
            path: { table_id: tableId },
            data: {
                records: recordsData,
            },
        });
        // console.log(response.data);
        return response.data;
    } catch (error: unknown) {
        if (error instanceof Error) {
            throw new Error(`批量更新记录失败: ${error.message}`);
        }
        throw new Error('批量更新记录失败: 未知错误');
    }
}
