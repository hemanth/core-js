var IS_PURE = require('../internals/is-pure');
var $ = require('../internals/export');
var global = require('../internals/global');
var getBuiltin = require('../internals/get-built-in');
var call = require('../internals/function-call');
var uncurryThis = require('../internals/function-uncurry-this');
var fails = require('../internals/fails');
var uid = require('../internals/uid');
var isArray = require('../internals/is-array');
var isConstructor = require('../internals/is-constructor');
var isObject = require('../internals/is-object');
var isSymbol = require('../internals/is-symbol');
var anObject = require('../internals/an-object');
var classof = require('../internals/classof');
var hasOwn = require('../internals/has-own-property');
var createNonEnumerableProperty = require('../internals/create-non-enumerable-property');
var ERROR_STACK_INSTALLABLE = require('../internals/error-stack-installable');

var Object = global.Object;
var Date = global.Date;
var Error = global.Error;
var EvalError = global.EvalError;
var RangeError = global.RangeError;
var ReferenceError = global.ReferenceError;
var SyntaxError = global.SyntaxError;
var TypeError = global.TypeError;
var URIError = global.URIError;
var PerformanceMark = global.PerformanceMark;
var performance = global.performance;
var mark = performance && performance.mark;
var clearMarks = performance && performance.clearMarks;
var WebAssembly = global.WebAssembly;
var CompileError = WebAssembly && WebAssembly.CompileError || Error;
var LinkError = WebAssembly && WebAssembly.LinkError || Error;
var RuntimeError = WebAssembly && WebAssembly.RuntimeError || Error;
var Set = getBuiltin('Set');
var Map = getBuiltin('Map');
var MapPrototype = Map.prototype;
var mapHas = uncurryThis(MapPrototype.has);
var mapGet = uncurryThis(MapPrototype.get);
var mapSet = uncurryThis(MapPrototype.set);
var setAdd = uncurryThis(Set.prototype.add);
var bolleanValueOf = uncurryThis(true.valueOf);
var numberValueOf = uncurryThis(1.0.valueOf);
var stringValueOf = uncurryThis(''.valueOf);
var getTime = uncurryThis(Date.prototype.getTime);
var PERFORMANCE_MARK = uid('structuredClone');
var DATA_CLONE_ERROR = 'DataCloneError';

// waiting for https://github.com/zloirock/core-js/pull/991
var DOMException = function (message, name) {
  try {
    return new global.DOMException(message, name);
  } catch (error) {
    return TypeError(message);
  }
};

var checkBasicSemantic = function (structuredCloneImplementation) {
  return !fails(function () {
    var set1 = new global.Set([7]);
    var set2 = structuredCloneImplementation(set1);
    var number = structuredCloneImplementation(Object(7));
    return set2 == set1 || !set2.has(7) || typeof number != 'object' || number != 7;
  });
};

// https://github.com/whatwg/html/pull/5749
var checkNewErrorsSemantic = function (structuredCloneImplementation) {
  return !fails(function () {
    var test = structuredCloneImplementation(new global.AggregateError([1], PERFORMANCE_MARK, { cause: 3 }));
    return test.name != 'AggregateError' || test.errors[0] != 1 || test.message != PERFORMANCE_MARK || test.cause != 3;
  });
};

// FF94+, NodeJS 17.0+, Deno 1.14+
var nativeStructuredClone = global.structuredClone;

// Chrome 78+, Safari 14.1+, NodeJS 16.0+, Deno 1.11+ (old Deno implementations too naive)
var structuredCloneFromMark = (function (structuredCloneFromMarkConstructorImplementation, structuredCloneFromMarkImplementation) {
  return checkBasicSemantic(structuredCloneFromMarkConstructorImplementation) ? structuredCloneFromMarkConstructorImplementation
    : checkBasicSemantic(structuredCloneFromMarkImplementation) && structuredCloneFromMarkImplementation;
})(function (value) {
  return new PerformanceMark(PERFORMANCE_MARK, { detail: value }).detail;
}, function (value) {
  // NodeJS haven't `PerformanceMark` constructor
  var result = call(mark, performance, PERFORMANCE_MARK, { detail: value });
  call(clearMarks, performance, PERFORMANCE_MARK);
  return result.detail;
});

var nativeRestrictedStructuredClone = checkBasicSemantic(nativeStructuredClone) ? nativeStructuredClone : structuredCloneFromMark;

