import { getTenantAccessToken } from './bitable'; // Assuming bitable.ts handles token fetching

// Placeholder for target table credentials - THESE MUST BE SET IN ENVIRONMENT VARIABLES
const TARGET_FEISHU_APP_TOKEN = process.env.NEXT_PUBLIC_TARGET_FEISHU_APP_ID;
const TARGET_FEISHU_TABLE_ID = process.env.NEXT_PUBLIC_TARGET_FEISHU_TABLE_ID;
// Note: You might need a separate access token mechanism if the target table is in a different app or tenant
// const TARGET_FEISHU_ACCESS_TOKEN = process.env.NEXT_PUBLIC_TARGET_FEISHU_APP_SECRET;

// --- Helper function to get Target Table Access Token (Adapt if needed) ---
// This assumes the target table uses the same app credentials as the source
// If not, you'll need a separate mechanism to get the target table's token.
async function getTargetAccessToken() {
    // Reusing the existing token logic for now. Adjust if target app is different.
    return getTenantAccessToken();
}

// --- Function to Add a Record to the Target Table ---
async function addRecordToTargetTable(recordData: any) {
    if (!TARGET_FEISHU_APP_TOKEN || !TARGET_FEISHU_TABLE_ID) {
        console.error('Target Feishu App Token or Table ID is not configured.');
        return;
    }

    const accessToken = await getTargetAccessToken();
    if (!accessToken) {
        console.error('Failed to get target access token.');
        return;
    }

    console.log(`
➕ Sync: Attempting to add record to target table ${TARGET_FEISHU_TABLE_ID}`);
    console.log('📋 Data:', JSON.stringify({ fields: recordData.fields }, null, 2));

    try {
        const response = await fetch(
            `https://base-api.larksuite.com/open-apis/bitable/v1/apps/${TARGET_FEISHU_APP_TOKEN}/tables/${TARGET_FEISHU_TABLE_ID}/records`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ fields: recordData.fields })
            }
        );

        const result = await response.json();

        if (!response.ok || result.code !== 0) {
            console.error('Sync: Failed to add record to target table:', {
                status: response.status,
                statusText: response.statusText,
                code: result.code,
                msg: result.msg
            });
        } else {
            console.log(`✅ Sync: Successfully added record ${result?.data?.record?.id} to target table.`);
        }
    } catch (error) {
        console.error('Sync: Error adding record to target table:', error);
    }
}

// --- Function to Update a Record in the Target Table ---
// IMPORTANT: This requires a way to find the corresponding record_id in the target table.
// We assume a field named 'SourceRecordID' exists in the target table to store the source record_id.
// You MUST adapt the 'findTargetRecordId' logic based on your actual linking field.
async function findTargetRecordId(sourceRecordId: string): Promise<string | null> {
    if (!TARGET_FEISHU_APP_TOKEN || !TARGET_FEISHU_TABLE_ID) {
        console.error('Target Feishu App Token or Table ID is not configured.');
        return null;
    }
    const accessToken = await getTargetAccessToken();
    if (!accessToken) {
        console.error('Failed to get target access token.');
        return null;
    }

    // --- Adapt this query --- 
    // This example assumes you have a field named 'SourceRecordID' in the target table
    // that stores the record_id from the source table.
    const filter = `CurrentValue.[SourceRecordID]="${sourceRecordId}"`; 
    const encodedFilter = encodeURIComponent(filter);
    const url = `https://base-api.larksuite.com/open-apis/bitable/v1/apps/${TARGET_FEISHU_APP_TOKEN}/tables/${TARGET_FEISHU_TABLE_ID}/records?filter=${encodedFilter}`;

    console.log(`
🔍 Sync: Searching for target record matching source ID ${sourceRecordId}`);
    console.log('🔗 URL:', url);

    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            }
        });
        const result = await response.json();

        if (!response.ok || result.code !== 0) {
            console.error('Sync: Failed to search for target record:', {
                status: response.status,
                code: result.code,
                msg: result.msg
            });
            return null;
        }

        if (result.data && result.data.items && result.data.items.length > 0) {
            const targetRecordId = result.data.items[0].record_id;
            console.log(`✅ Sync: Found target record ID: ${targetRecordId}`);
            return targetRecordId;
        } else {
            console.log(`⚠️ Sync: No matching target record found for source ID ${sourceRecordId}.`);
            return null;
        }
    } catch (error) {
        console.error('Sync: Error searching for target record:', error);
        return null;
    }
}

