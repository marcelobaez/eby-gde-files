import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { DocumentController } from './document/document.controller';

@Module({
  imports: [ConfigModule.forRoot({isGlobal: true}), AuthModule],
  controllers: [AppController, DocumentController],
  providers: [AppService],
})
export class AppModule {}
