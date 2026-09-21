import { DEFAULT_RETURN_URL, safeReturnUrl } from './return-url';

describe('safeReturnUrl', () => {
  it.each([
    ['/blogs', '/blogs'],
    ['/blogs/42', '/blogs/42'],
    ['/blogs/42?tab=comments#top', '/blogs/42?tab=comments#top'],
    ['  /about  ', '/about'],
    ['/', '/'],
  ])('lets a same-origin path through: %s', (input, expected) => {
    expect(safeReturnUrl(input)).toBe(expected);
  });

  it.each([
    ['absolute https', 'https://evil.example/phish'],
    ['absolute http', 'http://evil.example'],
    ['protocol-relative', '//evil.example'],
    ['protocol-relative with path', '//evil.example/blogs'],
    ['javascript scheme', 'javascript:alert(1)'],
    ['data scheme', 'data:text/html,<script>'],
    ['backslash host escape', '/\\evil.example'],
    ['backslash in path', '/blogs\\..\\evil'],
    ['embedded newline', '/blogs\n//evil.example'],
    ['tab', '/blogs\t'],
    ['relative path without slash', 'blogs/1'],
    ['scheme-looking path', 'https:/evil.example'],
    // These pass the leading-slash check and only become protocol-relative
    // once the URL parser resolves the dot segments.
    ['dot segments collapsing to protocol-relative', '/..//evil.example'],
    ['nested dot segments', '/../..//evil.example'],
    ['dot segments after a real segment', '/a/..//evil.example'],
    ['single dot then dot-dot', '/./..//evil.example'],
    ['dot segments with a path', '/..//evil.example/phish'],
  ])('falls back to the overview for %s', (_label, input) => {
    expect(safeReturnUrl(input)).toBe(DEFAULT_RETURN_URL);
  });

  it.each([null, undefined, ''])('falls back to the overview for %s', (input) => {
    expect(safeReturnUrl(input)).toBe(DEFAULT_RETURN_URL);
  });

  it('normalises dot segments instead of trusting them', () => {
    expect(safeReturnUrl('/blogs/../login')).toBe('/login');
  });
});
