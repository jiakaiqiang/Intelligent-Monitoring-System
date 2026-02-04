import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  Logger,
} from '@nestjs/common';

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();

    const status = exception instanceof HttpException ? exception.getStatus() : 500;

    const exceptionResponse = exception instanceof HttpException
      ? exception.getResponse()
      : { message: 'Internal server error' };

    const errorResponse = {
      success: false,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      error: {
        code: status,
        message: typeof exceptionResponse === 'string'
          ? exceptionResponse
          : (exceptionResponse as any).message || 'Unknown error',
        details: typeof exceptionResponse === 'object' && 'response' in exceptionResponse
          ? (exceptionResponse as any).response
          : null,
      },
    };

    // Log error with performance context
    this.logger.error(
      `${request.method} ${request.url} - ${status}: ${errorResponse.error.message}`,
      exception.stack,
    );

    response
      .status(status)
      .json(errorResponse);
  }
}