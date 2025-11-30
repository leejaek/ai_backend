import {
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { LoginDto, SignupDto } from './dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

  async signup(signupDto: SignupDto) {
    this.logger.log(`회원가입 시도: ${signupDto.email}`);

    const existingUser = await this.usersService.findByEmail(signupDto.email);
    if (existingUser) {
      this.logger.warn(`회원가입 실패 - 이미 등록된 이메일: ${signupDto.email}`);
      throw new ConflictException('이미 등록된 이메일입니다.');
    }

    const hashedPassword = await bcrypt.hash(signupDto.password, 10);
    const user = await this.usersService.create({
      ...signupDto,
      password: hashedPassword,
    });

    this.logger.log(`회원가입 성공: ${signupDto.email}, userId: ${user.id}`);

    const { password, id, ...result } = user;
    return result;
  }

  async login(loginDto: LoginDto) {
    this.logger.log(`로그인 시도: ${loginDto.email}`);

    const user = await this.usersService.findByEmail(loginDto.email);
    if (!user) {
      this.logger.warn(`로그인 실패 - 존재하지 않는 이메일: ${loginDto.email}`);
      throw new UnauthorizedException('이메일 또는 비밀번호가 올바르지 않습니다.');
    }

    const isPasswordValid = await bcrypt.compare(
      loginDto.password,
      user.password,
    );
    if (!isPasswordValid) {
      this.logger.warn(`로그인 실패 - 비밀번호 불일치: ${loginDto.email}`);
      throw new UnauthorizedException('이메일 또는 비밀번호가 올바르지 않습니다.');
    }

    const payload = { sub: user.id, email: user.email, role: user.role };
    const accessToken = this.jwtService.sign(payload);

    await this.usersService.updateLastLogin(user.id);

    this.logger.log(`로그인 성공: userId: ${user.id}`);

    return {
      accessToken,
    };
  }
}
