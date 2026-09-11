import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';

import { AuthStore } from '../../core/auth/auth-store';
import { BlogCard } from '../../shared/blog-card/blog-card';
import { ALL_AUTHORS, BlogStateService } from './blog-state-service';

@Component({
  selector: 'app-blog-list',
  imports: [
    BlogCard,
    RouterLink,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSelectModule,
  ],
  templateUrl: './blog-list.html',
  styleUrl: './blog-list.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BlogList implements OnInit {
  private readonly state = inject(BlogStateService);

  /** Hides the create action for visitors who could not use it anyway. */
  protected readonly auth = inject(AuthStore);

  // Read-only views onto the central state — the component cannot write to it.
  protected readonly blogs = this.state.filteredBlogs;
  protected readonly loading = this.state.loading;
  protected readonly error = this.state.error;
  protected readonly offline = this.state.offline;
  protected readonly blogCount = this.state.blogCount;
  protected readonly authors = this.state.authors;
  protected readonly selectedAuthor = this.state.selectedAuthor;

  protected readonly allAuthors = ALL_AUTHORS;

  ngOnInit(): void {
    void this.state.loadBlogs();
  }

  protected reload(): void {
    void this.state.loadBlogs();
  }

  protected onAuthorChange(author: string): void {
    this.state.setAuthor(author);
  }

  protected onLike(id: number): void {
    this.state.toggleLike(id);
  }
}
