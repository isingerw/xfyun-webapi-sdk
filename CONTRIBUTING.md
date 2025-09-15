# 贡献指南

感谢您对科大讯飞WebAPI SDK项目的关注！我们欢迎任何形式的贡献，包括但不限于：

- 报告Bug
- 提出新功能建议
- 提交代码修复
- 改进文档
- 分享使用经验

## 关于项目维护者

**重要说明**: 本项目的主要维护者是一名后端开发人员，在前端技术、UI/UX设计、移动端开发等方面能力有限。因此，我们特别欢迎以下方面的贡献：

- 前端SDK的改进和优化
- React/Vue框架优化
- TypeScript类型定义完善
- 前端性能优化
- UI/UX设计改进
- 浏览器兼容性处理
- 前端构建工具配置
- 移动端SDK的开发
- 跨平台兼容性的提升
- 文档和示例的完善
- 测试用例的补充

如果您在这些领域有专长，您的贡献将极大地帮助项目的发展！

## 如何贡献

### 1. 报告问题

如果您发现了Bug或有功能建议，请：

1. 在 [Issues](https://github.com/isingerw/xfyun-webapi-sdk/issues) 页面搜索是否已有相关问题
2. 如果没有，请创建新的Issue，并包含：
   - 清晰的问题描述
   - 复现步骤
   - 期望的行为
   - 实际的行为
   - 环境信息（浏览器版本、Node.js版本、框架版本等）
   - 错误日志或截图

### 2. 提交代码

#### 准备工作

1. Fork 本仓库到您的GitHub账户
2. 克隆您的Fork到本地：
   ```bash
   git clone https://github.com/your-username/xfyun-webapi-sdk.git
   cd xfyun-webapi-sdk
   ```
3. 添加上游仓库：
   ```bash
   git remote add upstream https://github.com/isingerw/xfyun-webapi-sdk.git
   ```

#### 开发流程

1. 创建新的功能分支：
   ```bash
   git checkout -b feature/your-feature-name
   # 或
   git checkout -b fix/your-bug-fix
   ```

2. 安装依赖：
   ```bash
   npm install
   # 或
   pnpm install
   ```

3. 进行开发和测试：
   ```bash
   # 开发模式
   npm run dev
   
   # 构建项目
   npm run build
   
   # 运行示例
   npm run demo
   
   # 类型检查
   npx tsc --noEmit
   ```

4. 提交代码：
   ```bash
   git add .
   git commit -m "feat: 添加新功能描述"
   # 或
   git commit -m "fix: 修复Bug描述"
   ```

5. 推送分支：
   ```bash
   git push origin feature/your-feature-name
   ```

6. 创建Pull Request

#### 代码规范

- 使用 TypeScript 编写代码
- 遵循 ESLint 规则
- 保持代码简洁和可读性
- 添加必要的注释和文档
- 确保所有测试通过
- 遵循现有的代码风格

#### 提交信息规范

我们使用约定式提交（Conventional Commits）规范：

- `feat:` 新功能
- `fix:` Bug修复
- `docs:` 文档更新
- `style:` 代码格式调整
- `refactor:` 代码重构
- `test:` 测试相关
- `chore:` 构建过程或辅助工具的变动
- `perf:` 性能优化
- `ci:` CI/CD相关

示例：
```
feat: 添加DTS长文本语音合成支持
fix: 修复AudioWorklet兼容性问题
docs: 更新API使用说明
perf: 优化音频处理性能
```

### 3. 代码审查

所有提交的代码都会经过审查，审查要点包括：

- 代码质量和可读性
- 功能正确性
- 测试覆盖率
- 文档完整性
- 性能影响
- 浏览器兼容性
- TypeScript类型安全

### 4. 文档贡献

文档改进同样重要，包括：

- 更新README.md
- 完善API文档
- 添加使用示例
- 改进错误信息
- 翻译文档
- 添加JSDoc注释

## 开发环境设置

### 环境要求

- Node.js 16+ 
- npm 或 pnpm
- TypeScript 5.0+
- 现代浏览器（Chrome 60+, Firefox 55+, Safari 11+, Edge 79+）

### 本地开发

1. 克隆项目：
   ```bash
   git clone https://github.com/your-username/xfyun-webapi-sdk.git
   cd xfyun-webapi-sdk
   ```

2. 安装依赖：
   ```bash
   npm install
   # 或
   pnpm install
   ```

3. 启动开发模式：
   ```bash
   npm run dev
   ```

4. 运行示例：
   ```bash
   npm run demo
   ```

5. 构建项目：
   ```bash
   npm run build
   ```

### 测试

运行测试：
```bash
# 运行所有测试
npm test

# 运行特定测试
npm test -- --grep "IatClient"

# 生成测试报告
npm run test:coverage
```

### 调试

1. 使用浏览器开发者工具
2. 启用详细日志：
   ```typescript
   const { open, sendFrame, close } = useIat({
     // ... 配置
     onLog: (level, payload) => {
       console.log(`[${level}]`, payload);
     }
   });
   ```

## 项目结构

```
xfyun-webapi-sdk/
├── src/
│   ├── core/           # 核心客户端实现
│   ├── react/          # React Hooks
│   ├── vue/            # Vue 组合式API
│   ├── utils/          # 工具函数
│   └── worklet/        # AudioWorklet处理器
├── demo/               # 示例代码
├── dist/               # 构建输出
├── docs/               # 文档
└── tests/              # 测试文件
```

## 发布流程

### 版本号规范

我们使用语义化版本控制（Semantic Versioning）：

- `MAJOR.MINOR.PATCH` (例如: 1.2.5)
- MAJOR: 不兼容的API修改
- MINOR: 向下兼容的功能性新增
- PATCH: 向下兼容的问题修正

### 发布步骤

1. 更新版本号
2. 更新CHANGELOG.md
3. 创建Release标签
4. 构建和测试
5. 发布到npm

## 社区行为准则

### 我们的承诺

为了营造开放和友好的环境，我们承诺：

- 尊重所有贡献者
- 接受建设性批评
- 关注社区最佳利益
- 对其他社区成员保持同理心

### 不可接受的行为

- 使用性暗示的言语或图像
- 人身攻击或侮辱性评论
- 公开或私下的骚扰
- 未经许可发布他人私人信息
- 其他在专业环境中不当的行为

## 联系方式

如果您有任何问题或建议，可以通过以下方式联系我们：

- 邮箱: zhangsingerw@gmail.com
- 创建 [Issue](https://github.com/isingerw/xfyun-webapi-sdk/issues)
- 参与项目讨论

## 相关项目

- **前端SDK**: [xfyun-webapi-sdk](https://github.com/isingerw/xfyun-webapi-sdk) - 科大讯飞WebAPI前端SDK
- **后端服务**: [xfyun-webapi](https://github.com/isingerw/xfyun-webapi) - 科大讯飞WebAPI后端服务

## 许可证

通过贡献代码，您同意您的贡献将在MIT许可证下发布。

## 致谢

感谢所有为项目做出贡献的开发者！

---

再次感谢您的贡献！让我们一起构建更好的科大讯飞WebAPI SDK。
