import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatIconButton } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';

import { Blog } from '../../feature/blog/blog-model';

@Component({
  selector: 'app-blog-card',
  imports: [
    DatePipe,
    RouterLink,
    MatCardModule,
    MatIconModule,
    MatIconButton,
    MatChipsModule,
    MatTooltipModule,
  ],
  templateUrl: './blog-card.html',
  styleUrl: './blog-card.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BlogCard {
  readonly blog = input.required<Blog>();
  readonly like = output<number>();

  protected onLike(): void {
    this.like.emit(this.blog().id);
  }
}
