const Mirai = require('node-mirai-sdk');
const fs = require('fs');
const { join } = require('path');

class xiling {
    constructor(options) {
        this.options = options;
        this.enableWebsocket = false;
        try {
            fs.mkdirSync("./options");
        } catch (err) {};
        if (!options.host) {
            throw "缺少参数 host[主机地址]";
        }
        if (!options.verifyKey) {
            throw "缺少参数 verifyKey[验证参数]";
        }
        if (!options.qq) {
            throw "缺少参数 qq[bot qq号]";
        }
        if (!options.dev) {
            throw "缺少参数 dev[管理员qq]";
        }
        if (options.autoLoadPlugin === undefined) {
            this.options.autoLoadPlugin = false;
        }
        if (!options.commandPrefix) {
            this.options.commandPrefix = "#";
        }
        if (this.options.autoLoadPlugin) {
            this.autoLoadPlugin();
        }
        this.bot = new Mirai(options);
        // auth 认证(*)
        this.bot.onSignal('authed', () => {
            console.log(`[汐灵] 正在认证`);
            this.bot.verify();
        });
        // session 校验回调
        this.bot.onSignal('verified', async () => {
            console.log(`[汐灵] 认证通过 key:${this.bot.sessionKey}`);
        });
        // 接收消息
        this.bot.onMessage(async msg => {
            // 接收消息并处理
            this.onMsg(msg);
        });

        this.pluginsList = []; // 插件列表
        this.priority = {}; // 最高优先级判断是否继续执行,例如黑名单判断
        this.command = {}; // 触发命令,需要手动唤醒命令
        this.passive = {}; // 监听命令,消息触发执行
        this.commandPrefix = new RegExp(`^${this.options.commandPrefix}`); // 命令前缀

        this.builtInCommands = { // 内置功能
            功能列表: (msg) => {
                let funList = "当前可用功能：";
                console.log(this.pluginsList)
                this.pluginsList.forEach((item, index, array) => {
                    if (item.pasName.length) {
                        funList += `\n${item.name}`;
                        funList += `\n    ${this.options.commandPrefix}`;
                        funList += item.pasName.join(`\n    ${this.options.commandPrefix}`);
                    }
                })
                msg.reply([{ type: "Plain", text: funList }], msg);
            }
        }
    }
    // 优先功能判断
    prerequisite(msg) {
        for (var key in this.priority) {
            if (this.priority[key](msg)) {
                return false;
            }
        }
        return true;
    }
    // 自动加载插件
    autoLoadPlugin() {
        fs.stat("./plugin", (err, stats) => {
            console.log("[汐灵] 尝试自动加载插件");
            if (!err && stats.isDirectory()) {
                fs.readdir("./plugin", (err, files) => {
                    files.forEach(item => {
                        this.use(require(join(process.cwd(), "./plugin/", item)));
                    })
                })
            } else {
                console.log("[汐灵] 没有找到plugin目录");
                fs.mkdirSync("./plugin");
            }
        });
        fs.stat("./node_modules/@xiling-bot", (err, stats) => {
            if (!err && stats.isDirectory()) {
                fs.readdir("./node_modules/@xiling-bot", (err, files) => {
                    files.forEach(item => {
                        if (item !== "xiling") {
                            this.use(require(join(process.cwd(), "./node_modules/@xiling-bot", item)));
                        }
                    })
                })
            }
        });
    }
    // 加载插件
    use(plugin) {
        console.log("[汐灵] 加载插件", plugin.name)
        //      最高优先级  主动功能 被动功能 加载时触发 未知命令处理函数 插件名
        const { priority, command, passive, mounted, noneCommand, name } = plugin;
        let pluginName = name, // 插件名称
            preName = [], // 优先功能名称
            pasName = [], // 主动功能名称
            proName = []; // 被动功能名称
        // 初始化插件
        if (mounted) {
            mounted(this.options, this.bot);
        }
        // 未定义命令处理方法,只能有一个且无法被覆盖
        if (noneCommand && !this.noneCommand) {
            this.noneCommand = noneCommand.exce;
            console.log(`[汐灵] 未知命令处理方法被定义为 ${noneCommand.name}`);
        }
        // 先决条件
        if (priority) {
            if (Array.isArray(priority)) {
                priority.map(obj => {
                    this.priority[obj.name] = obj.exce;
                    preName.push(obj.name);
                })
            } else {
                this.priority[priority.name] = priority.exce;
                preName.push(priority.name);
            }
        }
        // 需要主动触发命令
        if (command) {
            if (Array.isArray(command)) {
                command.map(obj => {
                    this.command[obj.name] = obj.exce;
                    pasName.push(obj.name);
                })
            } else {
                this.command[command.name] = command.exce;
                pasName.push(command.name);
            }
        }
        // 被动触发命令
        if (passive) {
            if (Array.isArray(passive)) {
                passive.map(obj => {
                    this.passive[obj.name] = obj.exce;
                    proName.push(obj.name);
                })
            } else {
                this.passive[passive.name] = passive.exce;
                proName.push(passive.name);
            }
        }
        this.pluginsList.push({
            name: pluginName,
            preName,
            pasName,
            proName
        })
    }
    // 消息监听
    onMsg(msg) {
        // 额外添加字符串
        msg.plain = ''
        for (var i = 0; i < msg.messageChain.length; i++) {
            if (msg.messageChain[i].type === "Plain") {
                msg.plain += msg.messageChain[i].text;
            }
        }

        // 额外添加方法,快速判断@事件
        msg.isAt = (id) => {
            let _id = id ? id : this.options.qq;
            for (var i = 0; i < msg.messageChain.length; i++) {
                if (msg.messageChain[i].type === "At" && msg.messageChain[i].target === _id) {
                    return true;
                }
            }
            return false;
        }

        // 先决条件判断,返回false阻止运行
        if (!this.prerequisite(msg)) {
            return false;
        }

        // At事件
        if (msg.isAt()) {
            this.noneCommand(msg);
        }

        // 命令触发功能
        if (this.commandPrefix.test(msg.plain)) {
            // 需要执行的命令
            let commandTriggers = msg.plain.replace(this.commandPrefix, "").split("\n")[0];
            // 命令参数
            let parameter = [],
                tempArr = msg.plain.split("\n");
            for (var i = 0; i < tempArr.length; i++) {
                if (tempArr[i]) {
                    parameter.push(tempArr[i]);
                }
            }
            parameter.shift();

            console.log(`[汐灵] 命令:${commandTriggers}`);
            console.log(`[汐灵] 附加参数:`, parameter);
            if (this.builtInCommands[commandTriggers]) { // 内置命令
                try {
                    this.builtInCommands[commandTriggers](msg, parameter);
                } catch (err) {
                    console.log(`[汐灵] ${commandTriggers} 自带命令功能出错`, err);
                }
            } else if (this.command[commandTriggers]) { // 插件命令
                try {
                    this.command[commandTriggers](msg, parameter);
                } catch (err) {
                    console.log(`[汐灵] ${commandTriggers} 命令功能出错`, err);
                }
            } else {
                // 没有找到命令时会执行特定方法
                console.log("[汐灵] 没有找到指定命令");
                if (this.noneCommand) {
                    this.noneCommand(msg);
                }
            }
        } else {
            // 被动触发命令
            for (var key in this.passive) {
                try {
                    let next = this.passive[key](msg);
                    // 如果返回false则不执行之后的命令
                    console.log(`[汐灵]`, key, next);
                    if (!next) {
                        console.log("[汐灵] 阻止继续执行");
                        break;
                    }
                } catch (err) {
                    console.log(`[汐灵] ${key} 插件被动功能出错`, err);
                }
            }
        }
        console.log(`[汐灵]`, msg);
    }
    // 开始监听
    listen(...types) {
        this.bot.listen(...types);
    }
}

module.exports = xiling;