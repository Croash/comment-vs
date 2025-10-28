"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// script_plugin add 
var testEnum;
(function (testEnum) {
    testEnum[testEnum["a"] = 12] = "a";
})(testEnum || (testEnum = {}));
// script_plugin add 测试枚举 - 正确格式
var testEnum2;
(function (testEnum2) {
    testEnum2[testEnum2["b"] = 13] = "b";
})(testEnum2 || (testEnum2 = {}));
//# sourceMappingURL=test-enum.js.map