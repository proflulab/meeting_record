/*
 * @Author: 杨仕明 shiming.y@qq.com
 * @Date: 2025-04-21 14:47:31
 * @LastEditors: 杨仕明 shiming.y@qq.com
 * @LastEditTime: 2025-05-03 23:37:58
 * @FilePath: /meeting_record/src/utils/lark/bitable/fieldExtractors.ts
 * @Description:
 *
 * Copyright (c) 2025 by ${git_name_email}, All Rights Reserved. 
 */


type FieldItem = {
    [key: string]: unknown;
};

function isFieldItemArray(field: unknown): field is FieldItem[] {
    return Array.isArray(field) && typeof field[0] === "object" && field[0] !== null;
}

export function extractFieldProp<T extends string>(
    field: unknown,
    key: T
): string | undefined {
    if (isFieldItemArray(field)) {
        const value = field[0][key];
        return typeof value === "string" ? value : undefined;
    }
    return undefined;
}

export const extractText = (field: unknown) => extractFieldProp(field, "text");
export const extractId = (field: unknown) => extractFieldProp(field, "id");
export const extractUrl = (field: unknown) => extractFieldProp(field, "url");
export const extractName = (field: unknown) => extractFieldProp(field, "name");
