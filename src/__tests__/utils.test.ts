import { describe, it, expect } from 'vitest';
import { cn } from '../lib/utils';

describe('cn utility', () => {
	it('should merge class names', () => {
		expect(cn('foo', 'bar')).toBe('foo bar');
	});

	it('should handle conditional classes', () => {
		expect(cn('base', false && 'hidden', 'active')).toBe('base active');
	});

	it('should merge tailwind conflicts correctly', () => {
		// tailwind-merge should resolve conflicting utilities
		expect(cn('px-2', 'px-4')).toBe('px-4');
		expect(cn('text-red-500', 'text-blue-500')).toBe('text-blue-500');
	});

	it('should handle undefined and null', () => {
		expect(cn('base', undefined, null, 'extra')).toBe('base extra');
	});

	it('should handle empty input', () => {
		expect(cn()).toBe('');
	});
});
