/*
 * @Author: 杨仕明 shiming.y@qq.com
 * @Date: 2025-04-21 14:47:31
 * @LastEditors: 杨仕明 shiming.y@qq.com
 * @LastEditTime: 2025-05-04 20:16:58
 * @FilePath: /meeting_record/src/utils/lark/bitable/fieldExtractors.ts
 * @Description:
 *
 * Copyright (c) 2025 by ${git_name_email}, All Rights Reserved. 
 */


type FieldItem = {
    [key: string]: unknown;
};

function isFieldItemArray(field: unknown): field is FieldItem[] {
    return (
        Array.isArray(field) &&
        field.every(item => typeof item === 'object' && item !== null)
    );
}

function extractFieldProps<T extends string>(
    field: unknown,
    key: T
): string {
    if (isFieldItemArray(field)) {
        return field
            .map(item => item[key])
            .filter((value): value is string => typeof value === 'string')
            .join(''); // 拼接成一个字符串
    }
    return '';
}

export const extractAllText = (field: unknown) => extractFieldProps(field, 'text');
export const extractAllId = (field: unknown) => extractFieldProps(field, 'id');
export const extractAllUrl = (field: unknown) => extractFieldProps(field, 'url');
export const extractAllName = (field: unknown) => extractFieldProps(field, 'name');

