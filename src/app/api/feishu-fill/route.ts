import { findAllRecordsByUniqueKey } from '@/utils/lark/bitable/bitable';
import { createTableRecord } from '@/utils/lark/bitable/lark';
import { NextResponse } from 'next/server';
import { updateTableRecord } from '@/utils/lark/bitable/lark';

// --- SDK Client 初始化 ---

const APP_TOKEN = process.env.LARK_BASE_APP_TOKEN!;
const TABLE_ID = process.env.LARK_TABLE_ID!;
const UNIQUE_KEY = process.env.LARK_UNIQUE_ID_FIELD_NAME || '学生学号';

import { Client } from '@larksuiteoapi/node-sdk';

const APP_ID = process.env.FEISHU_APP_ID || '';
const APP_SECRET = process.env.FEISHU_APP_SECRET || '';

const client = new Client({
  appId: APP_ID,
  appSecret: APP_SECRET,
});


// -------- 你的字段映射和类型等配置 --------
const FIELD_MAP: Record<string, string> = {
  fldlL1m9q7: '学生学号',
  fldxigqLo3: '详细地址',
  fldYwzPXH3: '记录ID',
  flds7lKeaT: '姓名',
  fld94Hs9TY: '序号',
  fldWtRwpEE: 'country',
  fldpGScIhH: 'Postal Code'
};

const FIELD_TYPES: Record<string, 'text' | 'user'> = {
  '学生学号': 'text',
  '详细地址': 'text',
  '记录ID': 'text',
  'country': 'text',
  '序号': 'text',
  '姓名': 'user',
  'Postal Code': 'text'
};

// -------- 工具函数 --------
async function logToDatabase(log: Record<string, unknown>) {
  console.log('🔖 操作日志:', JSON.stringify(log));
}

function isDeepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a == null || b == null) return false;
  return JSON.stringify(a) === JSON.stringify(b);
}

function parseSingleFieldValue(
  fieldId: string,
  fieldValue: unknown,
  fieldIdentityValue?: Record<string, unknown>
): unknown {
  const fieldName = FIELD_MAP[fieldId];
  if (!fieldName) {
    return fieldValue;
  }

  let val: any = fieldValue;
  if (typeof val === 'string') {
    try {
      val = JSON.parse(val);
    } catch {}
  }

  if (fieldName === '记录ID') {
    if (Array.isArray(val)) {
      const first = val[0];
      return first?.record_id || first?.id || first?.text || '';
    }
    if (val && typeof val === 'object') {
      return val.record_id || val.id || val.text || '';
    }
    return String(val || '');
  }

  if (FIELD_TYPES[fieldName] === 'user') {
    const usersFromIdentity = fieldIdentityValue?.users || [];
    const usersFromValue = Array.isArray(val) ? val : val?.users || [];
    const allUsers = Array.isArray(usersFromIdentity) && usersFromIdentity.length > 0 ? usersFromIdentity : usersFromValue;

    if (!Array.isArray(allUsers) || allUsers.length === 0) {
      console.warn('用户字段解析失败: 没有找到有效的用户数据');
      return [];
    }

    const parsedUsers = allUsers.map((u: any) => {
      if (typeof u === 'string') {
        return { id: u };
      }
      if (u.user_id && typeof u.user_id === 'object' && u.user_id.open_id) {
        return {
          id: u.user_id.open_id,
          name: u.name || u.en_name,
          avatar_url: u.avatar_url
        };
      }
      if (u.open_id) {
        return {
          id: u.open_id,
          name: u.name || u.en_name,
          avatar_url: u.avatar_url
        };
      }
      if (u.userId) {
        return { id: u.userId, name: u.name };
      }
      console.warn('无法解析用户数据:', u);
      return null;
    }).filter((x): x is { id: string; name?: string; avatar_url?: string } =>
      x !== null && typeof x.id === 'string'
    );

    return parsedUsers;
  }

  if (FIELD_TYPES[fieldName] === 'text') {
    if (Array.isArray(val)) {
      return val.map((item: any) => {
        if (typeof item === 'string') return item;
        if (typeof item === 'object') {
          if (item.text) return item.text;
          if (item.number) return item.number;
          if (item.value) return item.value;
          return String(item);
        }
        return String(item);
      }).join('');
    }
    if (val && typeof val === 'object') {
      if (val.text) return val.text;
      if (val.number) return val.number;
      if (val.value) return val.value;
      return String(val);
    }
    return String(val || '');
  }

  return val;
}

