import { UserRole } from '../../users/entities/user.entity';

export class RegisterDto {
  email!: string;
  password!: string;
  displayName!: string;
  role?: Exclude<UserRole, 'admin'>;
}
