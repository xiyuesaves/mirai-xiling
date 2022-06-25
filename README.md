# mirai-xiling
基于node-mirai的插件加载框架

## 安装

```
npm install -S @xiling-bot/xiling
```

## 使用

```js
const Xiling = require("@xiling-bot/mirai-xiling");

// 配置项
const options = {
    host: "localhost:88", // mirai-http-api 地址
    verifyKey: 123456789, // 验证key
    qq: 123456789, // bot qq号
    dev: 123456789, // 管理员qq号
    autoLoadPlugin: true, // [不推荐]自动加载plugin和@xiling-bot目录下的插件
    commandPrefix: "#" // 命令前缀
}
const xiling = new Xiling(options);

xiling.use(require("./mirai-xiling-plugins/sleep")); // 手动加载插件

// 开始监听消息
xiling.listen("all"); // 'friend', 'group', 'temp', 'all'
```

## 插件开发

```js
// 基础演示插件
const plug = {
    name: "插件名称",
    mounted(xilingOptions) { // 该方法会在插件被加载时触发, 参数是xiling的配置项, 此处可以用来载入插件配置信息等
        console.log(xilingOptions);
    },
    command: [{ // 命令方法, 需要主动使用命令来唤醒执行, 此处需要使用"#方法1"来激活
        name: "方法1",
        exce(msg, parameter) {
            msg.reply([{ type: "Plain", text: "我是方法1" }]);
        }
    }]
    priority: [{ // 最高优先级方法,如果此方法返回 true 则bot不会处理这条消息, 示例中,如果发送消息内含有"不执行"则该消息不会被处理
        name: "最高优先级方法",
        exce(msg) {
            if (msg.plain.includes("不执行")) {
                return true;
            }
            return false;
        }
    }]
    passive: [{ // 监听方法,此方法会处理所有未被 command 处理,且未被 priority 阻止的消息, 这是个简易复读机案例
        name: "监听方法",
        exce(msg) {
            msg.reply(msg.messageChain, msg);
        }
    }]
}

module.exports = plug;
```
一些自带的插件:
[mirai-xiling-plugins](https://github.com/xiyuesaves/mirai-xiling-plugins)
