import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { AppService } from './app.service';

async function bootstrap() {
  const appContext = await NestFactory.createApplicationContext(AppModule, {
    logger: false,
  });

  const appService = appContext.get(AppService);

  await appService.run();
  await appContext.close();
}
bootstrap();
