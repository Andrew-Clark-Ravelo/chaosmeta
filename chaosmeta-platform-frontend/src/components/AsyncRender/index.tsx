// react
import React, { useEffect, useId, forwardRef, useRef, useImperativeHandle, useMemo, useState } from 'react';
// UI 资产
import { ErrorBoundary } from '@ant-design/pro-components';
import { Spin } from 'antd';
// 类型定义
import type { Ref, ReactElement } from 'react';
import type { AsyncRenderType, AsyncRenderCoreType, ActionType, AsyncRenderStatic } from './interface';

/** 用于保证请求单例的 Map */
const umiOfKey: Map<
  string,
  Partial<{
    /** 当前网络请求的状态 */
    status: '请求中' | '请求成功' | '请求失败' | undefined;
    /** 网络请求的结果 */
    source: unknown;
    /** 网络请求 */
    requestPromise: Promise<unknown>;
    /** reload 当前组件请求的方法 */
    reload: (...args: any[]) => void;
    /** reload 时的实参 */
    reloadParams: any;
  }> | undefined
> = new Map();

/** useEvent 保证 callback 的调用函数在整个组件的生命周期内不变，又能使用最新的 state 和 props */
function useEvent<T extends (...args: never[]) => any>(callback: T): T {
  const fnRef = React.useRef<any>();
  fnRef.current = callback;

  const memoFn = React.useCallback<T>(
    ((...args: any) => fnRef.current?.(...args)) as any,
    [],
  );

  return memoFn;
}

/**
 * thorw 网络请求的 Promise 以让 <Suspense /> 捕获
 * @param data 组件渲染所依赖的请求数据
 */
function invokePromise(
  request: (...args: any[]) => Promise<unknown>,
  key: string,
) {
  /** 当前函数作用的上下文（也可以改为 apply / bind 形式） */
  const context = umiOfKey.get(key) ?? {};

  // suspense 处理逻辑
  if (context.status === '请求中') {
    throw context.requestPromise;
  }
  if (context.status === '请求失败') {
    // 这里 throw 了 reject 的 promise
    // 依赖外部的 <ErrorBoundary /> 捕获
    // TODO: 只期望 dev 环境 throw
  } else if (context.status === '请求成功') {
    context.status = undefined;

    umiOfKey.set(key, context);
    return context.source;
  } else {
    context.status = '请求中';
    context.requestPromise = request.apply(context, context.reloadParams) || Promise.resolve(undefined);
    context.requestPromise.then(
      (res) => {
        context.status = '请求成功';
        context.source = res;
      },
      (err) => {
        context.status = '请求失败';
        context.source = undefined;
        console.error('请求失败', err);
      },
    );

    umiOfKey.set(key, context);
    throw context.requestPromise;
  }
}

/** 比较两个值是否相同 */
function internalShallowEqual(a: any, b: any) {
  if (Object.is(a, b)) return true;
  // 排除任一变量为 null 的情况
  if (
    typeof a !== 'object' ||
    a === null ||
    typeof b !== 'object' ||
    b === null
  ) {
    return false;
  }
  // 先比较两个对象的键名个数
  // 不同则视为不相同
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) {
    return false;
  }
  // 最后比较两个对象的每一个键名以及值是否相同
  // 如果有一项不同则视为不相同
  for (let i = 0; i < keysA.length; i++) {
    const currentKey = keysA[i];
    if (
      // 数量一样但是名字可能不一样
      !Object.prototype.hasOwnProperty.call(b, currentKey) ||
      !Object.is(a[currentKey], b[currentKey])
    ) {
      return false;
    }
  }
  return true;
}

/** props 合并函数 */
function mergeProps<T extends Record<string, any>, U extends Record<string, any>>(a: T, b: U): T & U {
  const mergedProps: Record<string, any> = { ...a };
  Object.keys(b).forEach((key) => {
    const valueOne = a[key];
    const valueAnother = b[key];

    // 如果是函数，则创建新函数依次执行
    if (typeof valueOne === 'function' && typeof valueAnother === 'function') {
      mergedProps[key] = (...args: any[]) => {
        valueOne(...args);
        valueAnother(...args);
      };
    }
    // 如果是对象（但不是数组），则递归合并
    else if (
      typeof valueOne === 'object' && valueOne !== null && !Array.isArray(valueOne) &&
      typeof valueAnother === 'object' && valueAnother !== null && !Array.isArray(valueAnother)
    ) {
      mergedProps[key] = mergeProps(valueOne, valueAnother);
    }
    // 如果是数组，则合并数组
    else if (Array.isArray(valueOne) && Array.isArray(valueAnother)) {
      mergedProps[key] = [...valueOne, ...valueAnother];
    }
    // 基本类型或其他情况，后者覆盖前者
    else {
      mergedProps[key] = valueAnother;
    }
  });
  return mergedProps as T & U;
}

