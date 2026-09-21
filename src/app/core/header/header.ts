import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  inject,
  output,
  viewChild,
} from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule, MatIconButton } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';

import { environment } from '../../../environments/environment';
import { AuthStore } from '../auth/auth-store';
import { LayoutService } from '../layout/layout-service';
import { ThemeService } from '../theme/theme-service';

@Component({
  selector: 'app-header',
  imports: [
    RouterLink,
    RouterLinkActive,
    MatToolbarModule,
    MatIconModule,
    MatButtonModule,
    MatIconButton,
    MatTooltipModule,
  ],
  templateUrl: './header.html',
  styleUrl: './header.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Header {
  protected readonly theme = inject(ThemeService);
  protected readonly auth = inject(AuthStore);
  protected readonly layout = inject(LayoutService);
  protected readonly title = 'HFTM Blog';

  /**
   * The hamburger only asks for "the menu"; what that opens is the shell's
   * decision (the drawer in `Sidebar`). Shown on narrow screens only.
   */
  readonly menuToggle = output<void>();

  /** Hidden entirely where no BFF is reachable — a sign-in button would 404. */
  protected readonly authEnabled = environment.authEnabled;

  protected readonly displayName = computed(() => {
    const user = this.auth.user();
    return user?.name || user?.preferred_username || 'Angemeldet';
  });

  private readonly firstNavLink = viewChild<ElementRef<HTMLAnchorElement>>('firstNavLink');

  /**
   * Moves keyboard focus into the toolbar navigation.
   *
   * Called by the shell after it closes the drawer on a breakpoint change: the
   * hamburger that Material would restore focus to has just been removed from
   * the DOM, so focus would otherwise fall back to <body>.
   */
  focusNav(): void {
    this.firstNavLink()?.nativeElement.focus();
  }

  protected toggleTheme(): void {
    this.theme.toggle();
  }

  protected async onLogout(): Promise<void> {
    // AuthStore navigates to Keycloak's end-session endpoint itself, so there
    // is deliberately no router call after this.
    await this.auth.logout();
  }
}
