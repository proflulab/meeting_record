/*
 * @Author: 杨仕明 shiming.y@qq.com
 * @Date: 2025-03-21 14:13:42
 * @LastEditors: 杨仕明 shiming.y@qq.com
 * @LastEditTime: 2025-05-06 02:17:15
 * @FilePath: /meeting_record/src/utils/lark/bitable/lark.ts
 * @Description: 飞书API操作工具函数
 */

import * as lark from '@larksuiteoapi/node-sdk';


// 创建飞书客户端实例
const client = new lark.Client({
    appId: process.env.FEISHU_APP_ID!,
    appSecret: process.env.FEISHU_APP_SECRET!,
    disableTokenCache: false
});


// 导出表格字段接口定义
export interface TableField {
    field_name: string;
    type: number;
    property?: {
        options?: {
            name?: string | undefined;
            id?: string | undefined;
            color?: number | undefined;
        }[] | undefined;
        formatter?: string | undefined;
        date_formatter?: string | undefined;
        auto_fill?: boolean | undefined;
        multiple?: boolean | undefined;
        table_id?: string | undefined;
        table_name?: string | undefined;
        back_field_name?: string | undefined;
        auto_serial?: {
            type: "custom" | "auto_increment_number";
            options?: {
                type: "system_number" | "fixed_text" | "created_time";
                value: string;
            }[] | undefined;
        } | undefined;
        location?: {
            input_type: "only_mobile" | "not_limit";
        } | undefined;
        formula_expression?: string | undefined;
        allowed_edit_modes?: {
            manual?: boolean | undefined;
            scan?: boolean | undefined;
        } | undefined;
        min?: number | undefined;
        max?: number | undefined;
        range_customize?: boolean | undefined;
        currency_code?: string | undefined;
        rating?: {
            symbol?: string | undefined;
        } | undefined;
        type?: {
            data_type: number;
            ui_property?: {
                currency_code?: string | undefined;
                formatter?: string | undefined;
                range_customize?: boolean | undefined;
                min?: number | undefined;
                max?: number | undefined;
                date_formatter?: string | undefined;
                rating?: {
                    symbol?: string | undefined;
                } | undefined;
            } | undefined;
            ui_type?: "Number" | "Progress" | "Currency" | "Rating" | "DateTime" | undefined;
        } | undefined;
    } | undefined | null;
    description?: string | undefined;
    is_primary?: boolean | undefined;
    field_id?: string | undefined;
    ui_type?: "Text" | "Email" | "Barcode" | "Number" | "Progress" | "Currency" | "Rating" | "SingleSelect" | "MultiSelect" | "DateTime" | "Checkbox" | "User" | "GroupChat" | "Phone" | "Url" | "Attachment" | "SingleLink" | "Formula" | "DuplexLink" | "Location" | "CreatedTime" | "ModifiedTime" | "CreatedUser" | "ModifiedUser" | "AutoNumber" | "Lookup" | string | undefined;
    is_hidden?: boolean | undefined;
};

/**
 * 获取多维表格的所有字段信息
 * @param appToken 多维表格应用Token
 * @param tableId 表格ID
 * @returns 表格字段数组
 */
export async function getTableFields(appToken: string, tableId: string): Promise<TableField[]> {
    try {
        // 验证参数
        if (!appToken || !tableId) {
            throw new Error('缺少必要的参数：appToken 或 tableId');
        }

        const tableFieldsArray: TableField[] = [];
        for await (const item of await client.bitable.v1.appTableField.listWithIterator({
            path: {
                app_token: appToken,
                table_id: tableId
            }
        })) {
            if (item && item.items) {
                tableFieldsArray.push(...item.items);
            }
        }
        return tableFieldsArray;
    } catch (error: unknown) {
        if (error instanceof Error) {
            throw new Error(`获取表格字段失败: ${error.message}`);
        }
        throw new Error('获取表格字段失败: 未知错误');
    }
}


/**
 * 获取多维表格中的单条记录详情
 * @param appToken 多维表格应用Token
 * @param tableId 表格ID
 * @param recordId 记录ID
 * @returns 记录详情
 */
export async function getTableRecords(appToken: string, tableId: string, recordIds: string): Promise<{
    fields: Record<string, string | number | number | number | boolean | {
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
        avatar_url?: string;
    }> | Array<{
        file_token?: string;
        name?: string;
        type?: string;
        size?: number;
        url?: string;
        tmp_url?: string;
    }>>;
    record_id?: string | undefined;
    created_by?: {
        id?: string | undefined;
        name?: string | undefined;
        en_name?: string | undefined;
        email?: string | undefined;
        avatar_url?: string | undefined;
    } | undefined;
    created_time?: number | undefined;
    last_modified_by?: {
        id?: string | undefined;
        name?: string | undefined;
        en_name?: string | undefined;
        email?: string | undefined;
        avatar_url?: string | undefined;
    } | undefined;
    last_modified_time?: number | undefined;
    shared_url?: string | undefined;
    record_url?: string | undefined;
} | undefined> {
    try {
        // 验证参数
        if (!appToken || !tableId || !recordIds.length) {
            throw new Error('缺少必要的参数：appToken、tableId 或 recordIds');
        }

        const response = await client.bitable.appTableRecord.batchGet({
            path: {
                app_token: appToken,
                table_id: tableId,
            },
            data: {
                record_ids: [recordIds]
            }
        });


        return response.data?.records?.[0];

    } catch (error: unknown) {
        if (error instanceof Error) {
            throw new Error(`获取表格记录失败: ${error.message}`);
        }
        throw new Error('获取表格记录失败: 未知错误');
    }
}


