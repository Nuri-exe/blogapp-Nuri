import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
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
export default class BlogList {
  private readonly service = inject(BlogService);
  protected readonly blogs = toSignal(this.service.getBlogs(), { initialValue: null });
}
