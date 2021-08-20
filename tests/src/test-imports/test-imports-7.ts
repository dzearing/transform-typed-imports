// Test: a default, type and real import
import foo, { IFoo } from "foo";

export default function test(f: IFoo) {
  console.log(f, foo);
}
