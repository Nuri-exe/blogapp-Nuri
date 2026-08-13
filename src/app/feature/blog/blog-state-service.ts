import { Injectable, computed, effect, inject, signal } from '@angular/core';

import { Blog, BlogInput } from './blog-model';
import { BlogService } from './blog-service';

/** Sentinel for "no author filter applied". */
export const ALL_AUTHORS = 'all';

const STORAGE_KEY = 'blogapp.selectedAuthor';

/** Everything the blog feature knows, in one object. */
export interface BlogState {
  blogs: Blog[];
  loading: boolean;
  error: string | null;
  selectedAuthor: string;
  /** True when the list came from the bundled sample data, not the backend. */
  offline: boolean;
}

/** Restores the persisted filter so a reload keeps the user's selection. */
function readStoredAuthor(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? ALL_AUTHORS;
  } catch {
    // localStorage can be unavailable (SSR, privacy mode) — fall back silently.
    return ALL_AUTHORS;
  }
}

/**
 * Single source of truth for the blog feature.
 *
 * Structure — the four areas are kept strictly apart:
 *   1. State          the private signal, writable only from in here
 *   2. Derived state  public computed() selectors, read-only for components
 *   3. Actions        public methods that talk to the backend and decide
 *                     which reducer runs when
 *   4. Reducers       private methods that answer one question only:
 *                     what does the state look like afterwards?
 */
@Injectable({ providedIn: 'root' })
export class BlogStateService {
  private readonly backend = inject(BlogService);

  // ------------------------------------------------------------------- state

