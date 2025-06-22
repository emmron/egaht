import { ComponentType, ComponentProps } from '@eghact/runtime';

import { createEventDispatcher } from '@eghact/core';

export interface Props {
  variant?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
  onClick?: (event: MouseEvent);
}

export interface Events {
  click: CustomEvent<any>;
}

declare const Button: ComponentType<Props>;

export default Button;