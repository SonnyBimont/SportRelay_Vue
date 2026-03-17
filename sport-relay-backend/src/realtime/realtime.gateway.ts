import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { JwtService } from '@nestjs/jwt';
import type { Server, Socket } from 'socket.io';
import type { JwtUser } from '../auth/interfaces/jwt-user.interface';

@WebSocketGateway({
  cors: {
    origin: true,
    credentials: true,
  },
})
export class RealtimeGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  private server!: Server;

  private readonly socketUserMap = new Map<string, number>();
  private readonly userConnectionCount = new Map<number, number>();

  constructor(private readonly jwtService: JwtService) {}

  private userRoom(userId: number): string {
    return `user:${userId}`;
  }

  private productRoom(productId: number): string {
    return `product:${productId}`;
  }

  private extractToken(client: Socket): string | null {
    const authToken = client.handshake.auth?.token as unknown;
    if (typeof authToken === 'string' && authToken.length > 0) {
      return authToken;
    }

    const authorization = client.handshake.headers.authorization;
    if (!authorization || typeof authorization !== 'string') {
      return null;
    }

    if (!authorization.toLowerCase().startsWith('bearer ')) {
      return null;
    }

    return authorization.slice(7).trim();
  }

  async handleConnection(client: Socket) {
    const token = this.extractToken(client);
    if (!token) {
      client.disconnect(true);
      return;
    }

    try {
      const payload = await this.jwtService.verifyAsync<JwtUser>(token);
      const userId = Number(payload.sub);
      this.socketUserMap.set(client.id, userId);
      const previous = this.userConnectionCount.get(userId) ?? 0;
      this.userConnectionCount.set(userId, previous + 1);
      void client.join(this.userRoom(userId));

      if (previous === 0) {
        this.server.emit('presence-updated', { userId, online: true });
      }
    } catch {
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    const userId = this.socketUserMap.get(client.id);
    if (!userId) {
      return;
    }

    this.socketUserMap.delete(client.id);
    const previous = this.userConnectionCount.get(userId) ?? 0;
    if (previous <= 1) {
      this.userConnectionCount.delete(userId);
      this.server.emit('presence-updated', { userId, online: false });
      return;
    }

    this.userConnectionCount.set(userId, previous - 1);
  }

  @SubscribeMessage('join-product')
  handleJoinProduct(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { productId: number },
  ) {
    const productId = Number(body?.productId);
    if (!Number.isFinite(productId) || productId <= 0) {
      return;
    }
    void client.join(this.productRoom(productId));
  }

  @SubscribeMessage('leave-product')
  handleLeaveProduct(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { productId: number },
  ) {
    const productId = Number(body?.productId);
    if (!Number.isFinite(productId) || productId <= 0) {
      return;
    }
    void client.leave(this.productRoom(productId));
  }

  emitMessageCreated(productId: number, payload: unknown) {
    this.server
      .to(this.productRoom(productId))
      .emit('message-created', payload);
  }

  emitOfferUpdated(productId: number, payload: unknown) {
    this.server.to(this.productRoom(productId)).emit('offer-updated', payload);
  }

  emitConversationListUpdated(userIds: number[]) {
    for (const userId of userIds) {
      this.server.to(this.userRoom(userId)).emit('conversation-list-updated');
    }
  }

  emitMessagesRead(productId: number, payload: unknown) {
    this.server.to(this.productRoom(productId)).emit('messages-read', payload);
  }

  getPresenceForUsers(
    userIds: number[],
  ): Array<{ userId: number; online: boolean }> {
    return userIds.map((userId) => ({
      userId,
      online: (this.userConnectionCount.get(userId) ?? 0) > 0,
    }));
  }
}
