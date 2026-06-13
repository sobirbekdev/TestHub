-- Telegram ID endi raqam emas, matn bo'lishi mumkin (AT1:1, SB2:1 kabi)
ALTER TABLE "tests" ALTER COLUMN "telegramId" TYPE TEXT USING "telegramId"::text;
