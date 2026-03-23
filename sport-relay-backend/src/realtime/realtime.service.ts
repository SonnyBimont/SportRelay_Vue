import { Injectable } from '@nestjs/common';
import { RealtimeGateway } from './realtime.gateway';

@Injectable()
export class RealtimeService {
  constructor(private readonly realtimeGateway: RealtimeGateway) {}

  emitMessageCreated(productId: number, payload: unknown) {
    this.realtimeGateway.emitMessageCreated(productId, payload);
  }

  emitOfferUpdated(productId: number, payload: unknown) {
    this.realtimeGateway.emitOfferUpdated(productId, payload);
  }

  emitConversationListUpdated(userIds: number[]) {
    this.realtimeGateway.emitConversationListUpdated(userIds);
  }

  emitMessagesRead(productId: number, payload: unknown) {
    this.realtimeGateway.emitMessagesRead(productId, payload);
  }

  getPresenceForUsers(
    userIds: number[],
  ): Array<{ userId: number; online: boolean }> {
    return this.realtimeGateway.getPresenceForUsers(userIds);
  }
}
