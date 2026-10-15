import { WritableSignal, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { MatSidenav } from '@angular/material/sidenav';

import { AuthStore } from '../auth/auth-store';
import { LayoutService } from '../layout/layout-service';
import { Sidebar } from './sidebar';

describe('Sidebar', () => {
  let isMobile: WritableSignal<boolean>;
  let fixture: ComponentFixture<Sidebar>;
  let host: HTMLElement;

  beforeEach(async () => {
    isMobile = signal(false);

    TestBed.configureTestingModule({
      providers: [
        // The drawer links really navigate; a catch-all keeps the router quiet.
        provideRouter([{ path: '**', children: [] }]),
        provideNoopAnimations(),
        { provide: LayoutService, useValue: { isMobile } },
        // The header inside the shell reads the session; keep it anonymous and silent.
        {
          provide: AuthStore,
          useValue: { loading: signal(false), isAuthenticated: signal(false), user: signal(null) },
        },
      ],
    });

    fixture = TestBed.createComponent(Sidebar);
    host = fixture.nativeElement as HTMLElement;
    await fixture.whenStable();
  });

  function drawer(): MatSidenav {
    return fixture.debugElement.query(By.directive(MatSidenav)).componentInstance as MatSidenav;
  }

  const menuButton = () => host.querySelector<HTMLButtonElement>('[data-testid="menu-toggle"]');
  const drawerLinks = () =>
    [...host.querySelectorAll('.shell__nav a [matListItemTitle]')].map((title) =>
      (title.textContent ?? '').trim(),
    );

  async function goMobile(): Promise<void> {
    isMobile.set(true);
    await fixture.whenStable();
  }

  it('places the header inside the sidenav content', () => {
    expect(host.querySelector('mat-sidenav-content app-header')).toBeTruthy();
  });

  it('opens as an overlay, never as a side panel that shifts the page', () => {
    // 'side' is what the Material schematic generates; it would push the
    // content sideways on a phone instead of covering it.
    expect(drawer().mode).toBe('over');
    expect(drawer().fixedInViewport).toBe(true);
  });

  it('shows neither hamburger nor drawer links on desktop', () => {
    expect(menuButton()).toBeNull();
    expect(drawerLinks()).toEqual([]);
    expect(drawer().opened).toBe(false);
  });

  it('shows the hamburger and the stacked links on mobile', async () => {
    await goMobile();

    expect(menuButton()).not.toBeNull();
    expect(drawerLinks()).toEqual(['Beiträge', 'Über']);
  });

  it('opens the drawer from the hamburger', async () => {
    await goMobile();

    menuButton()?.click();
    await fixture.whenStable();

    expect(drawer().opened).toBe(true);
  });

  it('closes the drawer once a link was chosen', async () => {
    await goMobile();
    menuButton()?.click();
    await fixture.whenStable();

    host.querySelector<HTMLAnchorElement>('.shell__nav a')?.click();
    await fixture.whenStable();

    expect(drawer().opened).toBe(false);
  });

  it('closes the drawer when the viewport grows into the desktop layout', async () => {
    await goMobile();
    menuButton()?.click();
    await fixture.whenStable();
    expect(drawer().opened).toBe(true);

    isMobile.set(false);
    await fixture.whenStable();

    expect(drawer().opened).toBe(false);
    expect(drawerLinks()).toEqual([]);
  });
});
