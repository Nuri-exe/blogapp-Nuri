import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';

import { AuthStore } from '../../core/auth/auth-store';
import { BlogStateService } from './blog-state-service';

@Component({
  selector: 'app-blog-detail',
  imports: [DatePipe, RouterLink, MatCardModule, MatIconModule, MatButtonModule, MatChipsModule],
  templateUrl: './blog-detail.html',
  styleUrl: './blog-detail.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BlogDetail {
  private readonly state = inject(BlogStateService);
  private readonly router = inject(Router);

  /** Hides the edit/delete actions for visitors who could not use them anyway. */
  protected readonly auth = inject(AuthStore);

  readonly id = input.required<string>();

  /** Reads straight from the store, so edits elsewhere show up here too. */
  protected readonly post = computed(() => this.state.getById(Number(this.id())));

  /**
   * Owned by this page rather than read from the store: `BlogState.error` is a
   * single shared slot, so rendering it here would also show a message another
   * page produced.
   */
  protected readonly error = signal<string | null>(null);

  protected readonly confirmingDelete = signal(false);
  protected readonly deleting = signal(false);

  protected onLike(): void {
    const post = this.post();
    if (post) this.state.toggleLike(post.id);
  }

  protected async onDelete(): Promise<void> {
    const post = this.post();
    if (!post) return;

    this.deleting.set(true);
    this.error.set(null);

    try {
      if (await this.state.deleteBlog(post.id)) {
        await this.router.navigate(['/blogs']);
        return;
      }

      // Take the message out of the shared slot so it cannot follow the user.
      this.error.set(this.state.error() ?? 'Der Beitrag konnte nicht gelöscht werden.');
      this.state.clearError();
    } finally {
      this.deleting.set(false);
      this.confirmingDelete.set(false);
    }
  }
}
