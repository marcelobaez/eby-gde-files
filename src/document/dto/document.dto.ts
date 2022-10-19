import { IsInt, IsNotEmpty, IsString } from 'class-validator';

//   const { type, year, number, system, location } = req.query;

export class FindDocDto {
  @IsString()
  @IsNotEmpty()
  readonly type: string;

  @IsInt()
  readonly year: number;

  @IsString()
  @IsNotEmpty()
  readonly number: string;

  @IsString()
  @IsNotEmpty()
  readonly system: string;

  @IsString()
  @IsNotEmpty()
  readonly location: string;
}

export class DownloadDocDto {
  @IsString()
  @IsNotEmpty()
  readonly path: string;
}