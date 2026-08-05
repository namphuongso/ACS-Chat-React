export const throttle = <T extends (...args: never[]) => unknown>(fn: T): T => fn;
const myFunc = (a: string, b: number) => a.length + b;
const throttled = throttle(myFunc);
throttled("test", 1);
