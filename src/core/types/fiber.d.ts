interface Fiber<T extends string = string> {
  child: Fiber | null
  sibling: Fiber | null
  parent: Fiber | null

  /** @description 用于通过 fiber 创建 DOM 使用 */
  dom: HTMLElement | Text | null

  // 为了方便让 createDOM 将原来的 element 转成 DOM 逻辑复用，因此让 fiber 的结构和 element 保持一致
  type: T

  props: {
    /** @description 用于为 children element 创建 fiber 对象使用 */
    children: FiberChild[]
  }
}

type FiberChild = DidactElement | DidactTextElement | null | undefined
