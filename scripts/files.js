var currPath = "";

function verify(password) {
    $.post("/verify", { 'password': password })
        .done(function () {
            $("#login").hide();
            openPath(getPath());
            window.sessionStorage.setItem('verified', 'true');
        })
        .fail(function () {
            console.log("Login Failed");
        })
}

function openPath(path = "") {
    currPath = path;

    var path_div = document.getElementById("path");
    path_div.style.display = "inline-block";
    path_div.innerText = path == "" ? "/" : path;

    var panel = document.getElementById("panel")
    panel.style.display = "inline-block";
    var refresh = document.getElementById("refresh_btn")
    refresh.onclick = function () { openPath(path); }
    var newdir = document.getElementById("newdir_btn")
    newdir.onclick = function () { newDirectory(path) };
    var upload = document.getElementById("upload")
    upload.onchange = function () { uploadFiles(this.files, path) }

    var freeSpace = document.getElementById("freeSpace");
    freeSpace.style.display = "block";
    getFreeSpace();

    $.post("/files", { path: path })
        .done(function (data) {
            displayStorage(JSON.parse(data), path);
        })
}

function displayStorage(data, path) {
    var fileList = document.getElementById("fileList");
    clearTable(fileList, path);

    data.forEach(file => {
        if (file.stat == "folder") {
            var tr = document.createElement('tr');
            tr.onclick = function (event) { selectRow(event, tr) }
            tr.ondblclick = function () { location.href = window.origin + '/files' + file.path }
            tr.setAttribute("data-name", file.name);
            tr.setAttribute("data-path", file.path);
            tr.setAttribute("data-type", "folder");
            tr.innerHTML += `<td class="td_folder" draggable="true" ondragstart="drag(event, '${file.path}')" ondrop="drop(event, '${file.path}')" ondragover="allowDrop(event)">
                                <span class="folder_icon">📂</span>${file.name}
                            </td>`;
            tr.innerHTML += `<td class="file_modified">${convertDate(file.modified)}</td>`;
            tr.innerHTML += `<td class="file_stat">${file.stat}</td>`;
            tr.innerHTML += `<td class="file_size"></td>`;
            fileList.append(tr);
        }
    })
    data.forEach(file => {
        if (file.stat == "file") {
            var tr = document.createElement('tr');
            tr.onclick = function (event) { selectRow(event, tr) }
            tr.setAttribute("data-name", file.name);
            tr.setAttribute("data-path", file.path);
            tr.setAttribute("data-type", "file");
            tr.innerHTML += `<td class="td_file" data-name="${file.name}" draggable="true" ondragstart="drag(event, '${file.path}')">
                                <span class="file_icon">${fileIcon(file.name)}</span>${file.name}
                            </td>`;
            tr.innerHTML += `<td class="file_modified">${convertDate(file.modified)}</td>`;
            tr.innerHTML += `<td class="file_stat">${file.stat}</td>`;
            tr.innerHTML += `<td class="file_size">${convertFileSize(file.size)}</td>`;
            fileList.append(tr);
        }
    })
}

function downloadItems() {
    var selected = document.querySelectorAll(".selected");
    selected.forEach(row => {
        if (row.getAttribute("data-type") == "file") {
            downloadFile(row.getAttribute("data-name"), row.getAttribute("data-path"));
        } else if (row.getAttribute("data-type") == "folder") {
            downloadFolder(row.getAttribute("data-path"));
        }
    })
}

function downloadFolder(path) {
    console.log(path);
}

function downloadFile(filename, path) {
    var a = document.createElement('a');
    a.download = filename;
    a.href = '/download?path=' + path;
    a.click();
}

function uploadItems() {
    var input = document.createElement("input");
    input.type = "file"
    input.multiple = true;
    input.onchange = function () { uploadFiles(this.files, currPath) };
    input.click();
}

async function uploadFolders(folders, path = "") {
    var promises = [];
    for (let folder of folders) {
        promises.push(uploadFolder(folder, path));
    }

    Promise.all(promises)
        .then(function (response) {
            openPath(path);
        })
        .catch(function (error) {
            console.error('Error uploading folder:', error);
            alert("폴더 업로드에 실패했습니다");
        });
}

