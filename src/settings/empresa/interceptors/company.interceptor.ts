import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable, from } from 'rxjs';
import { mergeMap } from 'rxjs/operators';
import { CompanyContext } from '../company-context.service';

@Injectable()
export class CompanyInterceptor implements NestInterceptor {
  constructor(private readonly companyContext: CompanyContext) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();

    // Resolve active company ID and attach to request context
    return from(this.companyContext.getActiveCompanyId()).pipe(
      mergeMap((companyId) => {
        request.companyId = companyId;
        return next.handle();
      }),
    );
  }
}
