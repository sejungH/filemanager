var verified = false;
var currPath = "C:/Users/hunis/web/files";

function verify(password) {
    $.post("/verify", { 'password': password })
        .done(function () {
            $("#login").hide();
            openPath();
            verified = true;
        })
        .fail(function () {
            console.log("Login Failed");
        })
}

function openPath(path = "C:/Users/hunis/web/files") {
    currPath = path;

    var path_div = document.getElementById("path");
    path_div.style.display = "inline-block";
    path_div.innerText = path;

    var panel = document.getElementById("panel")
    panel.style.display = "inline-block";
    var refresh = document.getElementById("refresh_btn")
    refresh.setAttribute("onclick", `openPath('${path}')`)
    var newdir = document.getElementById("newdir_btn")
    newdir.setAttribute("onclick", `newDirectory('${path}')`)
    var upload = document.getElementById("upload")
    upload.setAttribute("onchange", `uploadFile(this, '${path}')`)

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
            tr.innerHTML += `<td class="td_folder" onclick="openPath('${file.path}')" draggable="true" ondragstart="drag(event, '${file.path}')" ondrop="drop(event, '${file.path}')" ondragover="allowDrop(event)">${file.name}</td>`;
            tr.innerHTML += `<td class="file_modified">${convertDate(file.modified)}</td>`;
            tr.innerHTML += `<td class="file_stat">${file.stat}</td>`;
            tr.innerHTML += `<td class="file_size"></td>`;
            tr.innerHTML += `<td class="file_icons">
                            <span class="rename_icon" onclick="renameFile('${file.name}', '${parentPath(file.path)}')"></span>
                            <span class="delete_icon" onclick="deleteFolder('${file.path}')"></span>
                        </td>`;
            fileList.append(tr);
        }
    })
    data.forEach(file => {
        if (file.stat == "file") {
            var tr = document.createElement('tr');
            tr.innerHTML += `<td class="td_file" onclick="downloadFile('${file.name}', '${file.path}')" draggable="true" ondragstart="drag(event, '${file.path}')">${file.name}</td>`;
            tr.innerHTML += `<td class="file_modified">${convertDate(file.modified)}</td>`;
            tr.innerHTML += `<td class="file_stat">${file.stat}</td>`;
            tr.innerHTML += `<td class="file_size">${convertFileSize(file.size)}</td>`;
            tr.innerHTML += `<td class="file_icons">
                            <span class="rename_icon" onclick="renameFile('${file.name}', '${parentPath(file.path)}')"></span>
                            <span class="delete_icon" onclick="deleteFile('${file.path}')"></span>
                        </td>`;
            fileList.append(tr);
        }
    })
}

function uploadFile(event, path) {
    for (var i = 0; i < event.files.length; i++) {
        var file = event.files[i];
        console.log(file);
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
                openPath(path);
            } else {
                alert("파일 업로드에 실패했습니다");
            }
        };
        xhr.send(formData);
    }
}

function downloadFile(filename, path) {
    var link = document.createElement('a');
    link.href = "/download?path=" + path;
    link.download = filename;
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function deleteFile(path) {
    if (confirm(`'${path}'을 삭제합니다`)) {
        $.post("/delete", { path: path })
            .done(function () {
                openPath(parentPath(path));
            })
            .fail(function () {
                alert("파일 삭제에 실패했습니다");
            })
    }
}

function deleteFolder(path) {
    if (confirm(`'${path}'을 삭제합니다`)) {
        $.post("/deleteDirectory", { path: path })
            .done(function () {
                openPath(parentPath(path));
            })
            .fail(function () {
                alert("폴더 삭제에 실패했습니다");
            })
    }
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
                <th class="file_icons"> </th>
            </tr>`;

    if (path != "C:/Users/hunis/web/files") {
        var tr = document.createElement('tr');
        tr.innerHTML += `<td class="td_folder" onclick="openPath('${parentPath(path)}')" ondrop="drop(event, '${parentPath(path)}')" ondragover="allowDrop(event)">../</td>`;
        tr.innerHTML += `<td></td>`;
        tr.innerHTML += `<td></td>`;
        tr.innerHTML += `<td></td>`;
        tr.innerHTML += `<td></td>`;
        table.append(tr);
    }
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


/* 파일 드래그 & 드롭 */

function handleDragOver(event) {
    if (event) {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'copy';
    }
}

function handleDrop(event) {
    if (event) {
        event.preventDefault();
        var files = event.dataTransfer.files;
        uploadFile(event.dataTransfer, currPath);
    }

}

function handleMouseClick(event) {
    if (event && event.button == 3) {
        if (currPath != "C:/Users/hunis/web/files") {
            openPath(parentPath(currPath));
        }
        event.preventDefault();
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
            })
        })
}