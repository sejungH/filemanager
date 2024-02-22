const express = require('express');
const https = require('https');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { exec } = require('child_process');

const app = express();
const port = 443; // http 80, https 443
const password = "1011";
const root = "C:/Users/hunis/web/files";

var sslOptions = {
    ca: fs.readFileSync(__dirname + '/ssl/ca_bundle.crt'),
    key: fs.readFileSync(__dirname + '/ssl/private.key'),
    cert: fs.readFileSync(__dirname + '/ssl/certificate.crt')
};

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, absPath(req.body.path));
    },
    filename: function (req, file, cb) {
        cb(null, file.originalname);
    }
});
const upload = multer({ storage: storage });

app.use(express.static(__dirname));
app.use(express.json());
app.use(express.urlencoded());

app.use((req, res, next) => {
    res.header('Content-Type', 'text/html; charset=utf-8');
    next();
});

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

app.post('/verify', (req, res) => {
    if (req.body.password == password) {
        res.status(200).send('Login Successful');
    } else {
        res.status(401).send('Login Failed');
    }
});

app.post('/files', (req, res) => {
    var storage = getStorage(absPath(req.body.path));
    res.send(storage);
});

app.get('/download', (req, res) => {
    res.download(absPath(req.query.path));
});

app.post('/upload', upload.single('file'), (req, res) => {
    console.log('File uploaded: ' + req.file.originalname);
    res.status(200).send('File uploaded successfully');
});

app.post('/delete', (req, res) => {
    fs.unlink(absPath(req.body.path), (err) => {
        if (err) {
            console.error('Error deleting file:', err);
            return;
        }
        console.log(`File '${req.body.path}' deleted`);
        res.status(200).send(`File deleted successfully`);
    })
});

app.post('/deleteDirectory', (req, res) => {
    fs.rmSync(absPath(req.body.path), { recursive: true, force: true });
    console.log(`Folder '${req.body.path}' deleted`);
    res.status(200).send(`Folder deleted successfully`);
});

app.post('/newDirectory', (req, res) => {
    fs.mkdir(`${absPath(req.body.path)}/${req.body.name}`, { recursive: true }, (err) => {
        if (err) {
            console.error('Error creating folder:', err);
            return;
        }
        console.log(`Folder '${req.body.path}/${req.body.name}' created`);
        res.status(200).send(`Folder created successfully`);
    });
});

app.post('/rename', (req, res) => {
    fs.rename(`${absPath(req.body.path)}/${req.body.oldName}`, `${absPath(req.body.path)}/${req.body.newName}`, (err) => {
        if (err) {
            console.error('Error renaming folder:', err);
            return;
        }
        console.log(`File '${req.body.path}/${req.body.newName}' renamed`);
        res.status(200).send(`File renamed successfully`);
    });
});

app.post('/move', (req, res) => {
    var filename = absPath(req.body.oldPath).split('/').pop();
    fs.rename(req.body.oldPath, `${absPath(req.body.newPath)}/${filename}`, (err) => {
        if (err) {
            console.error('Error moving file/folder:', err);
            return;
        }
        console.log(`File '${req.body.newPath}/${filename}' moved`);
        res.status(200).send(`File moved successfully`);
    });
});

app.post('/disk', (req, res) => {
    exec('wmic logicaldisk get size,freespace,caption', (error, stdout, stderr) => {
        if (error) {
            console.error(`exec error: ${error}`);
            return;
        }

        // 결과 파싱
        const lines = stdout.split('\r\n');
        const diskInfo = lines.slice(1, lines.length - 1).map(line => {
            const [caption, freeSpace, size] = line.trim().split(/\s+/);
            return { caption, freeSpace, size };
        });

        res.send(diskInfo);
    });
});

app.get('/.well-known/pki-validation/EE49613F090DCAE945A113423DA84ED6.txt', (req, res) => {
    res.sendFile(__dirname + '/.well-known/pki-validation/EE49613F090DCAE945A113423DA84ED6.txt');
});

https.createServer(sslOptions, app).listen(port, () => {
    console.log(`Application started and Listening on port ${port}`)
});


/** Helper */

function getStorage(root, list = []) {
    const files = fs.readdirSync(root);

    files.forEach(file => {
        const filePath = path.join(root, file);
        const stat = fs.statSync(filePath);
        var node = {}

        if (stat.isDirectory()) {
            node.stat = "folder";
            node.name = file;
            node.path = relPath(convertPath(filePath));
            node.modified = stat.mtime;
            node.size = stat.size;
            node.list = getStorage(filePath, node.list);
            list.push(node);
        } else {
            node.stat = "file";
            node.name = file;
            node.path = relPath(convertPath(filePath));
            node.modified = stat.mtime;
            node.size = stat.size;
            list.push(node);
        }
    })

    return list;
}

function convertPath(path) {
    return path.replaceAll('\\', '/');
}

function relPath(path) {
    var parts = path.split(root);
    return parts.pop();
}

function absPath(path) {
    return root + path;
}