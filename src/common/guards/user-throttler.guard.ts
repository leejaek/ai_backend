import { Injectable, ExecutionContext } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

@Injectable()
export class UserThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<string> {
    // 인증된 사용자면 userId 기반, 아니면 IP 기반으로 제한
    return req.user?.id || req.ip;
  }
}
