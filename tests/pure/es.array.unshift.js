import { DESCRIPTORS, STRICT } from '../helpers/constants';

import unshift from 'core-js-pure/es/array/virtual/unshift';
import defineProperty from 'core-js-pure/es/object/define-property';

QUnit.test('Array#unshift', assert => {
  assert.isFunction(unshift);

  assert.same(unshift.call([1], 0), 2, 'proper result');

  if (DESCRIPTORS) {
    assert.throws(() => unshift.call(defineProperty([], 'length', { writable: false }), 1), TypeError, 'now-writable length, with arg');
    assert.throws(() => unshift.call(defineProperty([], 'length', { writable: false })), TypeError, 'now-writable length, without arg');
  }

  if (STRICT) {
    assert.throws(() => unshift.call(null), TypeError);
    assert.throws(() => unshift.call(undefined), TypeError);
  }
});
