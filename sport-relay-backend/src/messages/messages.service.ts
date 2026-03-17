import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op, WhereOptions } from 'sequelize';
import { Product } from '../products/entities/product.entity';
import { RealtimeService } from '../realtime/realtime.service';
import { User, UserRole } from '../users/entities/user.entity';
import { CreateMessageDto } from './dto/create-message.dto';
import { ChatMessage } from './entities/chat-message.entity';

export interface ConversationThread {
  productId: number;
  productName: string;
  productImageUrl: string;
  counterpartId: number;
  counterpartDisplayName: string;
  counterpartRole: UserRole;
  latestMessageId: number;
  latestMessageContent: string;
  latestMessageAt: string;
  latestMessageSenderId: number;
  unreadCount: number;
}

@Injectable()
export class MessagesService {
  constructor(
    @InjectModel(ChatMessage)
    private readonly messageModel: typeof ChatMessage,
    @InjectModel(Product)
    private readonly productModel: typeof Product,
    @InjectModel(User)
    private readonly userModel: typeof User,
    private readonly realtimeService: RealtimeService,
  ) {}

  async createMessage(
    senderId: number,
    dto: CreateMessageDto,
  ): Promise<ChatMessage> {
    const content = dto.content?.trim() ?? '';
    if (!content) {
      throw new BadRequestException('Le message ne peut pas etre vide.');
    }

    if (content.length > 1000) {
      throw new BadRequestException(
        'Le message ne peut pas depasser 1000 caracteres.',
      );
    }

    if (dto.recipientId === senderId) {
      throw new BadRequestException(
        'Tu ne peux pas t envoyer un message a toi-meme.',
      );
    }

    const [product, recipient] = await Promise.all([
      this.productModel.findByPk(dto.productId),
      this.userModel.findByPk(dto.recipientId),
    ]);

    if (!product) {
      throw new NotFoundException('Produit introuvable.');
    }

    if (!recipient) {
      throw new NotFoundException('Destinataire introuvable.');
    }

    if (!product.sellerId) {
      throw new BadRequestException(
        'Cette annonce ne supporte pas la messagerie.',
      );
    }

    const sellerId = Number(product.sellerId);
    if (!Number.isFinite(sellerId) || sellerId <= 0) {
      throw new BadRequestException(
        'Cette annonce ne supporte pas la messagerie.',
      );
    }

    const involvesSeller =
      senderId === sellerId || dto.recipientId === sellerId;
    if (!involvesSeller) {
      throw new ForbiddenException(
        'Une conversation produit doit inclure le vendeur de l annonce.',
      );
    }

    const productId = Number(product.id);

    const message = await this.messageModel.create({
      productId,
      senderId,
      recipientId: dto.recipientId,
      content,
      readAt: null,
    });

    const messageId = Number(message.id);
    const hydrated = await this.messageModel.findByPk(messageId, {
      include: [
        {
          association: 'sender',
          attributes: ['id', 'email', 'displayName', 'role'],
        },
        {
          association: 'recipient',
          attributes: ['id', 'email', 'displayName', 'role'],
        },
      ],
    });

    const payload = hydrated ?? message;
    this.realtimeService.emitMessageCreated(productId, payload);
    this.realtimeService.emitConversationListUpdated([
      senderId,
      dto.recipientId,
    ]);

    return payload;
  }

  async findMessagesForProduct(
    productId: number,
    user: { id: number; role: UserRole },
    withUserId?: number,
  ): Promise<ChatMessage[]> {
    const product = await this.productModel.findByPk(productId);
    if (!product) {
      throw new NotFoundException('Produit introuvable.');
    }

    const clauses: WhereOptions<ChatMessage>[] = [{ productId }];

    const isSeller = product.sellerId === user.id;
    if (!isSeller && user.role !== 'admin') {
      clauses.push({
        [Op.or]: [{ senderId: user.id }, { recipientId: user.id }],
      });
    }

    if (withUserId && Number.isFinite(withUserId)) {
      if (user.role === 'admin') {
        clauses.push({
          [Op.or]: [{ senderId: withUserId }, { recipientId: withUserId }],
        });
      } else {
        clauses.push({
          [Op.and]: [
            {
              [Op.or]: [{ senderId: user.id }, { recipientId: user.id }],
            },
            {
              [Op.or]: [{ senderId: withUserId }, { recipientId: withUserId }],
            },
          ],
        });
      }
    }

    const where: WhereOptions<ChatMessage> =
      clauses.length === 1 ? clauses[0] : { [Op.and]: clauses };

    return this.messageModel.findAll({
      where,
      order: [['createdAt', 'ASC']],
      include: [
        {
          association: 'sender',
          attributes: ['id', 'email', 'displayName', 'role'],
        },
        {
          association: 'recipient',
          attributes: ['id', 'email', 'displayName', 'role'],
        },
      ],
    });
  }

