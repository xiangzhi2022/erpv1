#!/usr/bin/env node
/**
 * Supabase 数据库操作工具
 * 用法:
 *   node scripts/db-tool.js list                    # 列出所有表
 *   node scripts/db-tool.js query "SELECT * FROM users"  # 执行SQL查询
 *   node scripts/db-tool.js insert users '{"name":"test","phone":"123"}'  # 插入数据
 */

const https = require('https');

// 优先使用 .env.local 配置，避免被系统环境变量覆盖
const fs = require('fs');
const path = require('path');

let envConfig = {};
const envLocalPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envLocalPath)) {
  const content = fs.readFileSync(envLocalPath, 'utf8');
  content.split('\n').forEach(line => {
    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length) {
      envConfig[key.trim()] = valueParts.join('=').trim();
    }
  });
}
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8');
  content.split('\n').forEach(line => {
    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length && !key.trim().startsWith('#') && envConfig[key.trim()] === undefined) {
      envConfig[key.trim()] = valueParts.join('=').trim();
    }
  });
}

const CONFIG = {
  url: envConfig.COZE_SUPABASE_URL || process.env.COZE_SUPABASE_URL || 'https://cdcnjtgabgjkouavwxsl.supabase.co',
  anonKey: envConfig.COZE_SUPABASE_ANON_KEY || process.env.COZE_SUPABASE_ANON_KEY || '',
  serviceKey: envConfig.COZE_SUPABASE_SERVICE_ROLE_KEY || process.env.COZE_SUPABASE_SERVICE_ROLE_KEY || ''
};

function request(method, path, body = null, useServiceKey = true) {
  return new Promise((resolve, reject) => {
    const url = new URL(CONFIG.url + path);
    const options = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'apikey': useServiceKey ? CONFIG.serviceKey : CONFIG.anonKey,
        'Authorization': `Bearer ${useServiceKey ? CONFIG.serviceKey : CONFIG.anonKey}`,
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          resolve(data);
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function listTables() {
  const result = await request('GET', '/rest/v1/?limit=0', null, true);
  const tables = result.defs?.map(t => t.name).filter(n => !n.startsWith('pg_') && !n.startsWith('sql_')) || [];
  console.log('📋 数据库表列表:');
  tables.forEach(t => console.log(`  - ${t}`));
  return tables;
}

async function query(sql) {
  console.log(`🔍 执行 SQL: ${sql}`);
  const result = await request('POST', '/rest/v1/rpc/exec', { sql }, true);
  console.log('✅ 结果:', JSON.stringify(result, null, 2));
  return result;
}

async function select(table, conditions = {}) {
  console.log(`🔍 查询表: ${table}`);
  const query = Object.entries(conditions)
    .map(([k, v]) => `${k}=eq.${v}`)
    .join('&');
  const result = await request('GET', `/rest/v1/${table}?${query}`, null, true);
  console.log(`✅ 返回 ${Array.isArray(result) ? result.length : 0} 条记录`);
  console.log(JSON.stringify(result, null, 2));
  return result;
}

async function insert(table, data) {
  console.log(`➕ 插入到表: ${table}`);
  const result = await request('POST', `/rest/v1/${table}`, data, true);
  console.log('✅ 插入成功:', JSON.stringify(result, null, 2));
  return result;
}

async function update(table, id, data) {
  console.log(`✏️ 更新表: ${table}, ID: ${id}`);
  const result = await request('PATCH', `/rest/v1/${table}?id=eq.${id}`, data, true);
  console.log('✅ 更新成功');
  return result;
}

async function remove(table, id) {
  console.log(`🗑️ 删除表: ${table}, ID: ${id}`);
  const result = await request('DELETE', `/rest/v1/${table}?id=eq.${id}`, null, true);
  console.log('✅ 删除成功');
  return result;
}

// 主程序
const [,, cmd, ...args] = process.argv;

(async () => {
  try {
    switch(cmd) {
      case 'list':
        await listTables();
        break;
      case 'query':
        await query(args.join(' '));
        break;
      case 'select':
        await select(args[0], args[1] ? JSON.parse(args[1]) : {});
        break;
      case 'insert':
        await insert(args[0], JSON.parse(args[1]));
        break;
      case 'update':
        await update(args[0], args[1], JSON.parse(args[2]));
        break;
      case 'delete':
        await remove(args[0], args[1]);
        break;
      case 'help':
        console.log(`
Supabase 数据库工具
用法:
  node scripts/db-tool.js list                          # 列出所有表
  node scripts/db-tool.js query "SELECT * FROM users"  # 执行SQL
  node scripts/db-tool.js select users                  # 查询表
  node scripts/db-tool.js select users '{"id":"123"}'  # 条件查询
  node scripts/db-tool.js insert users '{"name":"test"}' # 插入数据
  node scripts/db-tool.js update users 123 '{"name":"new"}' # 更新数据
  node scripts/db-tool.js delete users 123             # 删除数据
        `);
        break;
      default:
        console.log('未知命令，用 help 查看帮助');
    }
  } catch (err) {
    console.error('❌ 错误:', err.message);
  }
})();
