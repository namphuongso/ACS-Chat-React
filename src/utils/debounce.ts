export const debounce = <T extends (...args: unknown[]) => unknown>(fn: T): T => fn;
