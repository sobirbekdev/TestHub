import { IsString, Matches, Length } from 'class-validator';

export class SendOtpDto {
  @IsString()
  @Matches(/^\+998[0-9]{9}$/, { message: "Telefon raqam noto'g'ri (+998XXXXXXXXX)" })
  phone: string;
}

export class VerifyOtpDto {
  @IsString()
  @Matches(/^\+998[0-9]{9}$/, { message: "Telefon raqam noto'g'ri" })
  phone: string;

  @IsString()
  @Length(6, 6, { message: 'Kod 6 ta raqam bo\'lishi kerak' })
  code: string;
}
