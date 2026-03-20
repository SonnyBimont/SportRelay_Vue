import { UserRole } from '../../users/entities/user.entity';
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  Length,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsString()
  @Length(2, 80)
  displayName!: string;

  @IsOptional()
  @IsIn(['buyer', 'seller'])
  role?: Exclude<UserRole, 'admin'>;

  @IsOptional()
  @IsBoolean()
  rememberMe?: boolean;
}
