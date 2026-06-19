import { Component, signal } from '@angular/core';
import { BlogCard } from '../../shared/blog-card/blog-card';
import { Blog } from '../../shared/blog-card/blog.model';
import blogData from '../../data/blogs.json';

@Component({
  selector: 'app-blog-overview-page',
  imports: [BlogCard],
  templateUrl: './blog-overview-page.html',
  styleUrl: './blog-overview-page.scss',
})
export class BlogOverviewPage {
  // Daten aus JSON laden und in ein Signal packen, damit Updates reaktiv sind
  protected readonly blogs = signal<Blog[]>(blogData as Blog[]);

  // Event-Handler: empfaengt die Blog-ID vom Child und togglet den Like-Status
  protected onLiked(id: number): void {
    this.blogs.update((list) =>
      list.map((b) =>
        b.id === id
          ? {
              ...b,
              likedByMe: !b.likedByMe,
              likes: b.likedByMe ? b.likes - 1 : b.likes + 1,
            }
          : b,
      ),
    );
  }
}
