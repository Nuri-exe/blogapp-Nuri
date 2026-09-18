import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { vi } from 'vitest';

import { Blog } from './blog-model';
import { BlogCreate, toBlogInput } from './blog-create';
import { BlogStateService } from './blog-state-service';

function createdBlog(): Blog {
  return {
    id: 42,
    title: 'Mein Beitrag',
    contentPreview: 'Ein ausreichend langer Inhalt für die Vorschau.',
    author: 'HFTM Blog',
    likes: 0,
    comments: 0,
    likedByMe: false,
    createdByMe: true,
    createdAt: '2026-09-11T10:00:00',
    updatedAt: '2026-09-11T10:00:00',
  };
}

/** Only the members `BlogCreate` actually reaches for. */
function stateMock() {
  return {
    createBlog: vi.fn<() => Promise<Blog | null>>().mockResolvedValue(createdBlog()),
    error: vi.fn<() => string | null>().mockReturnValue(null),
    clearError: vi.fn<() => void>(),
  };
}

describe('BlogCreate', () => {
  let state: ReturnType<typeof stateMock>;
  let fixture: ComponentFixture<BlogCreate>;
  let host: HTMLElement;
  let navigate: ReturnType<typeof vi.fn<Router['navigate']>>;

  async function render(): Promise<void> {
    state = stateMock();

    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: BlogStateService, useValue: state }],
    });

    fixture = TestBed.createComponent(BlogCreate);
    navigate = vi.fn<Router['navigate']>().mockResolvedValue(true);
    vi.spyOn(TestBed.inject(Router), 'navigate').mockImplementation(navigate);

    await fixture.whenStable();
  }

  beforeEach(async () => {
    await render();
    host = fixture.nativeElement as HTMLElement;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function el<T extends HTMLElement>(selector: string): T {
    const found = host.querySelector<T>(selector);
    if (!found) throw new Error(`Missing element: ${selector}`);
    return found;
  }

  const titleInput = () => el<HTMLInputElement>('#blog-title');
  const contentInput = () => el<HTMLTextAreaElement>('#blog-content');
  const categorySelect = () => el<HTMLSelectElement>('#blog-category');
  const submitButton = () => el<HTMLButtonElement>('button[type="submit"]');

  /** Types into a native control the way the FormField directive expects. */
  async function type(
    element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
    value: string,
  ): Promise<void> {
    element.value = value;
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
    await fixture.whenStable();
  }

  /** Blurring is what flips `touched()`, which gates the per-field messages. */
  async function blur(element: HTMLElement): Promise<void> {
    element.dispatchEvent(new Event('blur', { bubbles: true }));
    await fixture.whenStable();
  }

  /** Fills in a draft that satisfies every rule. */
  async function fillValidDraft(): Promise<void> {
    await type(titleInput(), 'Mein Beitrag');
    await type(contentInput(), 'Ein ausreichend langer Inhalt für die Vorschau.');
    await type(categorySelect(), 'tech');
  }

  function messages(): string[] {
    return [...host.querySelectorAll('.blog-create__errors li')].map((li) =>
      (li.textContent ?? '').trim(),
    );
  }

  function pendingIssues(): string[] {
    return [...host.querySelectorAll('.blog-create__pending li')].map((li) =>
      (li.textContent ?? '').trim(),
    );
  }

  // ------------------------------------------------------------ Aufgabe 1

  it('binds the native controls to the model via [formField]', async () => {
    await fillValidDraft();

    // Proven through the payload: the values reached the model signal, which is
    // the only thing `onSubmit` reads.
    submitButton().click();
    await fixture.whenStable();

    expect(state.createBlog).toHaveBeenCalledWith({
      title: 'Mein Beitrag',
      contentPreview: 'Ein ausreichend langer Inhalt für die Vorschau.',
      author: 'HFTM Blog',
    });
  });

  it('starts with the category preselected to general', () => {
    expect(categorySelect().value).toBe('general');
  });

  it('offers exactly the three required categories', () => {
    const options = [...categorySelect().options].map((o) => [o.value, o.text.trim()]);

    expect(options).toEqual([
      ['general', 'Allgemein'],
      ['tech', 'Technik'],
      ['lifestyle', 'Lifestyle'],
    ]);
  });

  it('prevents the browser default submit and logs the model value', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    await fillValidDraft();

    const event = new Event('submit', { bubbles: true, cancelable: true });
    el<HTMLFormElement>('form').dispatchEvent(event);
    await fixture.whenStable();

    expect(event.defaultPrevented).toBe(true);
    expect(log).toHaveBeenCalledWith('[BlogCreate] Formularwert:', {
      title: 'Mein Beitrag',
      content: 'Ein ausreichend langer Inhalt für die Vorschau.',
      category: 'tech',
    });
  });

  // ------------------------------------------------------------ Aufgabe 2

  it('keeps field messages hidden until the field was touched', async () => {
    // Invalid from the start — but nothing has been touched yet.
    expect(messages()).toEqual([]);

    await blur(titleInput());

    expect(messages()).toContain('Titel ist erforderlich.');
  });

  it('reports the built-in validators for each field', async () => {
    await type(titleInput(), 'ab');
    await blur(titleInput());

    expect(messages()).toContain('Titel braucht mindestens 3 Zeichen.');

    await type(titleInput(), 'a'.repeat(101));
    await fixture.whenStable();

    expect(messages()).toContain('Titel darf höchstens 100 Zeichen lang sein.');

    await type(contentInput(), 'zu kurz');
    await blur(contentInput());

    expect(messages()).toContain('Inhalt braucht mindestens 10 Zeichen.');
  });

  it('disables the submit button while the form is invalid', async () => {
    expect(submitButton().disabled).toBe(true);

    await fillValidDraft();

    expect(submitButton().disabled).toBe(false);
  });

  it('does not run the action when the draft is invalid', async () => {
    await type(titleInput(), 'ab');

    el<HTMLFormElement>('form').dispatchEvent(
      new Event('submit', { bubbles: true, cancelable: true }),
    );
    await fixture.whenStable();

    expect(state.createBlog).not.toHaveBeenCalled();
  });

  it('navigates to the new entry once the backend accepted it', async () => {
    await fillValidDraft();
    submitButton().click();
    await fixture.whenStable();

    expect(navigate).toHaveBeenCalledWith(['/blogs', 42]);
  });

  it('shows a message and drains the shared error slot when saving fails', async () => {
    state.createBlog.mockResolvedValue(null);
    state.error.mockReturnValue('Backend nicht erreichbar.');

    await fillValidDraft();
    submitButton().click();
    await fixture.whenStable();

    expect(el('.blog-create__save-error').textContent).toContain('Backend nicht erreichbar.');
    expect(state.clearError).toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });

  // ------------------------------------------------------------ Aufgabe 3a

  it('rejects special characters in the title', async () => {
    await type(titleInput(), 'Hallo! Welt?');
    await blur(titleInput());

    expect(messages()).toContain(
      'Nur Buchstaben, Zahlen und Leerzeichen erlaubt — Umlaute sind in Ordnung.',
    );
  });

  it('accepts umlauts, eszett and digits in the title', async () => {
    await type(titleInput(), 'Grüezi Wält 2026 Straße');
    await blur(titleInput());

    expect(messages()).not.toContain(
      'Nur Buchstaben, Zahlen und Leerzeichen erlaubt — Umlaute sind in Ordnung.',
    );
  });

  it('leaves the charset message to `required` while the title is empty', async () => {
    await blur(titleInput());

    expect(messages()).toEqual(['Titel ist erforderlich.']);
  });

  // ------------------------------------------------------------ Aufgabe 3b

  it('requires the content to be twice the length of the title', async () => {
    await type(titleInput(), 'Ein langer Titel hier');
    await type(contentInput(), 'Zu kurz dafür.');
    await blur(contentInput());

    expect(messages()).toContain(
      'Inhalt muss mindestens doppelt so lang sein wie der Titel (14 von 42 Zeichen).',
    );
  });

  it('re-runs the content rule when the title changes', async () => {
    await type(titleInput(), 'Ein langer Titel hier');
    await type(contentInput(), 'Ein Inhalt mit 30 Zeichen ....');
    await blur(contentInput());

    expect(messages().some((m) => m.startsWith('Inhalt muss mindestens'))).toBe(true);

    // Shortening the title alone has to clear the content error.
    await type(titleInput(), 'Kurz');

    expect(messages().some((m) => m.startsWith('Inhalt muss mindestens'))).toBe(false);
  });

  // ------------------------------------------------- discoverability of the block

  it('always names what is still missing, even before the first touch', async () => {
    expect(pendingIssues()).toEqual(['Titel ist erforderlich.', 'Inhalt ist erforderlich.']);

    await fillValidDraft();

    expect(pendingIssues()).toEqual([]);
  });
});

describe('toBlogInput', () => {
  it('maps the draft onto the backend payload and trims it', () => {
    expect(toBlogInput({ title: '  Titel  ', content: '  Inhalt  ', category: 'tech' })).toEqual({
      title: 'Titel',
      contentPreview: 'Inhalt',
      author: 'HFTM Blog',
    });
  });
});
