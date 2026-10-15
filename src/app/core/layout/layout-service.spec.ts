import { DOCUMENT } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { LayoutService } from './layout-service';

type ChangeListener = (event: { matches: boolean }) => void;

/**
 * Minimal stand-in for `MediaQueryList`. jsdom does not implement
 * `matchMedia`, and the real thing cannot be resized from a test anyway.
 *
 * Honours the `signal` option the way the DOM does: aborting it removes the
 * listener — that is what the cleanup test relies on.
 */
class FakeMediaQueryList {
  readonly listeners = new Set<ChangeListener>();
  readonly queries: string[] = [];

  constructor(public matches: boolean) {}

  addEventListener(
    _type: 'change',
    listener: ChangeListener,
    options?: { signal?: AbortSignal },
  ): void {
    this.listeners.add(listener);
    options?.signal?.addEventListener('abort', () => this.listeners.delete(listener));
  }

  /** Simulates the viewport crossing the breakpoint. */
  resize(matches: boolean): void {
    this.matches = matches;
    for (const listener of this.listeners) listener({ matches });
  }
}

describe('LayoutService', () => {
  function setup(mediaQueryList: FakeMediaQueryList | null): LayoutService {
    const defaultView =
      mediaQueryList === null
        ? {}
        : {
            matchMedia: (query: string) => {
              mediaQueryList.queries.push(query);
              return mediaQueryList;
            },
          };

    TestBed.configureTestingModule({
      providers: [{ provide: DOCUMENT, useValue: { defaultView } }],
    });

    return TestBed.inject(LayoutService);
  }

  it('asks for the 768px boundary', () => {
    const mql = new FakeMediaQueryList(true);
    setup(mql);

    expect(mql.queries).toEqual(['(min-width: 768px)']);
  });

  it('reports mobile when the viewport is narrower than 768px', () => {
    const service = setup(new FakeMediaQueryList(false));

    expect(service.isMobile()).toBe(true);
  });

  it('reports desktop when the viewport is at least 768px wide', () => {
    const service = setup(new FakeMediaQueryList(true));

    expect(service.isMobile()).toBe(false);
  });

  it('follows the viewport across the breakpoint in both directions', () => {
    const mql = new FakeMediaQueryList(true);
    const service = setup(mql);

    mql.resize(false);
    expect(service.isMobile()).toBe(true);

    mql.resize(true);
    expect(service.isMobile()).toBe(false);
  });

  it('removes its listener when the injector is destroyed', () => {
    const mql = new FakeMediaQueryList(true);
    setup(mql);
    expect(mql.listeners.size).toBe(1);

    TestBed.resetTestingModule();

    expect(mql.listeners.size).toBe(0);
  });

  it('falls back to the desktop layout where matchMedia does not exist', () => {
    // Server-side rendering and jsdom both hand out a window without it.
    const service = setup(null);

    expect(service.isMobile()).toBe(false);
  });
});
