import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { environment } from '../../../environments/environment';
import { cookieInterceptor } from './cookie-interceptor';

describe('cookieInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([cookieInterceptor])),
        provideHttpClientTesting(),
      ],
    });

    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('adds cookies and the CSRF header to BFF requests', () => {
    http.get(`${environment.bffUrl}/entries`).subscribe();

    const req = httpMock.expectOne(`${environment.bffUrl}/entries`);
    expect(req.request.withCredentials).toBe(true);
    expect(req.request.headers.get('X-Requested-With')).toBe('XMLHttpRequest');
    req.flush([]);
  });

  it('also covers state-changing requests', () => {
    http.post(`${environment.bffUrl}/entries`, { title: 'Neu' }).subscribe();

    const req = httpMock.expectOne(`${environment.bffUrl}/entries`);
    expect(req.request.method).toBe('POST');
    expect(req.request.withCredentials).toBe(true);
    expect(req.request.headers.get('X-Requested-With')).toBe('XMLHttpRequest');
    req.flush({});
  });

  it('leaves requests to other hosts untouched, so cookies do not leak', () => {
    http.get('https://third-party.example/data.json').subscribe();

    const req = httpMock.expectOne('https://third-party.example/data.json');
    expect(req.request.withCredentials).toBe(false);
    expect(req.request.headers.has('X-Requested-With')).toBe(false);
    req.flush({});
  });

  it('leaves same-origin assets outside the BFF path untouched', () => {
    http.get('/data/blogs.json').subscribe();

    const req = httpMock.expectOne('/data/blogs.json');
    expect(req.request.withCredentials).toBe(false);
    expect(req.request.headers.has('X-Requested-With')).toBe(false);
    req.flush([]);
  });
});
