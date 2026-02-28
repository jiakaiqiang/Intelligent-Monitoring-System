import { Controller, Post, Body } from '@nestjs/common';
import { AiService } from './ai.service';

@Controller('api')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('ai/analyze')
  async analyze(@Body() body: any) {
    console.log(body,'wefwfwfwfewfw');
    return this.aiService.analyzeError(body);
  }
}