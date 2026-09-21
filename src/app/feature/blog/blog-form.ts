import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { BlogInput } from './blog-model';
import { BlogStateService } from './blog-state-service';

@Component({
  selector: 'app-blog-form',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './blog-form.html',
  styleUrl: './blog-form.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BlogForm {
  private readonly state = inject(BlogStateService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);

  /** Bound from the `:id` route param on /blogs/:id/edit; absent on /blogs/new. */
  readonly id = input<string>();

  /**
   * Set from the route's static `data`, never from the URL.
   *
   * `withComponentInputBinding()` merges query parameters into component
   * inputs as `{...queryParams, ...params, ...data}`. On /blogs/new there is no
   * `:id` route parameter to take precedence, so `/blogs/new?id=7` used to fill
   * `id` and silently put the page into edit mode for someone else's entry.
   * Route data outranks both, so this is the authoritative answer.
   */
  readonly mode = input<'create' | 'edit'>('create');

  protected readonly isEdit = computed(() => this.mode() === 'edit');

  protected readonly blogId = computed(() => {
    if (!this.isEdit()) return null;
    const parsed = Number(this.id());
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  });

  protected readonly loading = signal(false);
  protected readonly saving = signal(false);

  /**
   * Owned by this page rather than read from the store: `BlogState.error` is a
   * single shared slot, so rendering it here would also show a message another
   * page produced.
   */
  protected readonly error = signal<string | null>(null);

  protected readonly form = this.fb.nonNullable.group({
    title: ['', [Validators.required, Validators.minLength(3)]],
    author: ['', [Validators.required]],
    contentPreview: ['', [Validators.required, Validators.minLength(10)]],
    headerImageUrl: [''],
  });

  constructor() {
    // Route inputs arrive after construction, so react to the id instead of
    // reading it once. untracked() keeps the async load out of the dependency
    // graph — otherwise reading the store signals would re-trigger the effect.
    effect(() => {
      const id = this.blogId();
      untracked(() => {
        if (id !== null) void this.loadExisting(id);
      });
    });
  }

  protected async onSubmit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();
    const payload: BlogInput = {
      title: value.title.trim(),
      author: value.author.trim(),
      contentPreview: value.contentPreview.trim(),
      headerImageUrl: value.headerImageUrl.trim() || undefined,
    };

    this.saving.set(true);
    this.error.set(null);

    try {
      const id = this.blogId();
      const saved =
        id === null
          ? await this.state.createBlog(payload)
          : await this.state.updateBlog(id, payload);

      if (saved) {
        await this.router.navigate(['/blogs', saved.id]);
        return;
      }

      // Take the message out of the shared slot so it cannot follow the user.
      this.error.set(this.state.error() ?? 'Speichern fehlgeschlagen. Bitte versuche es erneut.');
      this.state.clearError();
    } finally {
      this.saving.set(false);
    }
  }

  private async loadExisting(id: number): Promise<void> {
    this.loading.set(true);
    this.error.set(null);

    try {
      if (this.state.blogs().length === 0) {
        await this.state.loadBlogs();
      }

      const blog = this.state.getById(id);
      if (!blog) {
        this.error.set('Dieser Beitrag konnte nicht geladen werden.');
        return;
      }

      this.form.setValue({
        title: blog.title,
        author: blog.author,
        contentPreview: blog.contentPreview,
        headerImageUrl: blog.headerImageUrl ?? '',
      });
    } finally {
      this.loading.set(false);
    }
  }
}
