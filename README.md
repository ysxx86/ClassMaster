# ClassMaster - 班主任管理系统

一个用于管理班级学生信息、成绩和评语的简单系统。

## 功能特点

- 学生信息管理
- 成绩记录与统计
- 学生评语管理
- 综合素质报告单导出
- 数据备份与恢复

## 技术栈

- 前端：HTML, CSS, JavaScript, Bootstrap 5
- 后端：Node.js, Express
- 数据库：SQLite

## 安装步骤

1. 确保已安装 Node.js (v14.0.0 或更高版本)

2. 克隆仓库
   ```
   git clone https://github.com/yourusername/classmaster.git
   cd classmaster
   ```

3. 安装依赖
   ```
   npm install
   ```

4. 启动服务器
   ```
   npm start
   ```

5. 在浏览器中访问 `http://localhost:3000`

## 开发模式

使用以下命令启动开发模式（自动重启服务器）:

```
npm run dev
```

## 数据库

系统使用SQLite数据库存储所有数据，数据文件位于 `data/classmaster.db`。系统会自动创建所需的数据表。

## 备份与恢复

系统提供数据备份和恢复功能，备份文件存储在 `data/backups` 目录中。

## 许可

MIT许可证

## 班主任操作指南

### 第一步：首次登录与密码修改
首次登录系统后，请立即修改默认密码以确保账户安全。点击右上角的个人头像，选择"修改密码"选项，输入新密码并确认。

### 第二步：学生管理
进入"学生管理"模块，点击"导入学生"按钮。您可以下载模板，填写学生信息后上传，也可以手动添加单个学生。确保每位学生都有正确的班级信息和学号。

### 第三步：评语管理
访问"评语管理"页面，系统将显示您班级的所有学生。您可以：
- 手动编写评语
- 使用AI海海助手生成评语
- 批量导入评语

请注意评语字数限制为260字，系统会自动统计字数。

### 第四步：成绩管理
在"成绩管理"页面，您可以为每位学生设置各科目的成绩等级：
- 输入具体分数或选择等级（优秀/良好/合格/待提高）
- 使用批量编辑功能同时设置多名学生的成绩
- 系统会自动计算平均分和总分

### 第五步：导出报告
完成以上步骤后，进入"报告管理"页面：
1. 选择需要导出的班级和学期
2. 选择报告模板
3. 点击"班主任签名"区域添加电子签名
4. 点击"开始导出"按钮生成最终报告

您可以预览报告效果，也可以直接下载所有学生的成绩报告。