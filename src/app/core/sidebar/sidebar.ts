import { ChangeDetectionStrategy, Component, effect, inject, viewChild } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { MatIcon } from '@angular/material/icon';
import { MatListItem, MatListItemIcon, MatListItemTitle, MatNavList } from '@angular/material/list';
import { MatSidenav, MatSidenavContainer, MatSidenavContent } from '@angular/material/sidenav';

import { Header } from '../header/header';
import { LayoutService } from '../layout/layout-service';

/**
 * Application shell: a Material sidenav around the header and the routed page.
 *
 * Started from `ng generate @angular/material:navigation core/sidebar` (see the
 * previous commit for the untouched output) and then reworked. Kept from the
 * schematic: the container / drawer / content structure and the
 * hamburger-on-mobile behaviour. Replaced: its second toolbar (the app already
 * has `Header`), the "Link n" placeholders, the drawer that stays open on
 * desktop, and its own CDK breakpoint — `LayoutService` is the one source of
 * truth for "is this a phone", shared with the SCSS media queries.
 *
 * On desktop the links sit in the toolbar (see `Header`), so the drawer only
 * ever opens as an overlay on narrow screens and carries the same links
 * stacked vertically.
 */
@Component({
  selector: 'app-sidebar',
  // Individual directives rather than the modules: MatListModule would also
  // pull the selection list and its options into the initial bundle.
  imports: [
    RouterLink,
    RouterLinkActive,
    MatIcon,
    MatNavList,
    MatListItem,
    MatListItemIcon,
    MatListItemTitle,
    MatSidenav,
    MatSidenavContainer,
    MatSidenavContent,
    Header,
  ],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Sidebar {
  protected readonly layout = inject(LayoutService);

  private readonly drawer = viewChild(MatSidenav);

  private readonly header = viewChild.required(Header);

  constructor() {
    // Growing past the breakpoint removes the drawer's links, so an overlay
    // left open there would only dim an empty panel.
    effect(() => {
      if (this.layout.isMobile()) return;

      const drawer = this.drawer();
      if (!drawer?.opened) return;

      // Material restores focus to whatever opened the drawer — but that is
      // the hamburger, which the same breakpoint change removes from the DOM.
      // Focus would land on <body>, so a keyboard user would start over at the
      // top of the document. Hand it to the toolbar link instead.
      void drawer.close().then(() => this.header().focusNav());
    });
  }
}