/**
 * 使用迭代器方式搜索多维表格中的所有记录
 * @param appToken 多维表格应用Token
 * @param tableId 表格ID
 * @param filter 搜索过滤条件
 * @param pageSize 每页记录数，默认20
 * @returns 所有匹配的记录数组
 */
export async function searchRecordsWithIterator(
    appToken: string,
    tableId: string,
    pageSize: number = 20,
    field_names?: string[],
    filter?: {
        conjunction?: "and" | "or";
        conditions?: Array<{
            field_name: string;
            operator: "is" | "isNot" | "contains" | "doesNotContain" | "isEmpty" | "isNotEmpty" | "isGreater" | "isGreaterEqual" | "isLess" | "isLessEqual" | "like" | "in";
            value?: Array<string>;
        }>;
        children?: Array<{
            conjunction: "and" | "or";
            conditions?: Array<{
                field_name: string;
                operator: "is" | "isNot" | "contains" | "doesNotContain" | "isEmpty" | "isNotEmpty" | "isGreater" | "isGreaterEqual" | "isLess" | "isLessEqual" | "like" | "in";
                value?: Array<string>;
            }>;
        }>;
    },

): Promise<Array<{
    fields: Record<string, string | number | number | number | boolean | {
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
        avatar_url?: string;
    }> | Array<{
        file_token?: string;
        name?: string;
        type?: string;
        size?: number;
        url?: string;
        tmp_url?: string;
    }>>;
    record_id?: string;
    created_by?: {
        id?: string;
        name?: string;
        en_name?: string;
        email?: string;
        avatar_url?: string;
    };
    created_time?: number;
    last_modified_by?: {
        id?: string;
        name?: string;
        en_name?: string;
        email?: string;
        avatar_url?: string;
    };
    last_modified_time?: number;
    shared_url?: string;
    record_url?: string;
}>> {
    try {
        // 验证参数
        if (!appToken || !tableId) {
            throw new Error('缺少必要的参数：appToken、tableId');
        }

        const recordsArray = [];
        for await (const item of await client.bitable.appTableRecord.searchWithIterator({
            path: {
                app_token: appToken,
                table_id: tableId
            },
            params: {
                page_size: pageSize
            },
            data: {
                filter: filter,
                field_names: field_names,
                automatic_fields: true,
            }
        },)) {
            if (item && item.items) {
                recordsArray.push(...item.items);
            }
        }
        return recordsArray;
    } catch (error: unknown) {
        if (error instanceof Error) {
            throw new Error(`搜索表格记录失败: ${error.message}`);
        }
        throw new Error('搜索表格记录失败: 未知错误');
    }
}


/**
 * 搜索多维表格中的单条记录
 * @param appToken 多维表格应用Token
 * @param tableId 表格ID
 * @param searchConditions 搜索条件数组
 * @param searchConjunction 搜索条件连接方式
 * @returns 搜索结果
 */
export async function searchTableRecords(
    appToken: string,
    tableId: string,
    filter?: {
        conjunction?: "and" | "or";
        conditions?: Array<{
            field_name: string;
            operator: "is" | "isNot" | "contains" | "doesNotContain" | "isEmpty" | "isNotEmpty" | "isGreater" | "isGreaterEqual" | "isLess" | "isLessEqual" | "like" | "in";
            value?: Array<string>;
        }>;
        children?: Array<{
            conjunction: "and" | "or";
            conditions?: Array<{
                field_name: string;
                operator: "is" | "isNot" | "contains" | "doesNotContain" | "isEmpty" | "isNotEmpty" | "isGreater" | "isGreaterEqual" | "isLess" | "isLessEqual" | "like" | "in";
                value?: Array<string>;
            }>;
        }>;
    },
): Promise<
    {
        fields: Record<string, string | number | number | number | boolean | {
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
            avatar_url?: string;
        }> | Array<{
            file_token?: string;
            name?: string;
            type?: string;
            size?: number;
            url?: string;
            tmp_url?: string;
        }>>;
        record_id?: string | undefined;
        created_by?: {
            id?: string | undefined;
            name?: string | undefined;
            en_name?: string | undefined;
            email?: string | undefined;
            avatar_url?: string | undefined;
        } | undefined;
        created_time?: number | undefined;
        last_modified_by?: {
            id?: string | undefined;
            name?: string | undefined;
            en_name?: string | undefined;
            email?: string | undefined;
            avatar_url?: string | undefined;
        } | undefined;
        last_modified_time?: number | undefined;
        shared_url?: string | undefined;
        record_url?: string | undefined;
    } | undefined
