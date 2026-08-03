export const throttle = <T extends (...args: unknown[]) => unknown>(fn: T): T => fn;
