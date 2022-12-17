/** @description 判断是否是有效的 property */
const isProperty = (key: string) =>
  key !== 'children' && !isEventPropertyKey(key)

/** @description 判断是否是新 props 中不存在的 property */
const isGone = (nextProps: Fiber['props']) => (key: string) =>
  !(key in nextProps)

/** @description 判断是否是旧 props 中不存在的 property */
const isNew =
  (prevProps: Fiber['props'], nextProps: Fiber['props']) => (key: string) =>
    prevProps[key] !== nextProps[key]

/** @description 判断是否是事件属性名 */
const isEventPropertyKey = (key: string) => key.startsWith('on')

/** @description 获取事件属性名 */
const eventType = (name: string) => name.toLowerCase().substring(2)

/** @description 判断 fiber 是否是函数组件 */
const isFunctionComponent = (fiber: Fiber) => typeof fiber.type === 'function'

export {
  isProperty,
  isGone,
  isNew,
  isEventPropertyKey,
  eventType,
  isFunctionComponent,
}
