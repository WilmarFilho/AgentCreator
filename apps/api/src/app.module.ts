import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { RaioXModule } from './raio-x/raio-x.module';
import { ConfigModule } from '@nestjs/config';
import { StudioModule } from './studio/studio.module';
import { FactoryModule } from './factory/factory.module';
import { FineTuneModule } from './fine-tune/fine-tune.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    RaioXModule,
    StudioModule,
    FactoryModule,
    FineTuneModule
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
