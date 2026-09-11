import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import {
  FormField,
  form,
  maxLength,
  minLength,
  required,
  submit,
  validate,
} from '@angular/forms/signals';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { BlogInput } from './blog-model';
import { BlogStateService } from './blog-state-service';

/** The draft a user types — deliberately its own shape, see `toBlogInput()`. */
export interface BlogDraft {
  title: string;
  content: string;
  category: string;
}

/** Options for the category select: stored value plus the label shown to the user. */
export const BLOG_CATEGORIES = [
  { value: 'general', label: 'Allgemein' },
  { value: 'tech', label: 'Technik' },
  { value: 'lifestyle', label: 'Lifestyle' },
] as const;

/**
 * Letters, digits and spaces — nothing else.
 *
 * `\p{L}` needs the `u` flag and matches letters in any script, so "Grüezi" and
 * "Ökologie" pass. The naive `[a-zA-Z0-9 ]` would reject exactly the umlauts the
 * requirement asks us to allow.
 */
const TITLE_CHARSET = /^[\p{L}\p{N} ]+$/u;

/** How many times longer than the title the content has to be. */
const CONTENT_LENGTH_FACTOR = 2;

/** The backend has no author column we could derive, and there is no session yet. */
const DEFAULT_AUTHOR = 'HFTM Blog';

@Component({
  selector: 'app-blog-create',
  imports: [
    FormField,
    RouterLink,
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './blog-create.html',
  styleUrl: './blog-create.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BlogCreate {
  private readonly state = inject(BlogStateService);
  private readonly router = inject(Router);

  protected readonly categories = BLOG_CATEGORIES;

  /**
   * The model holds the data. `form()` below wraps it but does not copy it —
   * writing through a field writes straight back into this signal, which is why
   * `blogModel()` is the thing we submit.
   */
  protected readonly blogModel = signal<BlogDraft>({
    title: '',
    content: '',
    category: 'general',
  });

  /**
   * The controller: validation rules and UI state (touched/valid/errors) derived
   * from the model. Declared after `blogModel` on purpose — field initialisers
   * run top to bottom, so referencing it earlier would read `undefined`.
   */
  protected readonly blogForm = form(this.blogModel, (s) => {
    required(s.title, { message: 'Titel ist erforderlich.' });
    minLength(s.title, 3, { message: 'Titel braucht mindestens 3 Zeichen.' });
    maxLength(s.title, 100, { message: 'Titel darf höchstens 100 Zeichen lang sein.' });

    // Custom validator — stays quiet while the field is empty so `required`
    // owns that case instead of stacking two messages on one mistake.
    validate(s.title, ({ value }) => {
      const title = value().trim();
      if (title === '' || TITLE_CHARSET.test(title)) return null;

      return {
        kind: 'titleCharset',
        message: 'Nur Buchstaben, Zahlen und Leerzeichen erlaubt — Umlaute sind in Ordnung.',
      };
    });

    required(s.content, { message: 'Inhalt ist erforderlich.' });
    minLength(s.content, 10, { message: 'Inhalt braucht mindestens 10 Zeichen.' });

    // Cross-field validator. `valueOf(s.title)` is a tracked read, so editing the
    // title re-runs this rule and the message updates without touching content.
    validate(s.content, ({ value, valueOf }) => {
      const content = value().trim();
      const minimum = valueOf(s.title).trim().length * CONTENT_LENGTH_FACTOR;
      if (content.length === 0 || content.length >= minimum) return null;

      return {
        kind: 'contentShorterThanTitle',
        message:
          `Inhalt muss mindestens doppelt so lang sein wie der Titel ` +
          `(${content.length} von ${minimum} Zeichen).`,
      };
    });

    required(s.category, { message: 'Kategorie ist erforderlich.' });
  });

  /** Set when the backend rejects an otherwise valid draft. */
  protected readonly saveError = signal<string | null>(null);

  /**
   * Every rule the draft currently breaks, regardless of `touched()`.
   *
   * The per-field messages below only appear after a field was touched, which is
   * what the requirement asks for — but combined with a disabled submit button it
   * leaves a first-time visitor with a dead button and no explanation. This list
   * is the answer to "why can't I send this?" and is rendered next to the button.
   */
  protected readonly openIssues = computed(() =>
    [
      ...this.blogForm.title().errors(),
      ...this.blogForm.content().errors(),
      ...this.blogForm.category().errors(),
    ].map((error) => error.message ?? error.kind),
  );

  protected async onSubmit(event: Event): Promise<void> {
    // The form posts nowhere; Angular owns the submit.
    event.preventDefault();

    console.log('[BlogCreate] Formularwert:', this.blogModel());

    this.saveError.set(null);

    // submit() marks every field as touched, checks the validators and only then
    // runs the action — so there is no `if (valid())` here by design.
    await submit(this.blogForm, async () => {
      const draft = this.blogModel();
      const created = await this.state.createBlog(toBlogInput(draft));

      if (!created) {
        // Take the message out of the store's shared error slot so it cannot
        // resurface on another page later.
        this.saveError.set(this.state.error() ?? 'Der Beitrag konnte nicht gespeichert werden.');
        this.state.clearError();
        return;
      }

      await this.router.navigate(['/blogs', created.id]);
    });
  }
}

/**
 * Maps the draft onto the payload the backend accepts.
 *
 * `content` becomes `contentPreview` because that is the only body field the API
 * exposes. `category` has no counterpart there at all — it is kept in the draft
 * (and logged on submit) but deliberately not smuggled into the payload, where
 * the server would silently drop it.
 */
export function toBlogInput(draft: BlogDraft): BlogInput {
  return {
    title: draft.title.trim(),
    contentPreview: draft.content.trim(),
    author: DEFAULT_AUTHOR,
  };
}
