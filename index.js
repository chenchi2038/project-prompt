const express = require('express');
const path = require('path');
const fs = require('fs-extra');
const open = require('open');
const { glob } = require('glob');

const app = express();
const PORT = 5010;
const DATA_FILE = path.join(__dirname, 'data.json');

// 文件缓存
const fileCache = new Map();

// 中间件
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// 数据存储
let appData = {
  projects: [],
  prompts: {}, // 项目ID -> 提示词内容
  favorites: [] // 收藏的提示词列表
};

// 读取 .gitignore 文件并转换为 glob 模式
async function readGitignore(projectPath) {
  const gitignorePath = path.join(projectPath, '.gitignore');
  try {
    if (await fs.pathExists(gitignorePath)) {
      const content = await fs.readFile(gitignorePath, 'utf8');
      return content
        .split('\n')
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('#') && !line.startsWith('!'))
        .map(line => {
          // 处理 gitignore 格式到 glob 格式
          let pattern = line;

          // 如果以 / 结尾，表示目录
          if (pattern.endsWith('/')) {
            pattern = pattern.slice(0, -1);
            return [pattern + '/**', '**/' + pattern + '/**'];
          }

          // 如果以 / 开头，表示从根目录开始
          if (pattern.startsWith('/')) {
            pattern = pattern.slice(1);
            return [pattern, pattern + '/**'];
          }

          // 如果不包含 / 和 *，表示匹配任何位置的文件或目录
          if (!pattern.includes('/') && !pattern.includes('*')) {
            return [
              '**/' + pattern,
              '**/' + pattern + '/**',
              pattern,
              pattern + '/**'
            ];
          }

          // 其他情况直接返回
          return [pattern, pattern + '/**'];
        })
        .flat(); // 展平数组
    }
  } catch (error) {
    console.error('读取 .gitignore 失败:', error);
  }
  return [];
}

// 加载数据
async function loadData() {
  try {
    if (await fs.pathExists(DATA_FILE)) {
      appData = await fs.readJson(DATA_FILE);
    }
  } catch (error) {
    console.error('加载数据失败:', error);
  }
}

// 保存数据
async function saveData() {
  try {
    await fs.writeJson(DATA_FILE, appData, { spaces: 2 });
  } catch (error) {
    console.error('保存数据失败:', error);
  }
}

// API 路由
app.get('/api/projects', (req, res) => {
  res.json(appData.projects);
});

app.post('/api/projects', async (req, res) => {
  const { name, path: projectPath, includeFullPath, excludePatterns } = req.body;

  const project = {
    id: Date.now().toString(),
    name,
    path: projectPath,
    includeFullPath: includeFullPath || false,
    excludePatterns: excludePatterns || []
  };

  appData.projects.push(project);
  await saveData();
  res.json(project);
});

// 更新项目
app.put('/api/projects/:id', async (req, res) => {
  const { id } = req.params;
  const { name, path: projectPath, includeFullPath, excludePatterns } = req.body;

  const projectIndex = appData.projects.findIndex(p => p.id === id);
  if (projectIndex === -1) {
    return res.status(404).json({ error: '项目未找到' });
  }

  const updatedProject = {
    id,
    name,
    path: projectPath,
    includeFullPath: includeFullPath || false,
    excludePatterns: excludePatterns || []
  };

  appData.projects[projectIndex] = updatedProject;

  // 清除文件缓存
  fileCache.delete(id);

  await saveData();
  res.json(updatedProject);
});

// 删除项目
app.delete('/api/projects/:id', async (req, res) => {
  const { id } = req.params;

  const projectIndex = appData.projects.findIndex(p => p.id === id);
  if (projectIndex === -1) {
    return res.status(404).json({ error: '项目未找到' });
  }

  // 删除项目
  appData.projects.splice(projectIndex, 1);

  // 删除相关的提示词
  delete appData.prompts[id];

  // 清除文件缓存
  fileCache.delete(id);

  await saveData();
  res.json({ success: true });
});

// 项目上移
app.put('/api/projects/:id/move-up', async (req, res) => {
  const { id } = req.params;

  const projectIndex = appData.projects.findIndex(p => p.id === id);
  if (projectIndex === -1) {
    return res.status(404).json({ error: '项目未找到' });
  }

  if (projectIndex === 0) {
    return res.status(400).json({ error: '项目已在最顶部' });
  }

  // 交换位置
  [appData.projects[projectIndex], appData.projects[projectIndex - 1]] = 
  [appData.projects[projectIndex - 1], appData.projects[projectIndex]];

  await saveData();
  res.json(appData.projects);
});