async function updateRecordInTargetTable(sourceRecord: any, changes: { field: string, newValue: any }[]) {
    if (!TARGET_FEISHU_APP_TOKEN || !TARGET_FEISHU_TABLE_ID) {
        console.error('Target Feishu App Token or Table ID is not configured.');
        return;
    }

    const accessToken = await getTargetAccessToken();
    if (!accessToken) {
        console.error('Failed to get target access token.');
        return;
    }

    // Find the corresponding record ID in the target table
    const targetRecordId = await findTargetRecordId(sourceRecord.record_id);

    if (!targetRecordId) {
        console.warn(`Sync: Cannot update target table. Record corresponding to source ID ${sourceRecord.record_id} not found.`);
        // Optional: Consider adding the record if it's missing (treat as new)
        // await addRecordToTargetTable(sourceRecord);
        return;
    }

    // Prepare the fields to update
    const fieldsToUpdate = changes.reduce((acc, change) => {
        // You might need to map field names if they differ between tables
        acc[change.field] = change.newValue;
        return acc;
    }, {} as Record<string, any>);

    // Add the linking field if it's not already part of the changes
    // (Ensure the linking field like 'SourceRecordID' is included if needed)
    // if (!fieldsToUpdate['SourceRecordID']) {
    //     fieldsToUpdate['SourceRecordID'] = sourceRecord.record_id;
    // }

    if (Object.keys(fieldsToUpdate).length === 0) {
        console.log(`Sync: No fields to update for target record ${targetRecordId}.`);
        return;
    }

    console.log(`
🔄 Sync: Attempting to update record ${targetRecordId} in target table ${TARGET_FEISHU_TABLE_ID}`);
    console.log('📋 Changes:', JSON.stringify({ fields: fieldsToUpdate }, null, 2));

    try {
        const response = await fetch(
            `https://base-api.larksuite.com/open-apis/bitable/v1/apps/${TARGET_FEISHU_APP_TOKEN}/tables/${TARGET_FEISHU_TABLE_ID}/records/${targetRecordId}`,
            {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ fields: fieldsToUpdate })
            }
        );

        const result = await response.json();

        if (!response.ok || result.code !== 0) {
            console.error('Sync: Failed to update record in target table:', {
                status: response.status,
                statusText: response.statusText,
                code: result.code,
                msg: result.msg
            });
        } else {
            console.log(`✅ Sync: Successfully updated record ${targetRecordId} in target table.`);
        }
    } catch (error) {
        console.error('Sync: Error updating record in target table:', error);
    }
}

// --- Main Sync Function --- 
export async function syncChangeToTargetTable(change: { type: 'new' | 'modified', record: any, changes?: { field: string, oldValue: any, newValue: any }[] }) {
    console.log(`
🚀 Sync: Processing change type '${change.type}' for record ID ${change.record.record_id}`);

    // Ensure target table credentials are set
    if (!TARGET_FEISHU_APP_TOKEN || !TARGET_FEISHU_TABLE_ID) {
        console.error('🔴 Sync Error: Target Feishu App Token or Table ID environment variables are not set. Synchronization aborted.');
        console.error('Please set NEXT_PUBLIC_TARGET_FEISHU_APP_ID and NEXT_PUBLIC_TARGET_FEISHU_TABLE_ID.');
        return; // Stop processing if config is missing
    }

    if (change.type === 'new') {
        // Add the new record to the target table
        // Important: Ensure the source record_id is stored in the target table 
        // for future updates. Add a field like 'SourceRecordID' to the target table 
        // and include it in the fields payload here.
        const fieldsWithSourceId = {
            ...change.record.fields,
            // --- Adapt this field name if necessary --- 
            'SourceRecordID': change.record.record_id 
        };
        await addRecordToTargetTable({ ...change.record, fields: fieldsWithSourceId });

    } else if (change.type === 'modified' && change.changes) {
        // Update the existing record in the target table
        const relevantChanges = change.changes.map(c => ({ field: c.field, newValue: c.newValue }));
        await updateRecordInTargetTable(change.record, relevantChanges);
    }
    console.log(`🏁 Sync: Finished processing change for record ID ${change.record.record_id}`);
}