import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';

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

  readonly id = input.required<string>();

  /** Reads straight from the store, so edits elsewhere show up here too. */
  protected readonly post = computed(() => this.state.getById(Number(this.id())));
  protected readonly error = this.state.error;

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
    try {
      const removed = await this.state.deleteBlog(post.id);
      if (removed) await this.router.navigate(['/blogs']);
    } finally {
      this.deleting.set(false);
      this.confirmingDelete.set(false);
    }
  }
}
