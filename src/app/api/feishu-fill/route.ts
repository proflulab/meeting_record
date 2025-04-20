import { BaseClient } from '@lark-base-open/node-sdk';
import { updateRecords } from '../../../utils/bitable'; // Adjusted import path
import { NextResponse } from 'next/server';

// 从环境变量读取配置
const APP_TOKEN = process.env.LARK_BASE_APP_TOKEN;
const PERSONAL_BASE_TOKEN = process.env.LARK_BASE_PERSONAL_TOKEN;
const TABLEID = process.env.LARK_TABLE_ID;

// 检查环境变量是否已设置
if (!APP_TOKEN || !PERSONAL_BASE_TOKEN || !TABLEID) {
  console.error('Missing required environment variables: LARK_BASE_APP_TOKEN, LARK_BASE_PERSONAL_TOKEN, or LARK_TABLE_ID');
  // For API route, return error response instead of throwing
  // throw new Error('Missing required environment variables: LARK_BASE_APP_TOKEN, LARK_BASE_PERSONAL_TOKEN, or LARK_TABLE_ID');
}

// 新建 BaseClient (needed for get record)
const client = new BaseClient({
  appToken: APP_TOKEN,
  personalBaseToken: PERSONAL_BASE_TOKEN
});

// 目标记录 ID 和替换值
const TARGET_RECORD_ID = 'rec2SmXuwO';
const OLD_VALUE = 'lulab';
const NEW_VALUE = 'check';

async function updateSpecificRecord() {
  // Check for missing env vars again inside the function in case it's called elsewhere
  if (!APP_TOKEN || !PERSONAL_BASE_TOKEN || !TABLEID) {
    return { success: false, message: 'Missing required environment variables.' };
  }

  try {
    // 1. 获取目标记录的当前数据
    const getRes = await client.base.appTableRecord.get({
      path: {
        table_id: TABLEID,
        record_id: TARGET_RECORD_ID,
      },
    });

    if (!getRes.data || !getRes.data.record) {
      const message = `Record with ID ${TARGET_RECORD_ID} not found.`;
      console.error(message);
      return { success: false, message };
    }

    const currentFields = getRes.data.record.fields;
    const fieldsToUpdate: Record<string, any> = {};

    // 2. 查找值为 OLD_VALUE 的字段并准备更新
    for (const fieldName in currentFields) {
      const fieldValue = currentFields[fieldName];

      // Simple text check
      if (typeof fieldValue === 'string' && fieldValue === OLD_VALUE) {
        fieldsToUpdate[fieldName] = NEW_VALUE;
      }
      // Add check for Lark's rich text format (array of objects)
      else if (Array.isArray(fieldValue)) {
        const potentialRichText = fieldValue as any[];
        // Basic check for rich text structure
        if (potentialRichText.length > 0 && typeof potentialRichText[0] === 'object' && potentialRichText[0]?.type && potentialRichText[0]?.content) {
            let updated = false;
            const newRichTextValue = potentialRichText.map(block => {
                if (block.content && Array.isArray(block.content)) {
                    const newContent = block.content.map((item: any) => {
                        if (item.text && typeof item.text === 'string' && item.text.includes(OLD_VALUE)) {
                            updated = true;
                            return { ...item, text: item.text.replace(new RegExp(OLD_VALUE, 'g'), NEW_VALUE) };
                        }
                        return item;
                    });
                    return { ...block, content: newContent };
                }
                return block;
            });

            if (updated) {
                fieldsToUpdate[fieldName] = newRichTextValue;
            }
        }
      }
      // Add checks for other field types if necessary (e.g., numbers, select options)
    }

    // 3. 如果找到需要更新的字段，则调用 updateRecords
    if (Object.keys(fieldsToUpdate).length > 0) {
      console.log(`Updating record ${TARGET_RECORD_ID} with fields:`, JSON.stringify(fieldsToUpdate));
      // updateRecords function from bitable.ts handles its own Lark client and env var checks
      await updateRecords(TABLEID, TARGET_RECORD_ID, fieldsToUpdate);
      const message = `Successfully updated record ${TARGET_RECORD_ID}. Fields updated: ${Object.keys(fieldsToUpdate).join(', ')}`;
      console.log(message);
      return { success: true, message };
    } else {
      const message = `No fields with value "${OLD_VALUE}" found in record ${TARGET_RECORD_ID}. No update performed.`;
      console.log(message);
      return { success: true, message }; // Success because the operation completed, even if no changes were made.
    }

  } catch (error: any) {
    const message = `Error updating record ${TARGET_RECORD_ID}: ${error.message || error}`;
    console.error(message, error);
    return { success: false, message };
  }
}

// API Route Handler (e.g., GET)
export async function GET() {
    console.log(`API route /api/feishu-fill called (GET) for record: ${TARGET_RECORD_ID}`);
    const result = await updateSpecificRecord();
    return NextResponse.json(result, { status: result.success ? 200 : 500 });
}

// You might want a POST handler if this action modifies data
// export async function POST(request: Request) {
//     console.log(`API route /api/feishu-fill called (POST) for record: ${TARGET_RECORD_ID}`);
//     // Potentially read data from request body if needed
//     // const body = await request.json();
//     const result = await updateSpecificRecord();
//     return NextResponse.json(result, { status: result.success ? 200 : 500 });
// }
