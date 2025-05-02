/*
 * @Author: 杨仕明 shiming.y@qq.com
 * @Date: 2025-05-02 21:27:05
 * @LastEditors: 杨仕明 shiming.y@qq.com
 * @LastEditTime: 2025-05-02 21:27:12
 * @FilePath: /meeting_record/src/utils/lark/pick-request-data.ts
 * @Description: 
 * 
 * Copyright (c) 2025 by ${git_name_email}, All Rights Reserved. 
 */

import { NextRequest } from 'next/server'

export async function pickRequestData(req: NextRequest): Promise<Record<string, string | File>> {
    const contentType = req.headers.get('content-type') || ''
    if (contentType.includes('application/json')) {
        return await req.json()
    }
    if (contentType.includes('application/x-www-form-urlencoded')) {
        const txt = await req.text()
        return Object.fromEntries(new URLSearchParams(txt))
    }
    if (contentType.includes('multipart/form-data')) {
        const form = await req.formData()
        const obj: Record<string, string | File> = {}
        for (const [key, val] of form.entries()) {
            obj[key] = val
        }
        return obj
    }
    // 其它类型按需补充
    return {}
}
