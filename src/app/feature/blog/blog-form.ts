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

  protected readonly blogId = computed(() => {
    const raw = this.id();
    return raw === undefined ? null : Number(raw);
  });
  protected readonly isEdit = computed(() => this.blogId() !== null);

  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  /** Local problems (entry missing); backend problems come from the store. */
  protected readonly localError = signal<string | null>(null);
  protected readonly error = computed(() => this.localError() ?? this.state.error());

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
    this.localError.set(null);

    try {
      const id = this.blogId();
      const saved =
        id === null
          ? await this.state.createBlog(payload)
          : await this.state.updateBlog(id, payload);

      // A null result means the store already holds the error message.
      if (saved) await this.router.navigate(['/blogs', saved.id]);
    } finally {
      this.saving.set(false);
    }
  }

  private async loadExisting(id: number): Promise<void> {
    this.loading.set(true);
    this.localError.set(null);

    try {
      if (this.state.blogs().length === 0) {
        await this.state.loadBlogs();
      }

      const blog = this.state.getById(id);
      if (!blog) {
        this.localError.set('Dieser Beitrag konnte nicht geladen werden.');
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
