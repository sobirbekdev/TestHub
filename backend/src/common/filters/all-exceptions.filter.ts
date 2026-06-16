import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';

// VAQTINCHALIK DIAGNOSTIKA FILTRI:
// Kutilmagan (HttpException bo'lmagan) xatolarning asl nomi, xabari va stack'ini
// javob tanasiga chiqaradi. Shu orqali 500 sababini frontenddan ko'rish mumkin.
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

    // Kutilmagan xato — to'liq tafsilot bilan
    const err = exception as any;
    // eslint-disable-next-line no-console
    console.error('[AllExceptionsFilter] kutilmagan xato:', err);
    return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: 500,
      _diag: true,
      name: err?.name || null,
      code: err?.code || null,
      message: err?.message || String(err),
      stack: (err?.stack || '').split('\n').slice(0, 6),
    });
  }
}
