import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  async run() {
    this.getHello()
  }

  getHello() {
    console.log('Hello World!');
  }
}