function parseChangedFields(
  beforeList: Array<{ field_id: string; field_value: unknown; field_identity_value?: Record<string, unknown> }>,
  afterList: Array<{ field_id: string; field_value: unknown; field_identity_value?: Record<string, unknown> }>
): { changedFields: Record<string, unknown>; allFields: Record<string, unknown> } {
  const changedFields: Record<string, unknown> = {};
  const allFields: Record<string, unknown> = {};
  const beforeMap: Record<string, unknown> = {};

  for (const item of beforeList || []) {
    const name = FIELD_MAP[item.field_id];
    if (!name) continue;
    beforeMap[name] = parseSingleFieldValue(item.field_id, item.field_value, item.field_identity_value);
  }

  for (const item of afterList || []) {
    const name = FIELD_MAP[item.field_id];
    if (!name) continue;
    const parsed = parseSingleFieldValue(item.field_id, item.field_value, item.field_identity_value);
    allFields[name] = parsed;
    if (!isDeepEqual(beforeMap[name], parsed)) {
      changedFields[name] = parsed;
    }
  }

  return { changedFields, allFields };
}

interface ChangeAction {
  action: string;
  record_id: string;
  before_value: Array<{ field_id: string; field_value: unknown; field_identity_value?: Record<string, unknown> }>;
  after_value: Array<{ field_id: string; field_value: unknown; field_identity_value?: Record<string, unknown> }>;
}

interface ProcessResult {
  success: boolean;
  operation?: 'create' | 'update' | 'skip';
  recordId?: string;
  message?: string;
  duration?: number;
}

// -------- 用 SDK 进行记录操作 --------
async function updateRecordWithSDK(
  recordId: string,
  fields: Record<string, any>
): Promise<void> {
  try {
    console.log(`正在更新记录 ${recordId}，字段:`, fields);
    
    // 使用环境变量中的配置
    const result = await updateTableRecord(APP_TOKEN, TABLE_ID, recordId, fields);
    
    console.log('更新记录成功:', result);
  } catch (error) {
    console.error('更新记录失败:', error);
    throw error;
  }
}

async function createRecordWithSDK(
  fields: Record<string, any>
): Promise<{ record_id: string }> {
  try {
    console.log('正在创建新记录，字段:', fields);
    
    // 使用环境变量中的配置
    const result = await createTableRecord(APP_TOKEN, TABLE_ID, fields);
    
    if (!result?.record?.record_id) {
      throw new Error('创建失败：未返回 record 或 record_id');
    }
    
    console.log('创建记录成功:', result);
    return { record_id: result.record.record_id };
  } catch (error) {
    console.error('创建记录失败:', error);
    throw error;
  }
}

