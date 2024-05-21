// 类型定义
import type { ReactElement, ReactNode, RefObject } from 'react';

/** AsyncRender 组件的静态方法 */
export interface AsyncRenderStatic {
  /** 根据 id 刷新请求 */
  reload(id: string): void;
  /** 根据 id 刷新请求，同时传递请求参数 */
  reload(id: string, ...args: any[]): void;
  /** 根据 id 列表批量刷新请求 */
  reload(idList: string[]): void;
}

/** AsyncRender 组件的参数类型 */
export interface AsyncRenderType<T> {
  /** 组件依赖的 Promise 对象  */
  data: (...args: any[]) => Promise<T>;
  /** 要渲染的组件 */
  component: (data: T) => ReactElement;
  /** 占位内容 */
  placeholder?: ReactNode;
  /** id 相同时共享同一请求 */
  id?: string;
  /** 请求加载完毕时的事件监听 */
  onDataLoad?: (data: T) => void;
  /** 其他属性 */
  [key: string]: unknown;
}

/** AsyncRenderCore 组件的参数类型 */
export interface AsyncRenderCoreType<T> {
  /** 组件依赖的 Promise 对象  */
  data: () => Promise<T>;
  /** 要渲染的组件 */
  component: (data: T) => ReactElement;
  /** id 相同时共享同一请求 */
  id: string;
  /** 请求加载完毕时的事件监听 */
  onDataLoad?: (data: T) => void;
  /** 内部透传的 ref */
  ref: RefObject<ActionType>;
}

/** 用于操作 AsyncRender 组件行为的 ref */
export type ActionType = {
  /** 重新触发网络请求 */
  reload: VoidFunction;
};
