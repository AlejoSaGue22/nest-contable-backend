import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const ActiveCompany = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest();
    return request.companyId;
  },
);
