const express = require('express');
const multer = require('multer');
const { removeBackground } = require('@imgly/background-removal-node');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const AdmZip = require('adm-zip');
const cors = require('cors');

const app = express();

// CORS 设置
const corsOptions = {
  origin: '*',
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

// 安全的文件名生成
const generateFileName = (originalName) => {
  const extension = path.extname(originalName);
  const randomString = crypto.randomBytes(16).toString('hex');
  return `${randomString}${extension}`;
};

// Multer 设置
const upload = multer({
  dest: 'uploads/',
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/zip'];
    if (!allowedTypes.includes(file.mimetype)) {
      return cb(new Error('Only JPEG, PNG, GIF images and ZIP files are allowed'));
    }
    cb(null, true);
  }
});

const processedDir = path.join(__dirname, 'processed');
if (!fs.existsSync(processedDir)) {
  fs.mkdirSync(processedDir, { recursive: true });
}

app.use(express.static('public'));

// 单个图像处理
app.post('/remove-background', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).send('No image uploaded');
    }

    const imagePath = req.file.path;
    const outputFormat = req.query.format || 'png';
    const blob = await removeBackground(imagePath);
    const buffer = Buffer.from(await blob.arrayBuffer());

    // 确保文件名不包含路径，并且只有一个扩展名
    const filename = generateFileName(req.file.originalname);
    // 正确拼接路径
    const outputPath = path.join(processedDir, filename);

    fs.writeFileSync(outputPath, buffer);

    // 使用相对路径发送文件
    res.sendFile(outputPath, { root: '.' });
  } catch (error) {
    console.error('Error processing image:', error);
    res.status(500).send('Error processing image');
  } finally {
    // 检查文件是否存在并删除
    if (req.file && req.file.path && fs.existsSync(req.file.path)) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (err) {
        console.error('Error deleting temporary file:', err);
      }
    }
  }
});

// 批量图像处理
app.post('/batch-remove-background', upload.single('images'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).send('No ZIP file uploaded');
    }

    const zip = new AdmZip(req.file.path);
    const entries = zip.getEntries();
    const results = [];

    for (const entry of entries) {
      if (!entry.isDirectory) {
        const buffer = await entry.getDataAsync();
        const blob = await removeBackground(buffer);
        const processedBuffer = Buffer.from(await blob.arrayBuffer());
        results.push({ filename: entry.entryName, data: processedBuffer });
      }
    }

    const outputZip = new AdmZip();
    results.forEach((result) => outputZip.addFile(result.filename, result.data));
    const outputBuffer = outputZip.toBuffer();

    res.writeHead(200, {
      'Content-Type': 'application/zip',
      'Content-Disposition': 'attachment; filename="processed_images.zip"'
    });
    res.end(outputBuffer);
  } catch (error) {
    console.error('Error processing batch:', error);
    res.status(500).send('Error processing images');
  } finally {
    // 删除上传的 ZIP 文件
    if (req.file && req.file.path && fs.existsSync(req.file.path)) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (err) {
        console.error('Error deleting temporary file:', err);
      }
    }
  }
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000; // 使用环境变量或默认端口
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
