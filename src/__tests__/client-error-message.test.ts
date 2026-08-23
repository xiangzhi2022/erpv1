import { describe, expect, it } from 'vitest';
import { getApiErrorMessage } from '@/lib/api/client-error';

describe('getApiErrorMessage', () => {
  it('supports legacy strings and the uniform API error envelope', () => {
    expect(getApiErrorMessage({ error: '旧错误' }, '回退')).toBe('旧错误');
    expect(getApiErrorMessage({ error: { message: '新错误' } }, '回退')).toBe('新错误');
    expect(getApiErrorMessage({ error: { message: 42 } }, '回退')).toBe('回退');
  });
});
