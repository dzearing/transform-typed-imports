// Test: aliased type imports
import { IFoo as Foo } from "foo";

export default function test(foo: Foo) {
  console.log(foo);
}
