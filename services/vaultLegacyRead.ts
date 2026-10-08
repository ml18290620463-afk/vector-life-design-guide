/** Only a missing IDB key may use a legacy mirror. Corruption is never an empty vault. */
export function withLegacyValue(value: unknown, key: string): unknown {
  if (value !== undefined) return value;
  const raw = localStorage.getItem(key);
  return raw === null ? undefined : JSON.parse(raw);
}

export function storedArray<T>(value: unknown, key: string): T[] | undefined {
  const result = withLegacyValue(value, key);
  if (result === undefined) return undefined;
  if (!Array.isArray(result)) throw new Error('资料库内容格式无效，请检查备份');
  return result as T[];
}