> {
    try {
        // 验证参数
        if (!appToken || !tableId || !filter) {
            throw new Error('缺少必要的参数：appToken、tableId 或 filter');
        }

        const response = await client.bitable.appTableRecord.search({
            path: {
                app_token: appToken,
                table_id: tableId
            },
            data: {
                filter: filter,
                automatic_fields: false,
            },
        });

        // 检查 response.data 和 items 数组是否存在且不为空
        if (!response.data?.items || response.data.items.length === 0) {
            return undefined;
        }

        return response.data.items[0];
    } catch (error: unknown) {
        if (error instanceof Error) {
            throw new Error(`搜索表格记录失败: ${error.message}`);
        }
        throw new Error('搜索表格记录失败: 未知错误');
    }
}




/**
 * 创建多维表格记录
 * @param appToken 多维表格应用Token
 * @param tableId 表格ID
 * @param processedFields 处理后的字段数据
 * @returns 记录ID
 */
export async function createTableRecord(
    
    appToken: string,
    tableId: string,
    fields: Record<string, string | number | number | number | boolean | {
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
    }>>,
): Promise<{
    record?: {
        fields: Record<string, string | number | number | number | boolean | {
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
            avatar_url?: string;
        }> | Array<{
            file_token?: string;
            name?: string;
            type?: string;
            size?: number;
            url?: string;
            tmp_url?: string;
        }>>;
        record_id?: string | undefined;
        created_by?: {
            id?: string | undefined;
            name?: string | undefined;
            en_name?: string | undefined;
            email?: string | undefined;
            avatar_url?: string | undefined;
        } | undefined;
        created_time?: number | undefined;
        last_modified_by?: {
            id?: string | undefined;
            name?: string | undefined;
            en_name?: string | undefined;
            email?: string | undefined;
            avatar_url?: string | undefined;
        } | undefined;
        last_modified_time?: number | undefined;
        shared_url?: string | undefined;
        record_url?: string | undefined;
    } | undefined
} | undefined> {
    try {
        if (!appToken || !tableId || !fields) {
            throw new Error('缺少必要的参数：appToken、tableId 或 processedFields');
        }

        const response = await client.bitable.appTableRecord.create({
            path: {
                app_token: appToken,
                table_id: tableId,
            },
            data: {
                fields: fields,
            }
        });

        return response.data;
        
    } catch (error: unknown) {
        if (error instanceof Error) {
            throw new Error(`创建B表记录失败: ${error.message}`);
        }
        throw new Error('创建B表记录失败: 未知错误');
    }
}

/**
 * 更新多维表格记录
 * @param appToken 多维表格应用Token
 * @param tableId 表格ID
 * @param recordId 记录ID
 * @param fields 待更新的字段数据
 * @returns 更新记录数据详情
 */
export async function updateTableRecord(
    appToken: string,
    tableId: string,
    recordId: string,
    fields: Record<string, string | number | number | number | boolean | {
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
    }>>,
): Promise<{
    record?: {
        fields: Record<string, string | number | number | number | boolean | {
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
            avatar_url?: string;
        }> | Array<{
            file_token?: string;
            name?: string;
            type?: string;
            size?: number;
            url?: string;
            tmp_url?: string;
        }>>;
        record_id?: string | undefined;
        created_by?: {
            id?: string | undefined;
            name?: string | undefined;
            en_name?: string | undefined;
            email?: string | undefined;
            avatar_url?: string | undefined;
        } | undefined;
        created_time?: number | undefined;
        last_modified_by?: {
            id?: string | undefined;
            name?: string | undefined;
            en_name?: string | undefined;
            email?: string | undefined;
            avatar_url?: string | undefined;
        } | undefined;
        last_modified_time?: number | undefined;
        shared_url?: string | undefined;
        record_url?: string | undefined;
    } | undefined;
} | undefined> {
    try {
        if (!appToken || !tableId || !recordId || !fields) {
            throw new Error('缺少必要的参数：appToken、tableId、recordId 或 processedFields');
        }

        const result = await client.bitable.appTableRecord.update({
            path: {
                app_token: appToken,
                table_id: tableId,
                record_id: recordId,
            },
            data: {
                fields: fields,
            }
        });

        return result.data

    } catch (error: unknown) {
        if (error instanceof Error) {
            throw new Error(`更新表记录失败: ${error.message}`);
        }
        throw new Error('更新表记录失败: 未知错误');
    }
}




