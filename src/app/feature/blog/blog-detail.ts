import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
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

  readonly id = input.required<string>();
  protected readonly post = computed(() => this.service.getById(Number(this.id())));

  protected onLike(): void {
    const p = this.post();
    if (p) this.service.toggleLike(p.id);
  }
}
