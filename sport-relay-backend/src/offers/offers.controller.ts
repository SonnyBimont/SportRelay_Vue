import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { JwtUser } from '../auth/interfaces/jwt-user.interface';
import { CreateOfferDto } from './dto/create-offer.dto';
import { UpdateOfferStatusDto } from './dto/update-offer-status.dto';
import { OffersService } from './offers.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('offers')
export class OffersController {
  constructor(private readonly offersService: OffersService) {}

  @Roles('buyer', 'seller', 'admin')
  @Post()
  create(@CurrentUser() user: JwtUser, @Body() dto: CreateOfferDto) {
    return this.offersService.createOffer(user.sub, dto);
  }

  @Roles('buyer', 'seller', 'admin')
  @Get('my')
  myOffers(@CurrentUser() user: JwtUser) {
    return this.offersService.findMyOffers(user.sub);
  }

  @Roles('seller', 'admin')
  @Get('received')
  received(@CurrentUser() user: JwtUser) {
    return this.offersService.findReceivedOffers(user.sub);
  }

  @Roles('buyer', 'seller', 'admin')
  @Get('product/:productId')
  productOffers(
    @CurrentUser() user: JwtUser,
    @Param('productId') productId: string,
  ) {
    return this.offersService.findProductOffers(Number(productId), {
      id: user.sub,
      role: user.role,
    });
  }

  @Roles('seller', 'admin')
  @Patch(':id/status')
  updateStatus(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: UpdateOfferStatusDto,
  ) {
    return this.offersService.updateOfferStatus(
      Number(id),
      {
        id: user.sub,
        role: user.role,
      },
      dto,
    );
  }
}
