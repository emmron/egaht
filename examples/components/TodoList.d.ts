import { ComponentType, ComponentProps } from '@eghact/runtime';

import { createEventDispatcher } from '@eghact/core';

export interface Props {
  title?: string;
  todos?: Todo[];
}

export interface Events {
  add: CustomEvent<any>;
  toggle: CustomEvent<any>;
  remove: CustomEvent<any>;
}

declare const TodoList: ComponentType<Props>;

export default TodoList;