// Chrome 82- implementation swaps `.name` and `.message` of cloned `DOMException`
// current Safari implementation can't clone errors
// no one of current implementations supports new (html/5749) error cloning semantic
var USE_STRUCTURED_CLONE_FROM_MARK = !IS_PURE && checkNewErrorsSemantic(structuredCloneFromMark);

var throwUncloneableType = function (type) {
  throw new DOMException('Uncloneable type: ' + type, DATA_CLONE_ERROR);
};

var structuredCloneInternal = function (value, map) {
  if (isSymbol(value)) throwUncloneableType('Symbol');
  if (!isObject(value)) return value;
  if (USE_STRUCTURED_CLONE_FROM_MARK) return structuredCloneFromMark(value);
  // effectively preserves circular references
  if (map) {
    if (mapHas(map, value)) return mapGet(map, value);
  } else map = new Map();

  var type = classof(value);
  var deep = false;
  var C, name, cloned, dataTransfer, i, length, key;

  switch (type) {
    case 'Array':
      cloned = [];
      deep = true;
      break;
    case 'Object':
      cloned = {};
      deep = true;
      break;
    case 'Map':
      cloned = new Map();
      deep = true;
      break;
    case 'Set':
      cloned = new Set();
      deep = true;
      break;
    case 'Error':
      name = value.name;
      switch (name) {
        case 'AggregateError':
          cloned = getBuiltin('AggregateError')([]);
          break;
        case 'EvalError':
          cloned = EvalError();
          break;
        case 'RangeError':
          cloned = RangeError();
          break;
        case 'ReferenceError':
          cloned = ReferenceError();
          break;
        case 'SyntaxError':
          cloned = SyntaxError();
          break;
        case 'TypeError':
          cloned = TypeError();
          break;
        case 'URIError':
          cloned = URIError();
          break;
        case 'CompileError':
          cloned = CompileError();
          break;
        case 'LinkError':
          cloned = LinkError();
          break;
        case 'RuntimeError':
          cloned = RuntimeError();
          break;
        default:
          cloned = Error();
      }
      deep = true;
      break;
    case 'DOMException':
      cloned = new DOMException(value.message, value.name);
      deep = true;
      break;
    case 'DataView':
    case 'Int8Array':
    case 'Uint8Array':
    case 'Uint8ClampedArray':
    case 'Int16Array':
    case 'Uint16Array':
    case 'Int32Array':
    case 'Uint32Array':
    case 'Float32Array':
    case 'Float64Array':
    case 'BigInt64Array':
    case 'BigUint64Array':
      C = global[type];
      if (!isConstructor(C)) throwUncloneableType(type);
      cloned = new C(
        // this is safe, since arraybuffer cannot have circular references
        structuredCloneInternal(value.buffer, map),
        value.byteOffset,
        type === 'DataView' ? value.byteLength : value.length
      );
      break;
    case 'DOMQuad':
      C = global.DOMQuad;
      if (isConstructor(C)) {
        cloned = new C(
          structuredCloneInternal(value.p1, map),
          structuredCloneInternal(value.p2, map),
          structuredCloneInternal(value.p3, map),
          structuredCloneInternal(value.p4, map)
        );
      } else if (nativeRestrictedStructuredClone) {
        cloned = nativeRestrictedStructuredClone(value);
      } else throwUncloneableType(type);
      break;
    case 'FileList':
      C = global.DataTransfer;
      if (isConstructor(C)) {
        dataTransfer = new C();
        for (i = 0, length = value.length; i < length; i++) {
          dataTransfer.items.add(structuredCloneInternal(value[i], map));
        }
        cloned = dataTransfer.files;
      } else if (nativeRestrictedStructuredClone) {
        cloned = nativeRestrictedStructuredClone(value);
      } else throwUncloneableType(type);
      break;
    case 'ImageData':
      C = global.ImageData;
      if (isConstructor(C)) {
        cloned = new C(
          structuredCloneInternal(value.data, map),
          value.width,
          value.height,
          { colorSpace: value.colorSpace }
        );
      } else if (nativeRestrictedStructuredClone) {
        cloned = nativeRestrictedStructuredClone(value);
      } else throwUncloneableType(type);
      break;
    default:
      if (nativeRestrictedStructuredClone) {
        cloned = nativeRestrictedStructuredClone(value);
      } else switch (type) {
        case 'BigInt':
          // can be a 3rd party polyfill
          cloned = Object(value.valueOf());
          break;
        case 'Boolean':
          cloned = Object(bolleanValueOf(value));
          break;
        case 'Number':
          cloned = Object(numberValueOf(value));
          break;
        case 'String':
          cloned = Object(stringValueOf(value));
          break;
        case 'Date':
          cloned = new Date(getTime(value));
          break;
        case 'RegExp':
          cloned = new RegExp(value);
          break;
        case 'ArrayBuffer':
          // detached buffers throws on `.slice`
          try {
            cloned = value.slice(0);
          } catch (error) {
            throw new DOMException('ArrayBuffer is deatched', DATA_CLONE_ERROR);
          } break;
        case 'SharedArrayBuffer':
          // SharedArrayBuffer should use shared memory, we can't polyfill it, so return the original
          cloned = value;
          break;
        case 'Blob':
          try {
            cloned = value.slice(0, value.size, value.type);
          } catch (error) {
            throwUncloneableType(type);
          } break;
        case 'DOMPoint':
        case 'DOMPointReadOnly':
          C = global[type];
          try {
            cloned = C.fromPoint ? C.fromPoint(value) : new C(value.x, value.y, value.z, value.w);
          } catch (error) {
            throwUncloneableType(type);
          } break;
        case 'DOMRect':
        case 'DOMRectReadOnly':
          C = global[type];
          try {
            cloned = C.fromRect ? C.fromRect(value) : new C(value.x, value.y, value.width, value.height);
          } catch (error) {
            throwUncloneableType(type);
          } break;
        case 'DOMMatrix':
        case 'DOMMatrixReadOnly':
          C = global[type];
          try {
            cloned = C.fromMatrix ? C.fromMatrix(value) : new C(value);
          } catch (error) {
            throwUncloneableType(type);
          } break;
        case 'AudioData':
        case 'VideoFrame':
          try {
            cloned = value.clone();
          } catch (error) {
            throwUncloneableType(type);
          } break;
        case 'File':
          try {
            cloned = new File([value], value.name, value);
          } catch (error) {
            throwUncloneableType(type);
          } break;
        default:
          throwUncloneableType(type);
      }
  }

  mapSet(map, value, cloned);

  if (deep) switch (type) {
    case 'Array':
    case 'Object':
      for (key in value) if (hasOwn(value, key)) {
        cloned[key] = structuredCloneInternal(value[key], map);
      } break;
    case 'Map':
      value.forEach(function (v, k) {
        mapSet(cloned, structuredCloneInternal(k, map), structuredCloneInternal(v, map));
      });
      break;
    case 'Set':
      value.forEach(function (v) {
        setAdd(cloned, structuredCloneInternal(v, map));
      });
      break;
    case 'Error':
      createNonEnumerableProperty(cloned, 'message', structuredCloneInternal(value.message, map));
      if (hasOwn(value, 'cause')) {
        createNonEnumerableProperty(cloned, 'cause', structuredCloneInternal(value.cause, map));
      }
      if (name == 'AggregateError') {
        cloned.errors = structuredCloneInternal(value.errors, map);
      } // fallthrough
    case 'DOMException':
      if (ERROR_STACK_INSTALLABLE) {
        createNonEnumerableProperty(cloned, 'stack', structuredCloneInternal(value.stack, map));
      }
  }

  return cloned;
};

