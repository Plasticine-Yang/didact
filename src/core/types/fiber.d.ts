interface Fiber<
  T extends string | JSXElementConstructor<any> =
    | string
    | JSXElementConstructor<any>,
> {
  child: Fiber | null
  sibling: Fiber | null
  parent: Fiber | null

  /** @description 用于通过 fiber 创建 DOM 使用 */
  dom: DidactDOM | null

  // 为了方便让 createDOM 将原来的 element 转成 DOM 逻辑复用，因此让 fiber 的结构和 element 保持一致
  type: T

  props: {
    /** @description 用于为 children element 创建 fiber 对象使用 */
    children: FiberChild[]
  }

  /** @description 每个 fiber 对应的旧 fiber */
  alternate: Fiber | null

  /** @description commit 阶段要如何处理 fiber */
  effectTag: 'UPDATE' | 'PLACEMENT' | 'DELETION' | null
}

type FiberChild = DidactElement | DidactTextElement | null | undefined