async function handleRecordChange(action: ChangeAction): Promise<ProcessResult> {
  const start = Date.now();
  try {
    const { changedFields: fields, allFields } = parseChangedFields(action.before_value, action.after_value);
    const uniqueValue = allFields[UNIQUE_KEY];
    if (!uniqueValue) {
      throw new Error(`缺少唯一标识字段 ${UNIQUE_KEY}`);
    }

    if (!APP_TOKEN || !TABLE_ID) {
      throw new Error(`缺少必要的环境变量: APP_TOKEN=${!!APP_TOKEN}, TABLE_ID=${!!TABLE_ID}`);
    }

    const existingIds = await findAllRecordsByUniqueKey(TABLE_ID, UNIQUE_KEY, String(uniqueValue));

    if (existingIds.length > 0) {
      if (Object.keys(fields).length === 0) {
        await logToDatabase({ action: 'skip', recordIds: existingIds, uniqueValue, reason: 'no_changes' });
        return { success: true, operation: 'skip', duration: Date.now() - start };
      }

      // 过滤有效字段
      const filteredFields: Record<string, any> = {};
      for (const [fieldName, value] of Object.entries(fields)) {
        if (FIELD_TYPES[fieldName] === 'user') {
          if (Array.isArray(value) && value.length > 0 && value.every((u: any) => u.id)) {
            filteredFields[fieldName] = value;
          }
        } else if (FIELD_TYPES[fieldName] === 'text') {
          if (value !== '' && value != null) {
            filteredFields[fieldName] = value;
          }
        } else if (value != null && value !== '') {
          filteredFields[fieldName] = value;
        }
      }

      if (Object.keys(filteredFields).length === 0) {
        await logToDatabase({ action: 'skip', recordIds: existingIds, uniqueValue, reason: 'no_valid_changes' });
        return { success: true, operation: 'skip', duration: Date.now() - start };
      }

      await logToDatabase({ action: 'update-start', recordIds: existingIds, fields: filteredFields });

      for (const recordId of existingIds) {
        console.log(`正在更新记录 ${recordId}，字段:`, filteredFields);
        await updateRecordWithSDK(recordId, filteredFields);
      }

      await logToDatabase({ action: 'update-success', recordIds: existingIds, duration: Date.now() - start });
      return {
        success: true,
        operation: 'update',
        recordId: existingIds.join(','),
        duration: Date.now() - start
      };
    }

    // 没有找到，创建新记录
    const payload: Record<string, any> = {};
    for (const [k, v] of Object.entries(allFields)) {
      if (FIELD_TYPES[k] === 'user') {
        if (Array.isArray(v) && v.length > 0 && v.every((u: any) => u.id)) {
          payload[k] = v;
        }
      } else if (v !== '' && !(Array.isArray(v) && v.length === 0)) {
        payload[k] = v;
      }
    }

    console.log('Creating new record with payload:', JSON.stringify(payload, null, 2));
    
    // 使用统一的 SDK 方法创建记录
    const record = await createRecordWithSDK(payload);

    await logToDatabase({ action: 'create-success', recordId: record.record_id, fields: payload });
    return {
      success: true,
      operation: 'create',
      recordId: record.record_id,
      duration: Date.now() - start
    };
  } catch (err: any) {
    console.error('处理记录变更失败:', err);
    await logToDatabase({
      action: 'error',
      message: err.message,
      stack: err.stack,
      appToken: APP_TOKEN ? `${APP_TOKEN.substring(0, 10)}...` : 'missing',
      tableId: TABLE_ID || 'missing',
      timestamp: new Date().toISOString()
    });
    return { success: false, message: err.message, duration: Date.now() - start };
  }
}

// --- Next.js API Handler ---

export async function POST(request: Request) {
  try {
    const data = await request.json();
    console.log('Received webhook data:', JSON.stringify(data, null, 2));
    
    const actions: ChangeAction[] = Array.isArray(data) ? data : data.action_list || [];
    if (!actions.length) {
      return NextResponse.json({ success: false, message: '没有 action_list 数据' }, { status: 400 });
    }
    
    console.log(`Processing ${actions.length} actions`);
    const results = await Promise.all(actions.map(handleRecordChange));
    
    return NextResponse.json({ 
      success: true, 
      accepted: actions.length, 
      results,
      summary: {
        created: results.filter(r => r.operation === 'create').length,
        updated: results.filter(r => r.operation === 'update').length,
        skipped: results.filter(r => r.operation === 'skip').length,
        failed: results.filter(r => !r.success).length
      }
    });
  } catch (error: any) {
    console.error('Webhook处理失败:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function GET() {
  return new NextResponse(
    JSON.stringify({ 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      config: {
        table_id: TABLE_ID,
        unique_key: UNIQUE_KEY,
        field_map: FIELD_MAP,
        app_token_configured: !!APP_TOKEN
      }
    }),
    { status: 200, headers: { 'Access-Control-Allow-Origin': '*' } }
  );
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    }
  });
}