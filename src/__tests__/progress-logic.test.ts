import { describe, it, expect } from 'vitest';

// Status flow mapping test - mirrors the logic in API route
const STATUS_TRANSITIONS: Record<string, Record<string, string>> = {
	pending: {
		start_production: 'producing',
		abort: 'aborted',
	},
	producing: {
		report_progress: 'producing',
		submit_quality_check: 'quality_check',
		abort: 'aborted',
	},
	quality_check: {
		complete_quality_check: 'warehoused',
		fail_quality_check: 'producing',
		abort: 'aborted',
	},
	warehoused: {},
	aborted: {},
};

describe('Work order status transitions', () => {
	it('should allow pending -> producing via start_production', () => {
		expect(STATUS_TRANSITIONS.pending.start_production).toBe('producing');
	});

	it('should allow pending -> aborted via abort', () => {
		expect(STATUS_TRANSITIONS.pending.abort).toBe('aborted');
	});

	it('should allow producing -> quality_check via submit_quality_check', () => {
		expect(STATUS_TRANSITIONS.producing.submit_quality_check).toBe('quality_check');
	});

	it('should allow quality_check -> warehoused via complete_quality_check', () => {
		expect(STATUS_TRANSITIONS.quality_check.complete_quality_check).toBe('warehoused');
	});

	it('should allow quality_check -> producing via fail_quality_check (rework)', () => {
		expect(STATUS_TRANSITIONS.quality_check.fail_quality_check).toBe('producing');
	});

	it('should allow producing -> producing via report_progress', () => {
		expect(STATUS_TRANSITIONS.producing.report_progress).toBe('producing');
	});

	it('should not allow transitions from warehoused', () => {
		expect(Object.keys(STATUS_TRANSITIONS.warehoused)).toHaveLength(0);
	});

	it('should not allow transitions from aborted', () => {
		expect(Object.keys(STATUS_TRANSITIONS.aborted)).toHaveLength(0);
	});

	it('should cover all defined statuses', () => {
		const statuses = Object.keys(STATUS_TRANSITIONS);
		expect(statuses).toContain('pending');
		expect(statuses).toContain('producing');
		expect(statuses).toContain('quality_check');
		expect(statuses).toContain('warehoused');
		expect(statuses).toContain('aborted');
	});

	it('should allow abort from any active status', () => {
		const activeStatuses = ['pending', 'producing', 'quality_check'];
		for (const status of activeStatuses) {
			expect(STATUS_TRANSITIONS[status].abort).toBe('aborted');
		}
	});
});

describe('Progress calculation', () => {
	it('should calculate completion percentage correctly', () => {
		const calcPercent = (completed: number, target: number) =>
			target > 0 ? Math.min(Math.round((completed / target) * 100), 100) : 0;

		expect(calcPercent(50, 100)).toBe(50);
		expect(calcPercent(0, 100)).toBe(0);
		expect(calcPercent(100, 100)).toBe(100);
		expect(calcPercent(150, 100)).toBe(100); // Can't exceed 100%
		expect(calcPercent(0, 0)).toBe(0); // Division by zero
	});

	it('should determine overdue status correctly', () => {
		const isOverdue = (expectedEndDate: string | null, status: string) => {
			if (!expectedEndDate || status === 'warehoused' || status === 'aborted') return false;
			return new Date(expectedEndDate) < new Date();
		};

		// Past date should be overdue (for active orders)
		expect(isOverdue('2020-01-01', 'producing')).toBe(true);
		// Future date should not be overdue
		expect(isOverdue('2099-12-31', 'producing')).toBe(false);
		// Completed orders should not be overdue
		expect(isOverdue('2020-01-01', 'warehoused')).toBe(false);
		// Aborted orders should not be overdue
		expect(isOverdue('2020-01-01', 'aborted')).toBe(false);
		// Null date should not be overdue
		expect(isOverdue(null, 'producing')).toBe(false);
	});
});
