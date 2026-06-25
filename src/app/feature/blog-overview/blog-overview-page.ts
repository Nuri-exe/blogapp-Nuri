import { Component, inject, signal } from '@angular/core';
import { BlogCard } from '../../shared/blog-card/blog-card';
import { Blog } from '../../shared/blog-card/blog.model';
import { BlogService } from '../../shared/blog.service';

@Component({
  selector: 'app-blog-overview-page',
  imports: [BlogCard],
  templateUrl: './blog-overview-page.html',
  styleUrl: './blog-overview-page.scss',
})
export class BlogOverviewPage {
  // Service injizieren statt JSON direkt zu importieren
  private readonly blogService = inject(BlogService);

  // Daten aus dem Service holen und in ein Signal packen, damit Updates reaktiv sind
  protected readonly blogs = signal<Blog[]>(this.blogService.getAll());

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
