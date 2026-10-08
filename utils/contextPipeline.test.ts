import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import ts from 'typescript';
import { expect, it } from 'vitest';

// 仅保留已审计的文本消费者；新增 App 不得再接旧文本入口。
// 多人布局先渲染不带世界书的人设，最终仍走 ContextBuilder 消息管线。
const legacyTextCalls: Record<string, number> = {
    'apps/GroupChat.tsx': 1,
    'apps/GameApp.tsx': 1,
    'components/date/story/StoryTheaterSession.tsx': 2,
    'utils/socialGeneration.ts': 1,
    // 记忆诊断、迁移、后台门牌任务目前的契约是序列化文本，不是角色对话。
    'apps/MemoryPalaceApp.tsx': 1,
    'utils/memoryPalace/memoryRepair.ts': 1,
    'utils/memoryPalace/roomPlates.ts': 1,
    // fork 侧先于本门禁存在的文本消费者：上岸计划求职会话与任务结算同样是
    // 序列化文本契约（不是角色对话），登记在册、次数照常被钉死。
    'apps/JobHuntApp.tsx': 1,
    'utils/taskSettlement.ts': 1,
};

function sourceFiles(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
        const path = join(dir, entry.name);
        return entry.isDirectory() ? sourceFiles(path)
            : /\.tsx?$/.test(path) && !/\.(test|spec)\./.test(path) ? [path] : [];
    });
}

it('世界书底层处理只允许 ContextBuilder 调用；旧文本调用点不能继续扩散', () => {
    const root = process.cwd();
    const actual: Record<string, number> = {};
    const violations: string[] = [];
    for (const path of ['apps', 'components', 'utils'].flatMap(dir => sourceFiles(join(root, dir)))) {
        const name = relative(root, path).replace(/\\/g, '/');
        if (name === 'utils/context.ts' || name === 'utils/worldbook.ts') continue;
        const source = readFileSync(path, 'utf8');
        if (!/buildCoreContext|resolveWorldbookEntries|resolveWorldbookDepthEntries|injectWorldbookDepthEntries|splitWorldbookSections/.test(source)) continue;
        const file = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true);
        const visit = (node: ts.Node) => {
            if (ts.isCallExpression(node) && node.expression.getText(file) === 'ContextBuilder.buildCoreContext') {
                actual[name] = (actual[name] || 0) + 1;
            }
            if (ts.isImportDeclaration(node) && /worldbook['"]$/.test(node.moduleSpecifier.getText(file))
                && /resolveWorldbookEntries|resolveWorldbookDepthEntries|injectWorldbookDepthEntries|splitWorldbookSections/.test(node.getText(file))) {
                violations.push(name);
            }
            ts.forEachChild(node, visit);
        };
        visit(file);
    }
    expect(violations).toEqual([]);
    expect(actual).toEqual(legacyTextCalls);
});

it('异步上下文必须等待完成，不能把 Promise 拼进提示词或请求', () => {
    const violations: string[] = [];
    const asyncEntries = /^ContextBuilder\.(buildCoreContext|buildRoleSettingsContext|buildVolatileCoreState|buildCharacterContext|buildCharacterRequest)$/;
    for (const path of ['apps', 'components', 'utils', 'features', 'hooks', 'context'].flatMap(dir => sourceFiles(join(process.cwd(), dir)))) {
        const source = readFileSync(path, 'utf8');
        if (!source.includes('ContextBuilder.')) continue;
        const file = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true);
        const visit = (node: ts.Node) => {
            if (ts.isCallExpression(node) && asyncEntries.test(node.expression.getText(file))) {
                let parent = node.parent;
                while (ts.isParenthesizedExpression(parent)) parent = parent.parent;
                // 直接 return 可把 Promise 交给上层；拼接字符串/数组/JSON 前必须 await。
                if (!ts.isAwaitExpression(parent) && !ts.isReturnStatement(parent)) {
                    violations.push(`${relative(process.cwd(), path)}:${file.getLineAndCharacterOfPosition(node.getStart()).line + 1}`);
                }
            }
            ts.forEachChild(node, visit);
        };
        visit(file);
    }
    expect(violations).toEqual([]);
});
