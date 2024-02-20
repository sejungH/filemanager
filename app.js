const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { kMaxLength } = require('buffer');

const app = express();
const port = 80;
const password = "1011";

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, req.body.path);
    },
    filename: function (req, file, cb) {
        file.originalname = Buffer.from(file.originalname, 'latin1').toString('utf8')
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
    var storage = getStorage(req.body.path);
    res.send(storage);
});

app.get('/download', (req, res) => {
    res.sendFile(req.query.path);
});

app.post('/upload', upload.single('file'), (req, res) => {
    console.log('File uploaded: ' + Buffer.from(req.file.originalname, 'latin1').toString('utf8'));
    res.status(200).send('File uploaded successfully');
});

app.post('/delete', (req, res) => {
    fs.unlink(req.body.path, (err) => {
        if (err) {
            console.error('Error deleting file:', err);
            return;
        }
        console.log(`File '${req.body.path}' deleted`);
        res.status(200).send(`File deleted successfully`);
    })
});

app.post('/deleteDirectory', (req, res) => {
    fs.rmSync(req.body.path, { recursive: true, force: true });
    console.log(`Folder '${req.body.path}' deleted`);
    res.status(200).send(`Folder deleted successfully`);
});

app.post('/newDirectory', (req, res) => {
    fs.mkdir(`${req.body.path}/${req.body.name}`, { recursive: true }, (err) => {
        if (err) {
            console.error('Error creating folder:', err);
            return;
        }
        console.log(`Folder '${req.body.path}/${req.body.name}' created`);
        res.status(200).send(`Folder created successfully`);
    });
})

app.post('/rename', (req, res) => {
    fs.rename(`${req.body.path}/${req.body.oldName}`, `${req.body.path}/${req.body.newName}`, (err) => {
        if (err) {
            console.error('Error renaming folder:', err);
            return;
        }
        console.log(`File '${req.body.path}/${req.body.newName}' renamed`);
        res.status(200).send(`File renamed successfully`);
    });
})

app.listen(port, () => {
    console.log(`Application started and Listening on port ${port}`)
});

function getStorage(root, list = []) {
    const files = fs.readdirSync(root);

    files.forEach(file => {
        const filePath = path.join(root, file);
        const stat = fs.statSync(filePath);
        var node = {}

        if (stat.isDirectory()) {
            node.stat = "folder";
            node.name = file;
            node.path = convertPath(filePath);
            node.modified = stat.mtime;
            node.size = stat.size;
            node.list = getStorage(filePath, node.list);
            list.push(node);
        } else {
            node.stat = "file";
            node.name = file;
            node.path = convertPath(filePath);
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