// 项目下移
app.put('/api/projects/:id/move-down', async (req, res) => {
  const { id } = req.params;

  const projectIndex = appData.projects.findIndex(p => p.id === id);
  if (projectIndex === -1) {
    return res.status(404).json({ error: '项目未找到' });
  }

  if (projectIndex === appData.projects.length - 1) {
    return res.status(400).json({ error: '项目已在最底部' });
  }

  // 交换位置
  [appData.projects[projectIndex], appData.projects[projectIndex + 1]] = 
  [appData.projects[projectIndex + 1], appData.projects[projectIndex]];

  await saveData();
  res.json(appData.projects);
});

// 预扫描项目文件
app.post('/api/projects/:id/scan', async (req, res) => {
  const { id } = req.params;

  const project = appData.projects.find(p => p.id === id);
  if (!project) {
    return res.status(404).json({ error: '项目未找到' });
  }

  try {
    const files = await scanProjectFiles(project);
    res.json({ success: true, fileCount: files.length });
  } catch (error) {
    console.error('扫描项目文件失败:', error);
    res.status(500).json({ error: '扫描项目文件失败' });
  }
});

// 获取项目文件列表（从缓存中快速获取）
app.get('/api/projects/:id/files', async (req, res) => {
  const { id } = req.params;
  const { filter } = req.query;

  const project = appData.projects.find(p => p.id === id);
  if (!project) {
    return res.status(404).json({ error: '项目未找到' });
  }

  try {
    // 从缓存中获取文件列表
    let files = fileCache.get(id);

    // 如果缓存中没有，则扫描文件
    if (!files) {
      console.log(`缓存中没有项目 ${project.name} 的文件列表，开始扫描...`);
      files = await scanProjectFiles(project);
    }

    // 过滤文件
    let filteredFiles = files;
    if (filter) {
      filteredFiles = fuzzyFilter(files, filter);
    }

    // 限制返回数量
    res.json(filteredFiles.slice(0, 20));
  } catch (error) {
    console.error('获取文件列表失败:', error);
    res.status(500).json({ error: '获取文件列表失败' });
  }
});

app.get('/api/prompts/:projectId', (req, res) => {
  const { projectId } = req.params;
  const prompt = appData.prompts[projectId] || '';
  res.json({ prompt });
});

app.post('/api/prompts/:projectId', async (req, res) => {
  const { projectId } = req.params;
  const { prompt } = req.body;

  appData.prompts[projectId] = prompt;
  await saveData();
  res.json({ success: true });
});

// 源码复制 API
app.post('/api/copy-with-source', async (req, res) => {
  try {
    const { content, projectId } = req.body;

    if (!projectId) {
      return res.status(400).json({ error: '需要指定项目ID' });
    }

    const project = appData.projects.find(p => p.id === projectId);
    if (!project) {
      return res.status(404).json({ error: '项目不存在' });
    }

    // 提取内容中的文件路径（@开头的文件路径）
    const filePathRegex = /@([^\s]+)/g;
    const filePaths = [];
    let match;

    while ((match = filePathRegex.exec(content)) !== null) {
      filePaths.push(match[1]);
    }

    // 去重
    const uniqueFilePaths = [...new Set(filePaths)];

    // 读取文件内容
    const sourceContents = [];
    for (const filePath of uniqueFilePaths) {
      try {
        const fullPath = path.join(project.path, filePath);
        if (await fs.pathExists(fullPath)) {
          const fileContent = await fs.readFile(fullPath, 'utf8');
          sourceContents.push({
            path: filePath,
            content: fileContent
          });
        }
      } catch (error) {
        console.error(`读取文件失败: ${filePath}`, error);
      }
    }

    // 构建最终内容
    let finalContent = content.replace(/@([^\s]+)/g, '$1'); // 去掉@符号

    // 添加源码内容
    if (sourceContents.length > 0) {
      finalContent += '\n\n';
      for (const source of sourceContents) {
        finalContent += `${source.path}源码(content标签内)\n<content>\n${source.content}\n</content>\n\n`;
      }
    }

    res.json({
      contentWithSource: finalContent,
      filesProcessed: sourceContents.length
    });

  } catch (error) {
    console.error('源码复制处理失败:', error);
    res.status(500).json({ error: '处理失败' });
  }
});

