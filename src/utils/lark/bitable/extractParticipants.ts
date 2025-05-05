/*
 * @Author: 杨仕明 shiming.y@qq.com
 * @Date: 2025-05-05 14:52:58
 * @LastEditors: 杨仕明 shiming.y@qq.com
 * @LastEditTime: 2025-05-05 14:53:09
 * @FilePath: /meeting_record/src/utils/lark/bitable/extractParticipants.ts
 * @Description: 
 * 
 * Copyright (c) 2025 by ${git_name_email}, All Rights Reserved. 
 */

export const extractParticipants = (text: string): string[] => {
    const regex = /^([^\(\):\n]+(?:（[^）]*）)?)(?=\(\d{2}:\d{2}:\d{2}\))/gm;
    const namesSet = new Set<string>();
    let match;

    while ((match = regex.exec(text)) !== null) {
        const name = match[1].trim();
        if (name) {
            namesSet.add(name);
        }
    }

    return Array.from(namesSet);
};