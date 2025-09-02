"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
let shouldStop = false;
process.on('message', async (msg) => {
    if (msg && msg.type === 'stop') {
        shouldStop = true;
        console.log('plugin_host.js received stop');
        return;
    }
    if (msg && msg.jsFile) {
        try {
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const mod = require('./' + msg.jsFile);
            let result;
            if (msg.call && msg.call.class && msg.call.method) {
                const Cls = mod[msg.call.class];
                if (!Cls)
                    throw new Error(`Class ${msg.call.class} not found`);
                const instance = new Cls();
                if (typeof instance[msg.call.method] !== 'function')
                    throw new Error(`Method ${msg.call.method} not found`);
                if (msg.call.method === 'processTasks' && Array.isArray(msg.call.args?.[0])) {
                    const tasks = msg.call.args[0];
                    const results = [];
                    for (let i = 0; i < tasks.length; i++) {
                        if (shouldStop) {
                            shouldStop = false;
                            console.log('plugin_host.js sent stopped');
                            process.send && process.send({ type: 'stopped', result: results });
                            return;
                        }
                        results.push(await instance[msg.call.method].call(instance, [tasks[i]]));
                    }
                    process.send && process.send({ success: true, result: results });
                    return;
                }
                result = await instance[msg.call.method](...(msg.call.args || [msg.data || msg.folderPath]));
            }
            else if (msg.call && msg.call.method && typeof mod[msg.call.method] === 'function') {
                result = await mod[msg.call.method](...(msg.call.args || [msg.data || msg.folderPath]));
            }
            else if (typeof mod === 'function') {
                result = await mod(msg.data);
            }
            else {
                result = mod;
            }
            process.send && process.send({ success: true, result });
        }
        catch (e) {
            process.send && process.send({ success: false, error: e.message });
        }
    }
    else {
        process.send && process.send({ success: false, error: 'No jsFile specified in message' });
    }
});
