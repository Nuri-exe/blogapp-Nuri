import { Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { BlogService } from '../../shared/blog.service';

@Component({
  selector: 'app-blog-detail-page',
  imports: [RouterLink, MatCardModule, MatButtonModule, MatIconModule],
  templateUrl: './blog-detail-page.html',
  styleUrl: './blog-detail-page.scss',
})
export class BlogDetailPage {
  private readonly blogService = inject(BlogService);

  // Route-Parameter :id kommt dank withComponentInputBinding() automatisch als Input rein.
  // Er ist IMMER ein string, deshalb input<string>.
  id = input.required<string>();

  // computed() reagiert automatisch, wenn sich id aendert.
  // +this.id() konvertiert den string in eine number fuer getById().
  protected readonly blog = computed(() => this.blogService.getById(+this.id()));
}
