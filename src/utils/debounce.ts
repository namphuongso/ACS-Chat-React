export const debounce = <T extends (...args: never[]) => unknown>(fn: T): T => fn;