async function uploadFolder(folder, path) {
    return new Promise((resolve, reject) => {
        $.post("/newDirectory", { path: path, name: folder.name })
            .done(function () {
                var promises = [];
                const reader = folder.createReader();
                reader.readEntries(function (entries) {
                    entries.forEach(async function (entry) {
                        if (entry.isDirectory) {
                            promises.push(uploadFolder(entry, `${path}/${folder.name}`));
                        } else {
                            entry.file(async function (file) {
                                promises.push(uploadFile(file, `${path}/${folder.name}`));
                            });
                        }
                    })
                })

                Promise.all(promises)
                    .then(function (response) {
                        resolve();
                    })
                    .catch(function (error) {
                        console.error('Error uploading folders/files:', error);
                        alert("폴더/파일 업로드에 실패했습니다");
                        reject();
                    });
            })
            .fail(function () {
                alert("폴더 생성에 실패했습니다");
                reject();
            })
    });
}

async function uploadFiles(files, path = "") {
    var promises = [];
    for (let file of files) {
        promises.push(uploadFile(file, path));
    }

    Promise.all(promises)
        .then(function (response) {
            openPath(path);
        })
        .catch(function (error) {
            console.error('Error uploading file:', error);
            alert("파일 업로드에 실패했습니다");
        });
}

function uploadFile(file, path) {
    return new Promise((resolve, reject) => {
        var formData = new FormData();
        formData.append('path', path)
        formData.append('file', file);

        var xhr = new XMLHttpRequest();
        xhr.open('POST', '/upload', true);
        xhr.upload.onprogress = function (e) {
            if (e.lengthComputable) {
                var percent = (e.loaded / e.total) * 100;
                document.getElementById('progress').innerText = `🡅 '${file.name}' 업로드 중... (${percent.toFixed(2)}%)`;
            }
        };
        xhr.onload = function () {
            if (xhr.status === 200) {
                document.getElementById('progress').innerText = "";
                resolve(xhr.responseText);
            } else {
                reject(xhr.statusText);
            }
        };
        xhr.onerror = function () {
            reject(xhr.statusText);
        };
        xhr.send(formData);
    });
}

async function deleteItems() {
    var selected = document.querySelectorAll(".selected");
    var promises = [];

    selected.forEach(row => {
        if (row.getAttribute("data-type") == "folder") {
            promises.push(deleteFolder(row.getAttribute("data-path")));
        } else if (row.getAttribute("data-type") == "file") {
            promises.push(deleteFile(row.getAttribute("data-path")));
        }
    });

    Promise.all(promises)
        .then(function (response) {
            openPath(currPath);
        })
        .catch(function (error) {
            console.error(`Error deleting folder/file: ${path}`);
            alert("폴더/파일 삭제에 실패했습니다");
        });
}

function deleteFile(path) {
    return new Promise((resolve, reject) => {
        if (confirm(`'${path}'을 삭제합니다`)) {
            $.post("/delete", { path: path })
                .done(function () {
                    resolve();
                })
                .fail(function () {
                    reject();
                })
        }
    });
}

function deleteFolder(path) {
    return new Promise((resolve, reject) => {
        if (confirm(`'${path}'을 삭제합니다`)) {
            $.post("/deleteDirectory", { path: path })
                .done(function () {
                    resolve();
                })
                .fail(function () {
                    reject();
                })
        }
    });
}

function newDirectory(path) {
    var name = window.prompt("새 폴더 이름:")
    if (name) {
        $.post("/newDirectory", { path: path, name: name })
            .done(function () {
                openPath(path);
            })
            .fail(function () {
                alert("폴더 생성에 실패했습니다");
            })
    }
}

function renameFile(filename, path) {
    var newName = window.prompt("이름 변경:", filename)
    if (newName) {
        $.post("/rename", { path: path, oldName: filename, newName: newName })
            .done(function () {
                openPath(path);
            })
            .fail(function () {
                alert("파일 이름 변경에 실패했습니다");
            })
    }
}

function moveFile(oldPath, newPath) {
    $.post("/move", { oldPath: oldPath, newPath: newPath })
        .done(function () {
            openPath(parentPath(oldPath));
        })
        .fail(function () {
            alert("파일 이동에 실패했습니다");
        })
}

