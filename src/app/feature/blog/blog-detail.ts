import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';

import { BlogService } from './blog-service';

@Component({
  selector: 'app-blog-detail',
  imports: [DatePipe, RouterLink, MatCardModule, MatIconModule, MatButtonModule, MatChipsModule],
  templateUrl: './blog-detail.html',
  styleUrl: './blog-detail.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BlogDetail {
  private readonly service = inject(BlogService);
  private readonly router = inject(Router);

  readonly id = input.required<string>();
  protected readonly post = computed(() => this.service.getById(Number(this.id())));

  protected readonly confirmingDelete = signal(false);
  protected readonly deleting = signal(false);

  protected onLike(): void {
    const post = this.post();
    if (post) this.service.toggleLike(post.id);
  }

  protected async onDelete(): Promise<void> {
    const post = this.post();
    if (!post) return;

    this.deleting.set(true);
    try {
      await this.service.deleteBlog(post.id);
      await this.router.navigate(['/blogs']);
    } catch (error) {
      console.error('[BlogDetail] Deleting the entry failed.', error);
    } finally {
      this.deleting.set(false);
      this.confirmingDelete.set(false);
    }
  }
}
