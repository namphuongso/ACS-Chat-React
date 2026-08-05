import { throttle1, throttle2, throttle3 } from './test_type';

const t1 = throttle1((x: number) => x.toString());
const t2 = throttle2((x: number) => x.toString());
const t3 = throttle3((x: number) => x.toString());

t1(1);
t2(1);
t3(1);
