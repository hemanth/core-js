export const DESCRIPTORS = !!(() => {
  try {
    return Object.defineProperty({}, 'a', {
      get() {
        return 7;
      },
    }).a === 7;
  } catch { /* empty */ }
})();

export const GLOBAL = Function('return this')();

export const NATIVE = GLOBAL.NATIVE || false;

export const NODE = Object.prototype.toString.call(GLOBAL.process).slice(8, -1) === 'process';

const $TYPED_ARRAYS = {
  Float32Array: 4,
  Float64Array: 8,
  Int8Array: 1,
  Int16Array: 2,
  Int32Array: 4,
  Uint8Array: 1,
  Uint16Array: 2,
  Uint32Array: 4,
  Uint8ClampedArray: 1,
};

export const TYPED_ARRAYS = [];

for (const name in $TYPED_ARRAYS) TYPED_ARRAYS.push({
  name,
  TypedArray: GLOBAL[name],
  bytes: $TYPED_ARRAYS[name],
  $: Number,
});

export const TYPED_ARRAYS_WITH_BIG_INT = TYPED_ARRAYS.slice();

for (const name of ['BigInt64Array', 'BigUint64Array']) if (GLOBAL[name]) TYPED_ARRAYS_WITH_BIG_INT.push({
  name,
  TypedArray: GLOBAL[name],
  bytes: 8,
  // eslint-disable-next-line es-x/no-bigint -- safe
  $: BigInt,
});

export const LITTLE_ENDIAN = (() => {
  try {
    return new GLOBAL.Uint8Array(new GLOBAL.Uint16Array([1]).buffer)[0] === 1;
  } catch {
    return true;
  }
})();

export const PROTO = !!Object.setPrototypeOf || '__proto__' in Object.prototype;

export const STRICT = !function () {
  return this;
}();

export const STRICT_THIS = (function () {
  return this;
})();

export const FREEZING = !function () {
  try {
    return Object.isExtensible(Object.preventExtensions({}));
  } catch {
    return true;
  }
}();

export const CORRECT_PROTOTYPE_GETTER = !function () {
  try {
    function F() { /* empty */ }
    F.prototype.constructor = null;
    return Object.getPrototypeOf(new F()) !== F.prototype;
  } catch {
    return true;
  }
}();

// FF < 23 bug
export const REDEFINABLE_ARRAY_LENGTH_DESCRIPTOR = DESCRIPTORS && !function () {
  try {
    Object.defineProperty([], 'length', { writable: false });
  } catch {
    return true;
  }
}();

export const WHITESPACES = '\u0009\u000A\u000B\u000C\u000D\u0020\u00A0\u1680\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200A\u202F\u205F\u3000\u2028\u2029\uFEFF';
