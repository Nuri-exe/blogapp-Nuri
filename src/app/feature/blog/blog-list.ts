import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { BlogCard } from '../../shared/blog-card/blog-card';
import { BlogService } from './blog-service';

@Component({
  selector: 'app-blog-list',
  imports: [BlogCard, RouterLink, MatButtonModule, MatIconModule, MatProgressSpinnerModule],
  templateUrl: './blog-list.html',
  styleUrl: './blog-list.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BlogList {
  private readonly service = inject(BlogService);

  protected readonly blogs = this.service.blogs;
  protected readonly offline = this.service.offline;
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);

  constructor() {
    void this.reload();
  }

  protected async reload(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);

    try {
      await this.service.getBlogs();
    } catch (error) {
      console.error('[BlogList] Could not load blog entries.', error);
      this.error.set('Beiträge konnten nicht geladen werden.');
    } finally {
      this.loading.set(false);
    }
  }

  protected onLike(id: number): void {
    this.service.toggleLike(id);
  }
}
