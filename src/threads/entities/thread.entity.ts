import {
  Entity,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Column,
  Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Chat } from '../../chats/entities/chat.entity';

@Entity('threads')
@Index(['userId', 'createdAt'])
export class Thread {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @OneToMany(() => Chat, (chat) => chat.thread)
  chats: Chat[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
