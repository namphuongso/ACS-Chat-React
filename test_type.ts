export const throttle1 = <T extends (...args: never[]) => unknown>(fn: T): T => fn;
export const throttle2 = <T extends (...args: never[]) => unknown>(fn: T): T => fn;
export const throttle3 = <Args extends unknown[], Return>(fn: (...args: Args) => Return): (...args: Args) => Return => fn;
export const throttle4 = <T extends (...args: never[]) => unknown>(fn: T): T => fn;
