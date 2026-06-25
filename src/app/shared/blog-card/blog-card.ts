import { Component, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { Blog } from './blog.model';

@Component({
  selector: 'app-blog-card',
  imports: [RouterLink, MatCardModule, MatButtonModule, MatIconModule],
  templateUrl: './blog-card.html',
  styleUrl: './blog-card.scss',
})
export class BlogCard {
  // Pflicht-Input: das Blog-Objekt vom Parent
  model = input.required<Blog>();

  // Output: sendet die Blog-ID, wenn der Like-Button gedrueckt wird
  liked = output<number>();

  onLike(): void {
    this.liked.emit(this.model().id);
  }
}
