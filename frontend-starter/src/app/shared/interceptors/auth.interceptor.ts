import { inject } from '@angular/core';
import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const token = auth.token();
  const authenticatedRequest = token
    ? request.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : request;

  return next(authenticatedRequest).pipe(
    catchError((error: unknown) => {
      const isAuthenticationRequest = request.url.includes('/api/auth/');
      if (error instanceof HttpErrorResponse && error.status === 401 && !isAuthenticationRequest) {
        auth.logout();
        void router.navigateByUrl('/login');
      }

      return throwError(() => error);
    }),
  );
};
