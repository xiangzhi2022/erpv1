import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.(?:ts|tsx)$/.test(entry.name) ? [path] : [];
  });
}

const roots = ['src/app', 'src/components'];
const invalidText = /\uFFFD|(?:['"`])\?{3,}(?:['"`])|Ã.|Â.|â€|â€™|â€œ|â€�|ðŸ|ç®|è´|å·¥|ä»»|ç|é¦|ä»/;

describe('UTF-8 application content', () => {
  it('contains no replacement characters, mojibake, or question-mark placeholders', () => {
    const offenders = roots.flatMap(sourceFiles).filter((file) => invalidText.test(readFileSync(file, 'utf8')));
    expect(offenders).toEqual([]);
  });

  it.each([
    ['src/app/(dashboard)/layout.tsx', 'ERP 管理平台'],
    ['src/app/finance/layout.tsx', '财务管理'],
    ['src/app/shipping/layout.tsx', '仓库发货'],
    ['src/app/progress/layout.tsx', '生产进度'],
    ['src/app/workers/layout.tsx', '工人管理'],
    ['src/app/worker/layout.tsx', '工人工作台'],
    ['src/app/tasks/layout.tsx', '任务管理'],
  ])('%s uses the expected Chinese label', (file, label) => {
    expect(readFileSync(file, 'utf8')).toContain(label);
  });
});