// 获取文件内容 API
app.get('/api/projects/:projectId/file-content', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { filePath } = req.query;
    
    if (!filePath) {
      return res.status(400).json({ error: '文件路径参数缺失' });
    }
    
    const project = appData.projects.find(p => p.id === projectId);
    if (!project) {
      return res.status(404).json({ error: '项目不存在' });
    }

    const fullPath = path.join(project.path, filePath);
    
    // 安全检查：确保文件路径在项目目录内
    const resolvedPath = path.resolve(fullPath);
    const resolvedProjectPath = path.resolve(project.path);
    if (!resolvedPath.startsWith(resolvedProjectPath)) {
      return res.status(403).json({ error: '访问被拒绝' });
    }

    if (await fs.pathExists(fullPath)) {
      const fileContent = await fs.readFile(fullPath, 'utf8');
      res.json({ 
        filePath,
        content: fileContent 
      });
    } else {
      res.status(404).json({ error: '文件不存在' });
    }
    
  } catch (error) {
    console.error('读取文件失败:', error);
    res.status(500).json({ error: '读取文件失败' });
  }
});

// 收藏功能 API

// 获取所有收藏
app.get('/api/favorites', (req, res) => {
  res.json(appData.favorites || []);
});

// 添加收藏
app.post('/api/favorites', async (req, res) => {
  try {
    const { name, description, content, projectId } = req.body;

    if (!name || !content) {
      return res.status(400).json({ error: '名称和内容不能为空' });
    }

    const favorite = {
      id: Date.now().toString(),
      name,
      description: description || '',
      content,
      projectId: projectId || null,
      createdAt: new Date().toISOString()
    };

    if (!appData.favorites) {
      appData.favorites = [];
    }

    appData.favorites.push(favorite);
    await saveData();

    res.json(favorite);
  } catch (error) {
    console.error('添加收藏失败:', error);
    res.status(500).json({ error: '添加收藏失败' });
  }
});

// 删除收藏
app.delete('/api/favorites/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!appData.favorites) {
      appData.favorites = [];
    }

    const favoriteIndex = appData.favorites.findIndex(f => f.id === id);
    if (favoriteIndex === -1) {
      return res.status(404).json({ error: '收藏未找到' });
    }

    appData.favorites.splice(favoriteIndex, 1);
    await saveData();

    res.json({ success: true });
  } catch (error) {
    console.error('删除收藏失败:', error);
    res.status(500).json({ error: '删除收藏失败' });
  }
});

// 更新收藏
app.put('/api/favorites/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;

    if (!appData.favorites) {
      appData.favorites = [];
    }

    const favoriteIndex = appData.favorites.findIndex(f => f.id === id);
    if (favoriteIndex === -1) {
      return res.status(404).json({ error: '收藏未找到' });
    }

    if (name) appData.favorites[favoriteIndex].name = name;
    if (description !== undefined) appData.favorites[favoriteIndex].description = description;
    appData.favorites[favoriteIndex].updatedAt = new Date().toISOString();

    await saveData();
    res.json(appData.favorites[favoriteIndex]);
  } catch (error) {
    console.error('更新收藏失败:', error);
    res.status(500).json({ error: '更新收藏失败' });
  }
});

// 扫描项目文件并缓存
async function scanProjectFiles(project) {
  try {
    // 读取 .gitignore 文件
    const gitignorePatterns = await readGitignore(project.path);
    console.log(`项目 ${project.name} 的 .gitignore 模式:`, gitignorePatterns);

    // 合并排除模式
    const allExcludePatterns = [
      ...project.excludePatterns,
      ...gitignorePatterns,
      '.git/**',
      'node_modules/**'
    ].map(p => path.join(project.path, p));

    // 获取所有文件
    const pattern = path.join(project.path, '**/*').replace(/\\/g, '/');
    const normalizedExcludePatterns = allExcludePatterns.map(p => p.replace(/\\/g, '/'));

    const files = await glob(pattern, {
      ignore: normalizedExcludePatterns,
      nodir: true,
      dot: true
    });

    // 转换为相对路径
    const relativeFiles = files.map(file => {
      return path.relative(project.path, file).replace(/\\/g, '/');
    });

    // 缓存文件列表
    fileCache.set(project.id, relativeFiles);

    return relativeFiles;
  } catch (error) {
    console.error(`扫描项目文件失败: ${project.name}`, error);
    return [];
  }
}

// VSCode 风格的模糊匹配函数
function fuzzyFilter(items, filter) {
  if (!filter) return items;

  const filterLower = filter.toLowerCase();

  // 检查是否包含路径分隔符
  if (filterLower.includes('/')) {
    // 包含路径分隔符，按路径段匹配
    return filterByPathSegments(items, filterLower);
  } else {
    // 不包含路径分隔符，只在单个路径段中匹配
    return filterBySingleSegment(items, filterLower);
  }
}

// 按路径段匹配
function filterByPathSegments(items, filter) {
  const filterSegments = filter.split('/').filter(seg => seg.length > 0);

  const matches = items.map(item => {
    const score = calculatePathSegmentScore(item.toLowerCase(), filterSegments);
    return { item, score };
  }).filter(match => match.score > 0);

  matches.sort((a, b) => b.score - a.score);
  return matches.map(match => match.item);
}

