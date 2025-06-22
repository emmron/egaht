import { ComponentType, ComponentProps } from '@eghact/runtime';

export interface Props {
  user?: object;
}

export interface Slots {
  default: Record<string, any>;
}

declare const UserCard: ComponentType<Props>;

export default UserCard;