  async findMyMessages(userId: number): Promise<ChatMessage[]> {
    return this.messageModel.findAll({
      where: {
        [Op.or]: [{ senderId: userId }, { recipientId: userId }],
      },
      order: [['createdAt', 'DESC']],
      include: [
        {
          association: 'product',
          attributes: ['id', 'name', 'imageUrl', 'sellerId'],
        },
        {
          association: 'sender',
          attributes: ['id', 'email', 'displayName', 'role'],
        },
        {
          association: 'recipient',
          attributes: ['id', 'email', 'displayName', 'role'],
        },
      ],
      limit: 100,
    });
  }

  async listConversationsForSeller(
    sellerId: number,
  ): Promise<ConversationThread[]> {
    const rows = await this.messageModel.findAll({
      order: [['createdAt', 'DESC']],
      include: [
        {
          association: 'product',
          required: true,
          where: { sellerId },
          attributes: ['id', 'name', 'imageUrl', 'sellerId'],
        },
        {
          association: 'sender',
          attributes: ['id', 'displayName', 'role'],
        },
        {
          association: 'recipient',
          attributes: ['id', 'displayName', 'role'],
        },
      ],
    });

    const threads = new Map<string, ConversationThread>();

    for (const row of rows) {
      const product = row.product;
      if (!product) {
        continue;
      }

      const counterpart =
        row.senderId === sellerId ? row.recipient : row.sender;
      if (!counterpart) {
        continue;
      }

      const key = `${product.id}:${counterpart.id}`;
      if (threads.has(key)) {
        continue;
      }

      const productId = Number(product.id);
      const counterpartId = Number(counterpart.id);
      const latestMessageId = Number(row.id);
      const latestMessageAt = new Date(
        row.createdAt as Date | string,
      ).toISOString();
      const latestMessageSenderId = Number(row.senderId);

      threads.set(key, {
        productId,
        productName: product.name,
        productImageUrl: product.imageUrl,
        counterpartId,
        counterpartDisplayName: counterpart.displayName,
        counterpartRole: counterpart.role,
        latestMessageId,
        latestMessageContent: row.content,
        latestMessageAt,
        latestMessageSenderId,
        unreadCount: 0,
      });
    }

    for (const row of rows) {
      const product = row.product;
      if (!product) {
        continue;
      }

      const counterpart =
        row.senderId === sellerId ? row.recipient : row.sender;
      if (!counterpart) {
        continue;
      }

      const key = `${product.id}:${counterpart.id}`;
      const currentThread = threads.get(key);
      if (!currentThread) {
        continue;
      }

      const counterpartId = Number(counterpart.id);
      const isUnreadForSeller =
        row.recipientId === sellerId &&
        row.senderId === counterpartId &&
        !row.readAt;
      if (isUnreadForSeller) {
        currentThread.unreadCount += 1;
      }
    }

    return Array.from(threads.values()).sort((a, b) => {
      return (
        new Date(b.latestMessageAt).getTime() -
        new Date(a.latestMessageAt).getTime()
      );
    });
  }

  async markConversationAsRead(
    userId: number,
    productId: number,
    withUserId: number,
  ): Promise<{ updatedCount: number }> {
    if (!Number.isFinite(productId) || productId <= 0) {
      throw new BadRequestException('Produit invalide.');
    }
    if (!Number.isFinite(withUserId) || withUserId <= 0) {
      throw new BadRequestException('Interlocuteur invalide.');
    }

    const [updatedCount] = await this.messageModel.update(
      { readAt: new Date() },
      {
        where: {
          productId,
          senderId: withUserId,
          recipientId: userId,
          readAt: null,
        },
      },
    );

    if (updatedCount > 0) {
      this.realtimeService.emitMessagesRead(productId, {
        productId,
        readerId: userId,
        withUserId,
        updatedCount,
      });
      this.realtimeService.emitConversationListUpdated([userId, withUserId]);
    }

    return { updatedCount };
  }
}
