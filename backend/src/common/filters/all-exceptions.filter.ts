import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';

// Global xatolik filtri:
// Kutilmagan (HttpException bo'lmagan) xatolarni "Internal server error" o'rniga
// o'qishli xabar bilan qaytaradi. To'liq stack faqat server logiga yoziladi.
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse();

    if (exception instanceof HttpException) {
      // Oddiy HTTP xatolar (400/401/403/404 ...) — o'z holicha
      const status = exception.getStatus();
      return res.status(status).json(exception.getResponse());
    }

    // Kutilmagan xato — to'liq stack'ni faqat logga yozamiz
    const err = exception as any;
    // eslint-disable-next-line no-console
    console.error('[AllExceptionsFilter] kutilmagan xato:', err);
    const detail = [err?.code, err?.meta?.field_name || err?.meta?.constraint, err?.message]
      .filter(Boolean)
      .join(' | ') || 'nomalum xato';
    return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: 500,
      message: `Server xatosi: ${detail}`,
    });
  }
}
