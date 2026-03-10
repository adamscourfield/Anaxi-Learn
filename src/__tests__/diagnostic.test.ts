import { describe, it, expect } from 'vitest';
import {
  initPayload,
  updatePayloadAfterAttempt,
  selectNextSkill,
  shouldStopEarly,
  STRAND_QUOTAS,
  persistRouteRecommendation,
} from '@/features/diagnostic/diagnosticService';

describe('initPayload', () => {
  it('creates empty payload', () => {
    const p = initPayload();
    expect(p.estimates).toEqual({});
    expect(p.strandCounts).toEqual({});
  });
});

describe('updatePayloadAfterAttempt', () => {
  it('increments total and correct on correct answer', () => {
    const p = initPayload();
    const updated = updatePayloadAfterAttempt(p, 'N1.3', 'PV', true);
    expect(updated.estimates['N1.3'].total).toBe(1);
    expect(updated.estimates['N1.3'].correct).toBe(1);
    expect(updated.estimates['N1.3'].masteryEstimate).toBe(1);
  });

  it('increments total but not correct on wrong answer', () => {
    const p = initPayload();
    const updated = updatePayloadAfterAttempt(p, 'N1.3', 'PV', false);
    expect(updated.estimates['N1.3'].total).toBe(1);
    expect(updated.estimates['N1.3'].correct).toBe(0);
    expect(updated.estimates['N1.3'].masteryEstimate).toBe(0);
  });

  it('updates strand counts', () => {
    const p = initPayload();
    const updated = updatePayloadAfterAttempt(p, 'N1.3', 'PV', true);
    expect(updated.strandCounts['PV']).toBe(1);
  });

  it('accumulates over multiple attempts', () => {
    let p = initPayload();
    p = updatePayloadAfterAttempt(p, 'N1.3', 'PV', true);
    p = updatePayloadAfterAttempt(p, 'N1.3', 'PV', false);
    p = updatePayloadAfterAttempt(p, 'N1.3', 'PV', true);
    expect(p.estimates['N1.3'].total).toBe(3);
    expect(p.estimates['N1.3'].correct).toBe(2);
    expect(p.estimates['N1.3'].masteryEstimate).toBeCloseTo(2 / 3);
  });
});

describe('selectNextSkill', () => {
  it('returns null when no skills available', () => {
    expect(selectNextSkill([], initPayload())).toBeNull();
  });

  it('prioritises under-quota strands', () => {
    const skills = [
      { id: '1', code: 'N1.3', strand: 'PV' },
      { id: '2', code: 'N4.1', strand: 'FDP' },
    ];
    // PV has quota 3, FDP has quota 2
    // Both under quota, FDP has lower masteryEstimate (both 0)
    // Should pick one with lowest estimate; tie broken by order
    const result = selectNextSkill(skills, initPayload());
    expect(result).not.toBeNull();
  });

  it('prefers skill with lowest masteryEstimate in under-quota strand', () => {
    const skills = [
      { id: '1', code: 'N1.3', strand: 'PV' },
      { id: '2', code: 'N2.5', strand: 'ADD' },
    ];
    let p = initPayload();
    // Give PV high mastery
    p = updatePayloadAfterAttempt(p, 'N1.3', 'PV', true);
    p = updatePayloadAfterAttempt(p, 'N1.3', 'PV', true);
    p = updatePayloadAfterAttempt(p, 'N1.3', 'PV', true);
    // Both under quota, ADD has lower estimate
    const result = selectNextSkill(skills, p);
    expect(result?.code).toBe('N2.5');
  });

  it('falls back to all skills when all quotas met', () => {
    const skills = [{ id: '1', code: 'N1.3', strand: 'PV' }];
    const p = initPayload();
    // Meet PV quota (3 items)
    p.strandCounts['PV'] = 3;
    const result = selectNextSkill(skills, p);
    expect(result).not.toBeNull();
    expect(result?.code).toBe('N1.3');
  });
});