// 在单个路径段中匹配
function filterBySingleSegment(items, filter) {
  const matches = items.map(item => {
    const score = calculateSingleSegmentScore(item.toLowerCase(), filter);
    return { item, score };
  }).filter(match => match.score > 0);

  matches.sort((a, b) => b.score - a.score);
  return matches.map(match => match.item);
}

// 计算路径段匹配分数
function calculatePathSegmentScore(filePath, filterSegments) {
  const pathSegments = filePath.split('/');
  let totalScore = 0;
  let segmentIndex = 0;

  for (let i = 0; i < filterSegments.length; i++) {
    const filterSegment = filterSegments[i];
    let bestScore = 0;
    let bestMatchIndex = -1;

    // 从当前位置开始查找匹配的路径段
    for (let j = segmentIndex; j < pathSegments.length; j++) {
      const segment = pathSegments[j];
      let segmentScore = 0;

      // 1. 完全匹配
      if (segment === filterSegment) {
        segmentScore = 50;
      }
      // 2. 开头匹配
      else if (segment.startsWith(filterSegment)) {
        segmentScore = 40;
      }
      // 3. 包含匹配
      else if (segment.includes(filterSegment)) {
        segmentScore = 30;
      }
      // 4. 模糊匹配（支持部分字符匹配）
      else {
        const fuzzyScore = calculateFuzzyMatch(segment, filterSegment);
        if (fuzzyScore > 0) {
          segmentScore = fuzzyScore;
        }
      }

      // 文件名匹配比目录名匹配分数更高
      if (segment.includes('.') && segmentScore > 0) {
        segmentScore += 10;
      }

      if (segmentScore > bestScore) {
        bestScore = segmentScore;
        bestMatchIndex = j;
      }
    }

    if (bestScore > 0) {
      totalScore += bestScore;
      segmentIndex = bestMatchIndex + 1;
    } else {
      // 如果没有找到匹配，尝试在整个路径中进行模糊匹配
      const pathFuzzyScore = calculateFuzzyMatch(filePath, filterSegment);
      if (pathFuzzyScore > 0) {
        totalScore += pathFuzzyScore * 0.5; // 降低权重
      } else {
        return 0; // 完全没有匹配
      }
    }
  }

  // 路径越短，分数越高
  totalScore += Math.max(0, 50 - filePath.length);

  return totalScore;
}

// 模糊匹配函数 - 计算两个字符串的相似度
function calculateFuzzyMatch(text, pattern) {
  if (!pattern || !text) return 0;

  text = text.toLowerCase();
  pattern = pattern.toLowerCase();

  // 如果模式完全包含在文本中，给高分
  if (text.includes(pattern)) {
    return 25;
  }

  // 计算字符匹配度
  let matchCount = 0;
  let patternIndex = 0;

  for (let i = 0; i < text.length && patternIndex < pattern.length; i++) {
    if (text[i] === pattern[patternIndex]) {
      matchCount++;
      patternIndex++;
    }
  }

  // 如果所有模式字符都找到了，计算匹配分数
  if (patternIndex === pattern.length) {
    const matchRatio = matchCount / pattern.length;
    const lengthRatio = pattern.length / text.length;
    return Math.floor(matchRatio * lengthRatio * 20);
  }

  return 0;
}

// 计算单个路径段匹配分数
function calculateSingleSegmentScore(filePath, filter) {
  const pathSegments = filePath.split('/');
  let maxScore = 0;

  // 在每个路径段中查找匹配
  for (const segment of pathSegments) {
    let score = 0;

    // 完全匹配
    if (segment === filter) {
      score = 60;
    }
    // 开头匹配
    else if (segment.startsWith(filter)) {
      score = 40;
    }
    // 结尾匹配
    else if (segment.endsWith(filter)) {
      score = 30;
    }
    // 包含匹配
    else if (segment.includes(filter)) {
      score = 20;
    }
    // 模糊匹配
    else {
      score = calculateFuzzyMatch(segment, filter);
    }

    // 文件名匹配比目录名匹配分数更高
    if (segment.includes('.') && score > 0) {
      score += 10;
    }

    maxScore = Math.max(maxScore, score);
  }

  if (maxScore > 0) {
    // 路径越短，分数越高
    maxScore += Math.max(0, 50 - filePath.length);
  }

  return maxScore;
}

// 启动服务器
async function start() {
  await loadData();

  app.listen(PORT, () => {
    console.log(`提示词编写工具已启动: http://localhost:${PORT}`);
    open(`http://localhost:${PORT}`);
  });
}

start().catch(console.error);


