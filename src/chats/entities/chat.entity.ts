import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Thread } from '../../threads/entities/thread.entity';

@Entity('chats')
@Index(['threadId', 'createdAt'])
export class Chat {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  threadId: string;

  @ManyToOne(() => Thread, (thread) => thread.chats, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'threadId' })
  thread: Thread;

  @Column('text')
  question: string;

  @Column('text')
  answer: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