const AsyncRenderCoreWithRef = <T,>({ data, component, id, onDataLoad, ...ext }: AsyncRenderCoreType<T>, ref: Ref<ActionType>) => {
  // seed
  const [seed, updateSeed] = useState(0);
  // ref
  useImperativeHandle(ref, () => {
    {
      const prevInstance = umiOfKey.get(id);
      umiOfKey.set(id, {
        ...prevInstance,
        reload: (...ext) => {
          umiOfKey.set(id, { reloadParams: ext });
          updateSeed(prev => prev + 1);
        }
      })
    }

    return {
      reload: () => {
        umiOfKey.set(id, { reloadParams: ext });
        // 通过更新 seed 重新触发请求
        updateSeed(prev => prev + 1);
      }
    }
  }, [id]);
  // 调用网络请求
  // 必须要同步地进行接口调用
  useMemo(() => {
    // fetch 在业务中可能为空
    if (data) {
      /** 维护请求的 status */
      const status = umiOfKey.get(id)?.status;

      if (status !== '请求成功' && status !== '请求失败') {
        invokePromise(data, id);
      }
    }
  }, [id, seed]);
  // props 合并
  const Component = useEvent(() => {
    /** 组件渲染所依赖的数据 */
    const data: T = umiOfKey.get(id)?.source as T;
    /** 用户组件的渲染结果 */
    const renderResult = component(data);

    if (React.isValidElement(renderResult)) {
      return React.cloneElement(renderResult, mergeProps(ext, renderResult.props as any));
    }
    return null;
  });
  // data load
  useEffect(() => {
    Promise.resolve().then(() => {
      onDataLoad?.(umiOfKey.get(id)?.source as T);
    });
  }, [id, seed]);

  return <Component />;
};

const AsyncRenderCore = forwardRef(AsyncRenderCoreWithRef) as <T>(props: AsyncRenderCoreType<T> & { ref?: Ref<ActionType> }) => ReactElement;

const AsyncRenderWithRef = <T,>({ placeholder, id, ...ext }: AsyncRenderType<T>, ref: Ref<ActionType>) => {
  // 合并处理 id
  const internalId = useId();
  const mergedId = id || internalId;
  // ref
  const internalRef = useRef<ActionType>(null);
  useImperativeHandle(ref, () => {
    return {
      reload: () => internalRef.current?.reload(),
    }
  }, [mergedId]);

  /** 使用 React.memo 包裹 AsyncRenderCore 后的组件 */
  const MemorizedAsyncRenderCore = useMemo(() => {
    return React.memo(AsyncRenderCore, (prev: any, next: any) => {
      return internalShallowEqual(prev, next);
    }) as <T>(props: AsyncRenderCoreType<T> & { ref?: Ref<ActionType> }) => ReactElement;
  }, [mergedId]);

  useEffect(() => {
    // 组件卸载时释放维护的值
    // TODO: 增加额外参数用于控制是否缓存上次请求结果
    return () => {
      umiOfKey.delete(mergedId);
    };
  }, [mergedId]);

  return (
    <ErrorBoundary key={mergedId}>
      <React.Suspense fallback={placeholder ?? <Spin spinning />}>
        <MemorizedAsyncRenderCore id={mergedId} ref={internalRef} {...ext} />
      </React.Suspense>
    </ErrorBoundary>
  );
};

/** 异步渲染组件，常见使用场景是组件的渲染依赖某个请求的返回 */
const AsyncRender = forwardRef(AsyncRenderWithRef) as <T>(props: AsyncRenderType<T> & { ref?: Ref<ActionType> }) => ReactElement;

(AsyncRender as AsyncRenderExportType).reload = (id, ...ext) => {
  if (id instanceof Array) {
    id.forEach(i => {
      /** 对应实例 */
      const instance = umiOfKey.get(i);

      if (instance) {
        instance.reload?.();
      }
    })
  } else {
    /** 对应实例 */
    const instance = umiOfKey.get(id);

    if (instance) {
      instance.reload?.apply(this, ext);
    }
  }
}

type AsyncRenderExportType = typeof AsyncRender & AsyncRenderStatic;

export default AsyncRender as AsyncRenderExportType;

export type { ActionType };
