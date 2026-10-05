import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { positionTooltip, TOURS, type Rect, type TourPlacement } from './tours.js';

/*
  The tooltip's placement is the part of the tour that breaks quietly. Nothing
  throws when a card ends up half off screen; it just becomes unreadable on a
  narrow window, which is exactly the kind of thing that ships.
*/
describe('positionTooltip', () => {
  const viewport = { width: 1000, height: 800 };
  const tooltip = { width: 320, height: 120 };
  const middle: Rect = { top: 400, left: 400, width: 100, height: 40 };

  it('keeps the preferred side when there is room', () => {
    const result = positionTooltip(middle, tooltip, 'bottom', viewport);
    expect(result.placement).toBe('bottom');
    expect(result.top).toBe(452);
    expect(result.left).toBe(290);
  });

  it('centres the card on the target for a vertical side', () => {
    // 400 + 100/2 - 320/2 = 290
    expect(positionTooltip(middle, tooltip, 'bottom', viewport).left).toBe(290);
    expect(positionTooltip(middle, tooltip, 'top', viewport).left).toBe(290);
  });

  it('flips above a target that is too near the bottom', () => {
    const low: Rect = { top: 700, left: 400, width: 100, height: 40 };
    const result = positionTooltip(low, tooltip, 'bottom', viewport);
    expect(result.placement).toBe('top');
    // 700 - 12 - 120
    expect(result.top).toBe(568);
  });

  it('flips below a target that is too near the top', () => {
    const high: Rect = { top: 4, left: 400, width: 100, height: 40 };
    const result = positionTooltip(high, tooltip, 'top', viewport);
    expect(result.placement).toBe('bottom');
    expect(result.top).toBe(56);
  });

  it('flips to the left of a target that is too near the right edge', () => {
    const right: Rect = { top: 400, left: 900, width: 100, height: 40 };
    const result = positionTooltip(right, tooltip, 'right', viewport);
    expect(result.placement).toBe('left');
    // 900 - 12 - 320
    expect(result.left).toBe(568);
  });

  it('keeps the preferred side when neither side has room', () => {
    // Flipping would be no better, and swapping the placement noisily is worse
    // than staying put and letting the clamp deal with it.
    const narrow = { top: 100, left: 100, width: 100, height: 40 };
    const result = positionTooltip(narrow, tooltip, 'right', { width: 340, height: 200 });
    expect(result.placement).toBe('right');
    // Both sides are short, so the card lands clamped at the left margin.
    expect(result.left).toBe(12);
  });

  it('never returns a position outside the viewport', () => {
    const corners: Rect[] = [
      { top: 0, left: 0, width: 40, height: 40 },
      { top: 0, left: 960, width: 40, height: 40 },
      { top: 760, left: 0, width: 40, height: 40 },
      { top: 760, left: 960, width: 40, height: 40 },
    ];
    const placements: TourPlacement[] = ['top', 'bottom', 'left', 'right'];
    for (const target of corners) {
      for (const placement of placements) {
        const result = positionTooltip(target, tooltip, placement, viewport);
        expect(result.top).toBeGreaterThanOrEqual(12);
        expect(result.left).toBeGreaterThanOrEqual(12);
        expect(result.top + tooltip.height).toBeLessThanOrEqual(viewport.height - 12);
        expect(result.left + tooltip.width).toBeLessThanOrEqual(viewport.width - 12);
      }
    }
  });

  it('degrades to the margin when the viewport is smaller than the card', () => {
    // A clamp that assumes the card fits would return a negative offset here.
    const result = positionTooltip(middle, tooltip, 'bottom', { width: 200, height: 100 });
    expect(result.top).toBe(12);
    expect(result.left).toBe(12);
  });
});

describe('tour definitions', () => {
  it('gives every tour a unique id and a label', () => {
    const ids = TOURS.map((tour) => tour.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(TOURS.every((tour) => tour.label.trim().length > 0)).toBe(true);
  });

  it('autostarts exactly one tour, so a first visit is not a queue of overlays', () => {
    expect(TOURS.filter((tour) => tour.autoStart)).toHaveLength(1);
  });

  it('gives every step a target, a title, and a body', () => {
    for (const tour of TOURS) {
      expect(tour.steps.length).toBeGreaterThan(0);
      for (const step of tour.steps) {
        expect(step.target).toMatch(/^[a-z0-9.]+$/);
        expect(step.title.trim().length).toBeGreaterThan(0);
        expect(step.body.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it('does not repeat a target inside one tour', () => {
    // Two steps on the same element means one of them is describing the wrong
    // thing, and the tour appears to stall on a step it already showed.
    for (const tour of TOURS) {
      const targets = tour.steps.map((step) => step.target);
      expect(new Set(targets).size).toBe(targets.length);
    }
  });

  it('has an anchor in the markup for every target', () => {
    /*
      The failure this exists to catch: a step whose `data-tour` does not exist is
      dropped at runtime, and dropped silently. The tour simply gets shorter, and
      nobody notices a missing sentence in an onboarding flow.

      Reading the source is unusual for a unit test, but the alternative is a
      typo that no test can see and no user will report.
    */
    const root = fileURLToPath(new URL('..', import.meta.url));
    const walk = (dir: string): string[] =>
      readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
        entry.isDirectory()
          ? walk(join(dir, entry.name))
          : entry.name.endsWith('.tsx')
            ? [join(dir, entry.name)]
            : [],
      );

    const anchors = new Set<string>();
    for (const file of walk(root)) {
      if (file.endsWith('.test.ts')) continue;
      const source = readFileSync(file, 'utf8');
      for (const match of source.matchAll(/data-tour="([a-z0-9.]+)"|dataTour="([a-z0-9.]+)"/g)) {
        anchors.add(match[1] ?? match[2]);
      }
    }

    const missing = TOURS.flatMap((tour) =>
      tour.steps.map((step) => step.target).filter((target) => !anchors.has(target)),
    );
    expect([...new Set(missing)]).toEqual([]);
  });
});