  readonly #state = signal<BlogState>({
    blogs: [],
    loading: false,
    error: null,
    selectedAuthor: readStoredAuthor(),
    offline: false,
  });

  // ----------------------------------------------------------- derived state

  readonly blogs = computed(() => this.#state().blogs);
  readonly loading = computed(() => this.#state().loading);
  readonly error = computed(() => this.#state().error);
  readonly selectedAuthor = computed(() => this.#state().selectedAuthor);
  readonly offline = computed(() => this.#state().offline);

  readonly blogCount = computed(() => this.blogs().length);

  /** Every author that appears in the list, de-duplicated — the filter options. */
  readonly authors = computed(() => {
    const unique = new Set(this.blogs().map((blog) => blog.author));
    return [...unique].sort((a, b) => a.localeCompare(b, 'de'));
  });

  /** The list the overview renders: all entries, or just the selected author's. */
  readonly filteredBlogs = computed(() => {
    const author = this.selectedAuthor();
    const blogs = this.blogs();
    return author === ALL_AUTHORS ? blogs : blogs.filter((blog) => blog.author === author);
  });

  /**
   * Side effect: mirror the chosen filter into localStorage on every change.
   * Declared as a class property so it is created inside the injection context.
   */
  private readonly persistSelectedAuthor = effect(() => {
    const author = this.selectedAuthor();
    try {
      localStorage.setItem(STORAGE_KEY, author);
    } catch {
      // see readStoredAuthor()
    }
  });

  // ----------------------------------------------------------------- actions

  /** Loads the list, falling back to the bundled sample data if the API is down. */
  async loadBlogs(): Promise<void> {
    this.#loadStarted();

    try {
      this.#loadSucceeded(await this.backend.getBlogs());
    } catch (error) {
      console.error('[BlogStateService] Loading from the backend failed.', error);

      try {
        this.#fallbackLoaded(await this.backend.getFallbackBlogs());
      } catch (fallbackError) {
        console.error('[BlogStateService] The local fallback failed too.', fallbackError);
        this.#loadFailed('Beiträge konnten nicht geladen werden.');
      }
    }
  }

  /** Applies the author filter. */
  setAuthor(author: string): void {
    this.#authorSelected(author);
  }

  /** Creates an entry and puts it at the top of the list. */
  async createBlog(input: BlogInput): Promise<Blog | null> {
    this.#saveStarted();

    try {
      const created = await this.backend.createBlog(input);
      this.#blogCreated(created);
      return created;
    } catch (error) {
      console.error('[BlogStateService] Creating the entry failed.', error);
      this.#saveFailed('Der Beitrag konnte nicht gespeichert werden.');
      return null;
    }
  }

  /** Updates an entry in place. */
  async updateBlog(id: number, input: BlogInput): Promise<Blog | null> {
    this.#saveStarted();

    try {
      const updated = await this.backend.updateBlog(id, input);
      this.#blogUpdated(updated);
      return updated;
    } catch (error) {
      console.error('[BlogStateService] Updating the entry failed.', error);
      this.#saveFailed('Der Beitrag konnte nicht gespeichert werden.');
      return null;
    }
  }

  /** Removes an entry. */
  async deleteBlog(id: number): Promise<boolean> {
    this.#saveStarted();

    try {
      await this.backend.deleteBlog(id);
      this.#blogDeleted(id);
      return true;
    } catch (error) {
      console.error('[BlogStateService] Deleting the entry failed.', error);
      this.#saveFailed('Der Beitrag konnte nicht gelöscht werden.');
      return false;
    }
  }

  /** Optimistic, client-side like toggle. */
  toggleLike(id: number): void {
    this.#likeToggled(id);
  }

  /** Cache lookup used by the detail page and the detail route resolver. */
  getById(id: number): Blog | undefined {
    return this.blogs().find((blog) => blog.id === id);
  }

  // ---------------------------------------------------------------- reducers

  /** Loading begins: spinner on, previous error cleared. */
  #loadStarted(): void {
    this.#state.update((state) => ({ ...state, loading: true, error: null }));
  }

  /** Data arrived from the backend: take the list, spinner off. */
  #loadSucceeded(blogs: Blog[]): void {
    this.#state.update((state) => ({ ...state, blogs, loading: false, offline: false }));
  }

  /** Backend was unreachable but the bundled sample data loaded. */
  #fallbackLoaded(blogs: Blog[]): void {
    this.#state.update((state) => ({ ...state, blogs, loading: false, offline: true }));
  }

  /**
   * Loading failed: message set, spinner off. Any previously loaded entries stay
   * put — a stale list under an error banner beats a blank page.
   */
  #loadFailed(message: string): void {
    this.#state.update((state) => ({ ...state, loading: false, error: message }));
  }

  /** A write begins: spinner on, previous error cleared. */
  #saveStarted(): void {
    this.#state.update((state) => ({ ...state, loading: true, error: null }));
  }

  /** A write failed: message set, spinner off, list untouched. */
  #saveFailed(message: string): void {
    this.#state.update((state) => ({ ...state, loading: false, error: message }));
  }

  /** An entry was created: prepend it. */
  #blogCreated(blog: Blog): void {
    this.#state.update((state) => ({
      ...state,
      blogs: [blog, ...state.blogs],
      loading: false,
    }));
  }

  /** An entry was updated: replace it, or prepend it if it was not cached. */
  #blogUpdated(blog: Blog): void {
    this.#state.update((state) => {
      const index = state.blogs.findIndex((entry) => entry.id === blog.id);
      if (index === -1) {
        return { ...state, blogs: [blog, ...state.blogs], loading: false };
      }

      const blogs = [...state.blogs];
      blogs[index] = blog;
      return { ...state, blogs, loading: false };
    });
  }

  /** An entry was deleted: drop it from the list. */
  #blogDeleted(id: number): void {
    this.#state.update((state) => ({
      ...state,
      blogs: state.blogs.filter((blog) => blog.id !== id),
      loading: false,
    }));
  }

  /** A like was toggled: flip the flag and adjust the counter. */
  #likeToggled(id: number): void {
    this.#state.update((state) => ({
      ...state,
      blogs: state.blogs.map((blog) =>
        blog.id === id
          ? { ...blog, likedByMe: !blog.likedByMe, likes: blog.likes + (blog.likedByMe ? -1 : 1) }
          : blog,
      ),
    }));
  }

  /** The author filter changed. */
  #authorSelected(author: string): void {
    this.#state.update((state) => ({ ...state, selectedAuthor: author }));
  }
}
