// src/app/api/feishu-fill/route.ts

import { findAllRecordsByUniqueKey } from '@/utils/lark/bitable/bitable';
import { createTableRecord, updateTableRecord } from '@/utils/lark/bitable/lark';
import { NextResponse } from 'next/server';

/* eslint-disable @typescript-eslint/no-explicit-any */

const APP_TOKEN = process.env.LARK_BASE_APP_TOKEN!;
const TABLE_ID = process.env.LARK_TABLE_ID!;
const UNIQUE_KEY = process.env.LARK_UNIQUE_ID_FIELD_NAME || '学生学号';

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

// Remove the unused logToDatabase function
// async function logToDatabase(log: Record<string, unknown>) {
//   console.log('🔖 操作日志:', JSON.stringify(log));
// }

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
  let val: unknown = fieldValue;
  if (typeof val === 'string') {
    try { val = JSON.parse(val); } catch {}
  }

  if (fieldName === '记录ID') {
    if (Array.isArray(val)) {
      const first = val[0] as any;
      return first?.record_id ?? first?.id ?? first?.text ?? '';
    }
    if (typeof val === 'object' && val !== null) {
      const v = val as any;
      return v.record_id ?? v.id ?? v.text ?? '';
    }
    return String(val ?? '');
  }

  if (FIELD_TYPES[fieldName!] === 'user') {
    const allUsers = Array.isArray(fieldIdentityValue?.users)
      ? (fieldIdentityValue?.users as any[])
      : Array.isArray(val) ? val as any[] : (val as any)?.users ?? [];
    if (!Array.isArray(allUsers) || allUsers.length === 0) {
      return [];
    }
    return allUsers.map((u: any) => {
      if (typeof u === 'string') return { id: u };
      const open_id = u.user_id?.open_id ?? u.open_id ?? u.userId;
      const name = u.name ?? u.en_name;
      return { id: open_id, name, avatar_url: u.avatar_url };
    }).filter((x): x is { id: string; name?: string; avatar_url?: string } => !!x.id);
  }

  if (FIELD_TYPES[fieldName!] === 'text') {
    if (Array.isArray(val)) {
      return (val as any[]).map(item => typeof item === 'string'
        ? item
        : (item as any).text ?? (item as any).number ?? (item as any).value ?? String(item)
      ).join('');
    }
    if (typeof val === 'object' && val !== null) {
      const v = val as any;
      return v.text ?? v.number ?? v.value ?? String(v);
    }
    return String(val ?? '');
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

async function updateRecordWithSDK(recordId: string, fields: Record<string, any>): Promise<void> {
  await updateTableRecord(APP_TOKEN, TABLE_ID, recordId, fields);
}

async function createRecordWithSDK(fields: Record<string, any>): Promise<{ record_id: string }> {
  const result = await createTableRecord(APP_TOKEN, TABLE_ID, fields);
  if (!result?.record?.record_id) throw new Error('创建失败');
  return { record_id: result.record.record_id };
}

async function handleRecordChange(action: ChangeAction): Promise<ProcessResult> {
  const start = Date.now();
  try {
    const { changedFields: fields, allFields } = parseChangedFields(action.before_value, action.after_value);
    const uniqueValue = allFields[UNIQUE_KEY];
    if (!uniqueValue) throw new Error(`缺少唯一字段 ${UNIQUE_KEY}`);
    const existingIds = await findAllRecordsByUniqueKey(TABLE_ID, UNIQUE_KEY, String(uniqueValue));

    if (existingIds.length > 0) {
      if (Object.keys(fields).length === 0) return { success: true, operation: 'skip', duration: Date.now() - start };
      await Promise.all(existingIds.map(id => updateRecordWithSDK(id, fields)));
      return { success: true, operation: 'update', recordId: existingIds.join(','), duration: Date.now() - start };
    }

    const payload = Object.fromEntries(
      Object.entries(allFields).filter(([_, fieldValue]) => fieldValue !== '' && fieldValue != null)
    );
    const { record_id } = await createRecordWithSDK(payload);
    return { success: true, operation: 'create', recordId: record_id, duration: Date.now() - start };
  } catch (err: any) {
    return { success: false, message: err.message, duration: Date.now() - start };
  }
}

export async function POST(request: Request) {
  const data = await request.json();
  const actions: ChangeAction[] = Array.isArray(data) ? data : data?.action_list ?? [];
  if (!actions.length) return NextResponse.json({ success: false, message: '无有效 action_list' }, { status: 400 });

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
}

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    config: { table_id: TABLE_ID, unique_key: UNIQUE_KEY, field_map: FIELD_MAP, app_token_configured: Boolean(APP_TOKEN) }
  }, { status: 200, headers: { 'Access-Control-Allow-Origin': '*' } });
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