function clearTable(table, path) {
    table.innerHTML = `<tr>
                <th class="file_name">이름</th>
                <th class="file_modified">수정한 날짜</th>
                <th class="file_stat">유형</th>
                <th class="file_size">크기</th>
            </tr>`;

    if (path != "" && path != "/") {
        var tr = document.createElement('tr');
        tr.setAttribute("data-path", parentPath(path));
        tr.setAttribute("data-type", "folder");
        tr.innerHTML += `<td class="td_folder" ondrop="drop(event, '${parentPath(path)}')" ondragover="allowDrop(event)" ondblclick="location.href = window.origin + '/files${parentPath(path)}'">
                            <span class="folder_icon">📂</span>../
                        </td>`;
        tr.innerHTML += `<td></td>`;
        tr.innerHTML += `<td></td>`;
        tr.innerHTML += `<td></td>`;
        table.append(tr);
    }
}

/** 헬퍼 메소드 */

function getPath() {
    var url = decodeURIComponent(location.pathname);
    var parts = url.split('/').filter(Boolean);
    parts.shift();
    return "/" + parts.join('/');
}

function convertFileSize(size) {
    if (size / (1024 * 1024 * 1024 * 1024) > 1) {
        return (size / (1024 * 1024 * 1024 * 1024)).toFixed(2) + " TB";
    } else if (size / (1024 * 1024 * 1024) > 1) {
        return (size / (1024 * 1024 * 1024)).toFixed(2) + " GB";
    } else if (size / (1024 * 1024) > 1) {
        return (size / (1024 * 1024)).toFixed(2) + " MB";
    } else {
        return (size / 1024).toFixed(2) + " KB";
    }

}

function convertDate(date) {
    return new Date(date).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
}

function parentPath(path) {
    let parts = path.split('/');
    parts.pop();
    let parentPath = parts.join('/');
    if (parentPath === '') {
        parentPath = '/';
    }

    return parentPath;
}

function fileIcon(filename) {
    var parts = filename.split('.');
    var ext = parts.pop();
    if (["mp4", "mkv", "mov", "avi", "ts"].includes(ext.toLowerCase())) {
        return "🎬";
    } else if (["png", "jpg", "jpeg", "gif", "ts", "ico", "svg", "webp", "jfif"].includes(ext.toLowerCase())) {
        return "🖼️";
    } else if (["mp3", "aac", "flac", "wav"].includes(ext.toLowerCase())) {
        return "🎵";
    } else if (["zip", "tar", "gz", "7z", "jar"].includes(ext.toLowerCase())) {
        return "📦";
    } else if (["exe", "msi", "bat"].includes(ext.toLowerCase())) {
        return "💿";
    } else if (["ini", "inf"].includes(ext.toLowerCase())) {
        return "⚙️";
    } else {
        return "📄";
    }
}


/* 폴더 이동 */

function allowDrop(ev) {
    ev.preventDefault();
}

function drag(ev, path) {
    ev.dataTransfer.setData("path", path);
}

function drop(ev, newPath) {
    ev.preventDefault();
    var oldPath = ev.dataTransfer.getData("path");
    if (oldPath != newPath) {
        moveFile(oldPath, newPath);
    }
}


/** 파일 드래그 & 드롭 */

function handleDragOver(event) {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
}

async function handleDrop(event) {
    event.preventDefault();
    if (event.dataTransfer.items) {
        var folders = [];
        var files = [];
        for (let i = 0; i < event.dataTransfer.items.length; i++) {
            if (event.dataTransfer.items[i].kind == "file") {
                if (event.dataTransfer.items[i].webkitGetAsEntry().isFile) {
                    const file = event.dataTransfer.items[i].getAsFile();
                    files.push(file);
                } else {
                    const folder = event.dataTransfer.items[i].webkitGetAsEntry();
                    folders.push(folder);
                }
            }
        }

        if (folders.length > 0) { uploadFolders(folders, currPath) }
        if (files.length > 0) { uploadFiles(files, currPath) }
    }
}

/** 여유 공간 계산 */

function getFreeSpace() {
    $.post("/disk")
        .done(function (response) {
            var data = JSON.parse(response);
            data.forEach(disk => {
                if (disk.caption == "C:") {
                    var size = disk.size;
                    var freeSpace = disk.freeSpace;
                    var used = size - freeSpace;
                    var percent = ((used / size) * 100).toFixed(2);

                    var freeSpace = document.getElementById("freeSpace");
                    freeSpace.innerText = `${convertFileSize(size)} 중 ${convertFileSize(used)} 사용 (${percent}%)`;
                }
            });
        });
}

