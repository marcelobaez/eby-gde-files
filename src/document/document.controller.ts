import { Controller, Get, Header, HttpException, HttpStatus, Query, StreamableFile, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthGuard } from '@nestjs/passport';
import { createReadStream, accessSync } from 'fs';
import { join } from 'path';
import { FindDocDto, DownloadDocDto } from './dto/document.dto';

@Controller('document')
export class DocumentController {
  constructor(private configService: ConfigService) {}

  @Get()
  @UseGuards(AuthGuard('api-key'))
  @Header('Content-Type', 'application/pdf')
  @Header('Content-Disposition', 'attachment;')
  getFile(@Query() query: DownloadDocDto): StreamableFile {

    const filePath = join(this.configService.get<string>('BASE_SHARED_PATH'), query.path);

    try {
      accessSync(filePath);
      const file = createReadStream(filePath);
      return new StreamableFile(file);
    } catch (err) {
      throw new HttpException({
        status: HttpStatus.NOT_FOUND,
        error: 'No se encontro el documento',
      }, HttpStatus.NOT_FOUND);
    }
  }

  @Get('/check')
  @UseGuards(AuthGuard('api-key'))
  checkFile(@Query() query: FindDocDto) {
    const fullNumber = query.number.padStart(8, '0');
    const fileName = `${query.type}-${query.year}-${fullNumber}-${query.system}-${query.location}`;
    const millions = fullNumber.substring(0, 2);
    const thousands = fullNumber.substring(2, 5);
    const filePath = `${query.year}/${query.location}/${millions}/${thousands}/${fileName}/${fileName}.pdf`;

    const fullFilePath = join(this.configService.get<string>('BASE_SHARED_PATH'), filePath);

    try {
      accessSync(fullFilePath);
      
      return filePath;
    } catch (err) {
      throw new HttpException({
        status: HttpStatus.NOT_FOUND,
        error: 'No se encontro el documento',
      }, HttpStatus.NOT_FOUND);
    }
  }
}
