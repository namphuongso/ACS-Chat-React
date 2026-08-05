export const throttle = <T extends (...args: never[]) => unknown>(fn: T): T => fn;
