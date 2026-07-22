const { parsePagination, parseDateRange } = require('../../src/utils/pagination');

describe('parsePagination', () => {
  it('defaults to page 1 and limit 20', () => {
    expect(parsePagination({})).toEqual({ page: 1, limit: 20, skip: 0 });
  });

  it('caps limit at 100', () => {
    expect(parsePagination({ page: '1', limit: '500' })).toEqual({ page: 1, limit: 100, skip: 0 });
  });

  it('computes skip from page and limit', () => {
    expect(parsePagination({ page: '3', limit: '10' })).toEqual({ page: 3, limit: 10, skip: 20 });
  });

  it('treats page below 1 as 1', () => {
    expect(parsePagination({ page: '0' })).toEqual({ page: 1, limit: 20, skip: 0 });
  });
});

describe('parseDateRange', () => {
  it('returns undefined when no from/to given', () => {
    expect(parseDateRange({})).toBeUndefined();
  });

  it('builds a gte/lte filter from from/to, extending a date-only "to" to end of day', () => {
    const result = parseDateRange({ from: '2026-01-01', to: '2026-01-31' });
    expect(result.gte).toEqual(new Date('2026-01-01'));
    expect(result.lte).toEqual(new Date('2026-01-31T23:59:59.999Z'));
  });

  it('builds a filter with only gte when only from is given', () => {
    const result = parseDateRange({ from: '2026-01-01' });
    expect(result).toEqual({ gte: new Date('2026-01-01') });
  });

  it('leaves a full ISO "to" timestamp unchanged (does not extend to end of day)', () => {
    const result = parseDateRange({ to: '2026-01-31T10:00:00.000Z' });
    expect(result.lte).toEqual(new Date('2026-01-31T10:00:00.000Z'));
  });
});