// current FF implementation can't clone errors
// https://bugzilla.mozilla.org/show_bug.cgi?id=1556604
// no one of current implementations supports new (html/5749) error cloning semantic
var FORCED_REPLACEMENT = IS_PURE || !checkNewErrorsSemantic(nativeStructuredClone);

var PROPER_TRANSFER = nativeStructuredClone && !fails(function () {
  var buffer = new global.ArrayBuffer(8);
  var clone = nativeStructuredClone(buffer, { transfer: [buffer] });
  return buffer.byteLength != 0 || clone.byteLength != 8;
});

$({ global: true, enumerable: true, sham: true, forced: FORCED_REPLACEMENT }, {
  structuredClone: function structuredClone(value /* , { transfer } */) {
    var options = arguments.length > 1 ? anObject(arguments[1]) : undefined;
    var transfer = options ? options.transfer : undefined;
    var map, transfered, i;

    if (transfer !== undefined) {
      if (!PROPER_TRANSFER) throw TypeError('Transfer option is not supported');
      if (!isArray(transfer)) throw TypeError('Transfer option should be an array');
      map = new Map();
      transfered = nativeStructuredClone(transfer, { transfer: transfer });
      i = transfered.length;
      while (i--) mapSet(map, transfer[i], transfered[i]);
    }

    return structuredCloneInternal(value, map);
  }
});
