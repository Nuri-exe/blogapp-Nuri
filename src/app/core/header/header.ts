import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule, MatIconButton } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';

import { environment } from '../../../environments/environment';
import { AuthStore } from '../auth/auth-store';
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
  protected readonly title = 'HFTM Blog';

  /** Hidden entirely where no BFF is reachable — a sign-in button would 404. */
  protected readonly authEnabled = environment.authEnabled;

  protected readonly displayName = computed(() => {
    const user = this.auth.user();
    return user?.name || user?.preferred_username || 'Angemeldet';
  });

  protected toggleTheme(): void {
    this.theme.toggle();
  }

  protected async onLogout(): Promise<void> {
    // AuthStore navigates to Keycloak's end-session endpoint itself, so there
    // is deliberately no router call after this.
    await this.auth.logout();
  }
}
