// script_plugin add 测试脚本示例
const testFunction = () => {
  console.log('这是一个测试脚本示例');
  return '测试成功';
};

// script_plugin add 另一个测试脚本
function anotherTest() {
  return {
    name: '测试插件',
    version: '1.0.0'
  };
}

export { testFunction, anotherTest };