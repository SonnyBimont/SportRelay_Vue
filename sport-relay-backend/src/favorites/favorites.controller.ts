import {
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { JwtUser } from '../auth/interfaces/jwt-user.interface';
import { FavoritesService } from './favorites.service';

@UseGuards(JwtAuthGuard)
@Controller('favorites')
export class FavoritesController {
  constructor(private readonly favoritesService: FavoritesService) {}

  @Get('my-products')
  async myFavoriteProducts(@CurrentUser() user: JwtUser) {
    return this.favoritesService.listFavoriteProducts(user.sub);
  }

  @Get('my')
  async myFavorites(@CurrentUser() user: JwtUser) {
    const productIds = await this.favoritesService.listFavoriteProductIds(
      user.sub,
    );
    return { productIds };
  }

  @Post(':productId')
  async addFavorite(
    @CurrentUser() user: JwtUser,
    @Param('productId', ParseIntPipe) productId: number,
  ) {
    await this.favoritesService.addFavorite(user.sub, productId);
    return { isFavorite: true };
  }

  @Delete(':productId')
  async removeFavorite(
    @CurrentUser() user: JwtUser,
    @Param('productId', ParseIntPipe) productId: number,
  ) {
    await this.favoritesService.removeFavorite(user.sub, productId);
    return { isFavorite: false };
  }
}
