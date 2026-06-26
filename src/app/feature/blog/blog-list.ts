import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { BlogCard } from '../../shared/blog-card/blog-card';
import { BlogService } from './blog-service';

@Component({
  selector: 'app-blog-list',
  imports: [BlogCard, MatProgressSpinnerModule],
  templateUrl: './blog-list.html',
  styleUrl: './blog-list.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BlogList {
  private readonly service = inject(BlogService);
  protected readonly blogs = computed(() => this.service.getAll());

  protected onLike(id: number): void {
    this.service.toggleLike(id);
  }
}
