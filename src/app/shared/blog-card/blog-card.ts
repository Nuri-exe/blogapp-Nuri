import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { DatePipe } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';

import { Blog } from '../../feature/blog/blog-model';

@Component({
  selector: 'app-blog-card',
  imports: [DatePipe, MatCardModule, MatIconModule, MatChipsModule],
  templateUrl: './blog-card.html',
  styleUrl: './blog-card.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BlogCard {
  readonly blog = input.required<Blog>();
}
