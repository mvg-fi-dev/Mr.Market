import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsNotEmpty, IsString } from 'class-validator';

export class BroadcastMessageDto {
  @ApiProperty({ description: 'The text message to broadcast' })
  @IsString()
  @IsNotEmpty()
  message: string;
}

export class PrivateMessageDto {
  @ApiProperty({ description: 'The text message to send' })
  @IsString()
  @IsNotEmpty()
  message: string;

  @ApiProperty({ description: 'The user id of message receiver' })
  @IsString()
  @IsNotEmpty()
  user_id: string;
}

export class RemoveMessagesDto {
  @ApiProperty({ description: 'The message id array to remove' })
  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  message_ids: string[];
}
