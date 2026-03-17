import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { JwtUser } from '../auth/interfaces/jwt-user.interface';
import { RealtimeService } from '../realtime/realtime.service';
import { CreateMessageDto } from './dto/create-message.dto';
import { MarkConversationReadDto } from './dto/mark-conversation-read.dto';
import { ChatMessage } from './entities/chat-message.entity';
import { ConversationThread, MessagesService } from './messages.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('messages')
export class MessagesController {
  constructor(
    private readonly messagesService: MessagesService,
    private readonly realtimeService: RealtimeService,
  ) {}

  @Roles('buyer', 'seller', 'admin')
  @Post()
  create(
    @CurrentUser() user: JwtUser,
    @Body() dto: CreateMessageDto,
  ): Promise<ChatMessage> {
    return this.messagesService.createMessage(user.sub, dto);
  }

  @Roles('buyer', 'seller', 'admin')
  @Get('my')
  myMessages(@CurrentUser() user: JwtUser): Promise<ChatMessage[]> {
    return this.messagesService.findMyMessages(user.sub);
  }

  @Roles('seller', 'admin')
  @Get('conversations')
  conversations(@CurrentUser() user: JwtUser): Promise<ConversationThread[]> {
    return this.messagesService.listConversationsForSeller(user.sub);
  }

  @Roles('buyer', 'seller', 'admin')
  @Get('presence')
  presence(@Query('userIds') userIdsRaw?: string) {
    if (!userIdsRaw) {
      return [];
    }

    const userIds = userIdsRaw
      .split(',')
      .map((value) => Number.parseInt(value.trim(), 10))
      .filter((value) => Number.isFinite(value) && value > 0);

    if (userIds.length === 0) {
      return [];
    }

    return this.realtimeService.getPresenceForUsers(userIds);
  }

  @Roles('buyer', 'seller', 'admin')
  @Post('read')
  markConversationRead(
    @CurrentUser() user: JwtUser,
    @Body() dto: MarkConversationReadDto,
  ) {
    return this.messagesService.markConversationAsRead(
      user.sub,
      Number(dto.productId),
      Number(dto.withUserId),
    );
  }

  @Roles('buyer', 'seller', 'admin')
  @Get('product/:productId')
  productMessages(
    @CurrentUser() user: JwtUser,
    @Param('productId') productId: string,
    @Query('withUserId') withUserId?: string,
  ): Promise<ChatMessage[]> {
    const parsedWithUserId = Number.parseInt(withUserId ?? '', 10);

    return this.messagesService.findMessagesForProduct(
      Number(productId),
      {
        id: user.sub,
        role: user.role,
      },
      Number.isFinite(parsedWithUserId) ? parsedWithUserId : undefined,
    );
  }
}
