/**
 * Node.js bridge for Python subprocess calls.
 * Usage: echo '{"module":"sign","fn":"get_request_headers_params","args":[...]}' | node _bridge.js
 */
const path = require('path');
const fs = require('fs');
const STATIC = __dirname;

const _modules = {};

function getModule(name) {
    if (!_modules[name]) {
        const origWrite = process.stdout.write.bind(process.stdout);
        process.stdout.write = () => true;
        try {
            if (name === 'sign') {
                _modules[name] = require(path.join(STATIC, 'xhs_main_260411.js'));
            } else if (name === 'xray') {
                // xray defines global.traceId via require
                require(path.join(STATIC, 'xhs_xray.js'));
                _modules[name] = global;
            } else if (name === 'rap') {
                // rap defines generate_x_rap_param in module scope;
                // eval it into an IIFE wrapper so it leaks to global
                const code = fs.readFileSync(path.join(STATIC, 'xhs_rap.js'), 'utf-8');
                const wrapped = '(function() { var module = {exports:{}}; var exports = module.exports;\n' + code + '\n; global.generate_x_rap_param = generate_x_rap_param; })();';
                eval(wrapped);
                _modules[name] = global;
            } else {
                throw new Error('Unknown module: ' + name);
            }
        } finally {
            process.stdout.write = origWrite;
        }
    }
    return _modules[name];
}

let input = '';
process.stdin.on('data', chunk => input += chunk);
process.stdin.on('end', () => {
    try {
        const req = JSON.parse(input);
        const mod = getModule(req.module || 'sign');
        const fn = mod[req.fn];
        if (typeof fn !== 'function') throw new Error('No function: ' + req.fn);
        const result = fn(...(req.args || []));
        process.stdout.write(JSON.stringify({ok: true, result}) + '\n');
    } catch (e) {
        process.stdout.write(JSON.stringify({ok: false, error: e.message}) + '\n');
    }
});
