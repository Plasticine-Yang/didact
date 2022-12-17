/** @description setState 的参数类型 */
type SetStateAction<T> = (state: T) => T

interface UseStateHook<T> {
  /** @description hook 的 state */
  state: T

  /** @description 多次 setState 调用 */
  queue: SetStateAction<T>[]
}
