import { Sandbox } from '@vercel/sandbox';

async function test() {
  console.log(Object.getOwnPropertyNames(Sandbox));
  console.log(Object.getOwnPropertyNames(Sandbox.prototype));
}
test();