describe('shouldStopEarly', () => {
  it('never stops before minItems', () => {
    expect(shouldStopEarly(initPayload(), 5, 12, 25, 0.85)).toBe(false);
    expect(shouldStopEarly(initPayload(), 11, 12, 25, 0.85)).toBe(false);
  });

  it('always stops at maxItems', () => {
    expect(shouldStopEarly(initPayload(), 25, 12, 25, 0.85)).toBe(true);
  });

  it('stops early when all core strands meet target and overall accuracy meets target', () => {
    let p = initPayload();
    // Fill PV, ADD, MUL with 1.0 estimates, 12 items total
    for (let i = 0; i < 4; i++) p = updatePayloadAfterAttempt(p, 'N1.3', 'PV', true);
    for (let i = 0; i < 4; i++) p = updatePayloadAfterAttempt(p, 'N2.5', 'ADD', true);
    for (let i = 0; i < 4; i++) p = updatePayloadAfterAttempt(p, 'N3.5', 'MUL', true);
    expect(shouldStopEarly(p, 12, 12, 25, 0.85)).toBe(true);
  });

  it('does not stop early when a core strand is below target', () => {
    let p = initPayload();
    for (let i = 0; i < 4; i++) p = updatePayloadAfterAttempt(p, 'N1.3', 'PV', true);
    for (let i = 0; i < 4; i++) p = updatePayloadAfterAttempt(p, 'N2.5', 'ADD', false); // ADD fails
    for (let i = 0; i < 4; i++) p = updatePayloadAfterAttempt(p, 'N3.5', 'MUL', true);
    expect(shouldStopEarly(p, 12, 12, 25, 0.85)).toBe(false);
  });

  it('does not stop early when overall accuracy is below target', () => {
    let p = initPayload();
    for (let i = 0; i < 4; i++) p = updatePayloadAfterAttempt(p, 'N1.3', 'PV', true);
    for (let i = 0; i < 4; i++) p = updatePayloadAfterAttempt(p, 'N2.5', 'ADD', true);
    // MUL mixed: 50% accuracy
    for (let i = 0; i < 2; i++) p = updatePayloadAfterAttempt(p, 'N3.5', 'MUL', true);
    for (let i = 0; i < 2; i++) p = updatePayloadAfterAttempt(p, 'N3.5', 'MUL', false);
    expect(shouldStopEarly(p, 12, 12, 25, 0.85)).toBe(false);
  });
});

describe('persistRouteRecommendation', () => {
  it('persists recommendation by skill code into payload.routeRecommendations', () => {
    const p = initPayload();
    const updated = persistRouteRecommendation(p, 'N1.1', {
      status: 'route',
      route: 'B',
      reason: 'dominant misconception pv_m2_zero_shift',
    });

    expect(updated.routeRecommendations?.['N1.1']).toEqual({
      status: 'route',
      route: 'B',
      reason: 'dominant misconception pv_m2_zero_shift',
    });
  });

  it('preserves existing recommendations while adding a new one', () => {
    let p = initPayload();
    p = persistRouteRecommendation(p, 'N1.1', {
      status: 'route',
      route: 'A',
      reason: 'initial recommendation',
    });

    const updated = persistRouteRecommendation(p, 'N1.2', {
      status: 'secure',
      reason: 'high mastery and transfer',
    });

    expect(updated.routeRecommendations?.['N1.1']?.route).toBe('A');
    expect(updated.routeRecommendations?.['N1.2']?.status).toBe('secure');
  });
});

describe('STRAND_QUOTAS', () => {
  it('has required strands', () => {
    expect(STRAND_QUOTAS['PV']).toBe(3);
    expect(STRAND_QUOTAS['ADD']).toBe(3);
    expect(STRAND_QUOTAS['MUL']).toBe(3);
    expect(STRAND_QUOTAS['FAC']).toBe(1);
    expect(STRAND_QUOTAS['FDP']).toBe(2);
  });
});
