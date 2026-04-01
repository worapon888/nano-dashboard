import {
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  ArgumentsHost,
} from '@nestjs/common';
import { FastifyReply } from 'fastify';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<FastifyReply>();

    const statusCode =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const exceptionResponse =
      exception instanceof HttpException ? exception.getResponse() : null;

    const message =
      typeof exceptionResponse === 'object' &&
      exceptionResponse !== null &&
      'message' in exceptionResponse
        ? (exceptionResponse as { message: string | string[] }).message
        : 'Internal server error';

    const error =
      typeof exceptionResponse === 'object' &&
      exceptionResponse !== null &&
      'error' in exceptionResponse &&
      typeof (exceptionResponse as { error?: unknown }).error === 'string'
        ? (exceptionResponse as { error: string }).error
        : exception instanceof HttpException
          ? exception.name
          : 'InternalServerError';

    response.status(statusCode).send({
      statusCode,
      message,
      error,
    });
  }
}
