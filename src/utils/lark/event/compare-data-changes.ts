/*
 * @Description: 公共数据变更检测方法，供 feishu-form 与 webhook/lark_event 复用
 */

export interface DataChange {
  type: 'new' | 'modified';
  record: any;
  changes?: { field: string; oldValue: any; newValue: any }[];
}

/**
 * 比较新旧数据，返回变更项数组
 * @param oldItems 旧数据数组
 * @param newItems 新数据数组
 */
export function compareDataChanges(oldItems: any[], newItems: any[]): DataChange[] {
  const oldItemsMap = new Map(oldItems.map(item => [item.record_id, item]));
  const changes: DataChange[] = [];

  newItems.forEach(newItem => {
    const oldItem = oldItemsMap.get(newItem.record_id);
    if (!oldItem) {
      changes.push({ type: 'new', record: newItem });
    } else {
      const fieldChanges = Object.entries(newItem.fields).reduce((acc: any[], [field, value]) => {
        if (JSON.stringify(oldItem.fields[field]) !== JSON.stringify(value)) {
          acc.push({ field, oldValue: oldItem.fields[field], newValue: value });
        }
        return acc;
      }, []);
      if (fieldChanges.length > 0) {
        changes.push({ type: 'modified', record: newItem, changes: fieldChanges });
      }
    }
  });
  return changes;
}