function showContextMenu(event) {
    event.preventDefault();
    if (event.target.tagName == "TD") {
        var tr = event.target.parentElement;
        if (document.querySelectorAll(".selected").length == 1) {
            selectRow(event, tr);
        }
        if (!tr.classList.contains("selected")) {
            tr.classList.add("selected");
        }

        var filename = tr.getAttribute("data-name");
        var path = tr.getAttribute("data-path");

        var menu = "<ul>";
        if (document.querySelectorAll(".selected").length == 1 && tr.getAttribute("data-type") == "folder") {
            menu += `<li data-option='open' onclick='location.href = window.origin + "/files" + "${path}"'>📂 열기</li>`;
        }
        menu += `<li data-option='download' onclick='downloadItems()'>⬇️ 다운로드</li>`;
        if (document.querySelectorAll(".selected").length == 1 && tr.getAttribute("data-name")) {
            menu += `<li data-option='rename' onclick='renameFile("${filename}", "${path}")'>📝 이름 바꾸기</li>`;
        }
        if (tr.getAttribute("data-name")) {
            menu += `<li data-option='delete' onclick='deleteItems()'>🗑️ 삭제</li>`;
        }
        if (document.querySelectorAll(".selected").length == 1) {
            menu += `<li data-option='copyURL' onclick='copyURL("${path}")'>🔗 링크 복사하기</li>`;
        }
        menu += "</ul>";

    } else if (event.target.tagName == "BODY" || event.target.tagName == "MAIN") {
        var menu = "<ul>";
        menu += `<li data-option='newdir' onclick='newDirectory("${currPath}")'>📁 새 폴더</li>`;
        menu += `<li data-option='upload' onclick='uploadItems()'>⬆️ 파일 업로드</li>`;
        menu += `<li data-option='copyURL' onclick='copyURL("${currPath}")'>🔗 링크 복사하기</li>`;
        menu += `<li data-option='reload' onclick='openPath("${currPath}")'>🔃 새로고침</li>`;
        menu += "</ul>";
    }


    if (menu) {
        const contextMenu = document.getElementById("context-menu");
        contextMenu.innerHTML = menu;
        contextMenu.style.display = "block";
        contextMenu.style.left = event.clientX + "px";
        contextMenu.style.top = event.clientY + "px";
    }

}

function selectRow(event, tr) {
    var table = tr.parentElement;
    var selected = table.querySelectorAll(".selected");
    if (selected.length > 0 && !event.shiftKey) {
        selected.forEach(row => {
            if (row != tr) {
                row.classList.remove("selected");
            }
        })
    }
    if (tr.classList.contains("selected")) {
        tr.classList.remove("selected");
    } else {
        tr.classList.add("selected");
    }

    updateRenameBtn();
    updateDeleteBtn();
}

function clickEmpty(event) {
    if (event.target == document.body) {
        var selected = document.querySelectorAll(".selected");
        selected.forEach(row => {
            row.classList.remove("selected");
        });
    }

    var contextMenu = document.getElementById("context-menu");
    contextMenu.style.display = "none";
}

function updateRenameBtn() {
    var btn = document.getElementById("rename_btn");
    var selected = document.querySelectorAll(".selected");
    if (selected.length == 1) {
        btn.style.opacity = 1;
        btn.style.cursor = "pointer";
        var filename = selected[0].getAttribute("data-name");
        btn.setAttribute("onclick", `renameFile('${filename}', '${currPath}')`);
    } else {
        btn.style.opacity = 0.3
        btn.style.cursor = "initial";
        btn.removeAttribute("onclick");
    }
}

function updateDeleteBtn() {
    var btn = document.getElementById("delete_btn");
    var selected = document.querySelectorAll(".selected");
    if (selected.length > 0) {
        btn.style.opacity = 1;
        btn.style.cursor = "pointer";
        btn.setAttribute("onclick", "deleteItems()")
    } else {
        btn.style.opacity = 0.3
        btn.style.cursor = "initial";
        btn.removeAttribute("onclick");
    }
}

function copyURL(path) {
    navigator.clipboard.writeText(window.origin + "/file" + path);
}