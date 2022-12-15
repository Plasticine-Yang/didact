import { isProperty } from './utils'

function render(element: DidactElement, container: HTMLElement): void {
  const { type, props } = element
  const { children } = props

  // 将 element 转成真实 DOM -- 需要注意对于文本节点类型的处理
  const dom =
    type === 'TEXT_ELEMENT'
      ? document.createTextNode('')
      : document.createElement(type)

  // 把 element.props 赋值到 DOM 元素上
  Object.keys(props)
    .filter(isProperty)
    .forEach((name) => {
      dom[name] = props[name]
    })

  // 渲染 children
  ;(children as DidactElement[]).forEach((child) => {
    // 能进来 forEach 循环说明不会是 TextNode，所以可以将 dom 大胆断言为 HTMLElement
    render(child, dom as HTMLElement)
  })

  // 把真实 DOM 加入到 container DOM 中
  container.appendChild(dom)
}

export { render }
