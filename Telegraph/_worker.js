export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    const domain = env.DOMAIN;
    const DATABASE = env.DATABASE;
    const USERNAME = env.USERNAME;
    const PASSWORD = env.PASSWORD;
    const adminPath = env.ADMIN_PATH;
    const nsfwApiUrl = env.NSFW_API_URL;
    const enableAuth = env.ENABLE_AUTH === 'true';
    const nsfwThreshold = parseFloat(env.NSFW_THRESHOLD);

    switch (pathname) {
      case '/':
        return await handleRootRequest(request, USERNAME, PASSWORD, enableAuth);
      case `/${adminPath}`:
        return await handleAdminRequest(DATABASE, request, USERNAME, PASSWORD);
      case '/upload':
        return request.method === 'POST' ? await handleUploadRequest(request, DATABASE, enableAuth, USERNAME, PASSWORD, domain, nsfwApiUrl, nsfwThreshold) : new Response('Method Not Allowed', { status: 405 });
      case '/bing-images':
        return handleBingImagesRequest();
      case '/delete-images':
        return handleDeleteImagesRequest(request, DATABASE);
      default:
        return handleImageRequest(pathname, DATABASE);
    }
  }
};

let isAuthenticated = false;

function authenticate(request, USERNAME, PASSWORD) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader) return false;
  return isValidCredentials(authHeader, USERNAME, PASSWORD);
}

async function handleRootRequest(request, USERNAME, PASSWORD, enableAuth) {
  if (enableAuth) {
    if (!authenticate(request, USERNAME, PASSWORD)) {
      return new Response('Unauthorized', { status: 401, headers: { 'WWW-Authenticate': 'Basic realm="Admin"' } });
    }
  }
  isAuthenticated = true;
  return new Response(`
  <!DOCTYPE html>
  <html lang="zh-CN">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="description" content="Telegraph图床-基于Workers的图床服务">
    <meta name="keywords" content="Telegraph图床,Workers图床, Cloudflare, Workers,telegra.ph, 图床">
    <title>Telegraph图床-基于Workers的图床服务</title>
    <link rel="icon" href="https://p1.meituan.net/csc/c195ee91001e783f39f41ffffbbcbd484286.ico" type="image/x-icon">
    <link href="https://lf3-cdn-tos.bytecdntp.com/cdn/expire-1-M/twitter-bootstrap/4.6.1/css/bootstrap.min.css" rel="stylesheet" />
    <link href="https://lf26-cdn-tos.bytecdntp.com/cdn/expire-1-M/bootstrap-fileinput/5.2.7/css/fileinput.min.css" rel="stylesheet" />
    <link href="https://lf26-cdn-tos.bytecdntp.com/cdn/expire-1-M/toastr.js/2.1.4/toastr.min.css" rel="stylesheet" />
    <link href="https://lf3-cdn-tos.bytecdntp.com/cdn/expire-1-M/font-awesome/5.15.4/css/all.min.css" type="text/css" rel="stylesheet" />
    <style>
      body {
        margin: 0;
        display: flex;
        justify-content: center;
        align-items: center;
        height: 100vh;
        position: relative;
      }
      .background {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-size: cover;
        z-index: -1;
        transition: opacity 1s ease-in-out;
        opacity: 1;
      }
      .card {
        background-color: rgba(255, 255, 255, 0.8);
        border: none;
        border-radius: 10px;
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
        padding: 20px;
        width: 90%;
        max-width: 400px;
        text-align: center;
        margin: 0 auto;
        position: relative;
      }
      .uniform-height {
        margin-top: 20px;
      }
      #viewCacheBtn {
        position: absolute;
        top: 10px;
        right: 10px;
        background: none;
        border: none;
        color: rgba(0, 0, 0, 0.1);
        cursor: pointer;
        font-size: 24px;
        transition: color 0.3s ease;
      }
      #viewCacheBtn:hover {
        color: rgba(0, 0, 0, 0.4);
      }
      #cacheContent {
        margin-top: 20px;
        max-height: 40vh;
        border-radius: 5px;
        overflow-y: auto;
      }
      .cache-title {
        text-align: left;
        margin-bottom: 10px;
      }
      .cache-item {
        display: block;
        cursor: pointer;
        border-radius: 4px;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        transition: background-color 0.3s ease;
        text-align: left;
        padding: 10px;
      }
      .cache-item:hover {
        background-color: #e9ecef;
      }
      .project-link {
        font-size: 14px;
        text-align: center;
        margin-top: 5px;
        margin-bottom: 0;
      }
      textarea.form-control {
        overflow: hidden;
      }
    </style>
  </head>
  <body>
    <div class="background" id="background"></div>
    <div class="card">
      <div class="title">Telegraph图床</div>
      <button type="button" class="btn" id="viewCacheBtn" title="查看历史记录"><i class="fas fa-clock"></i></button>
      <div class="card-body">
        <form id="uploadForm" action="/upload" method="post" enctype="multipart/form-data">
          <div class="file-input-container">
            <input id="fileInput" name="file" type="file" class="form-control-file" data-browse-on-zone-click="true" multiple>
          </div>
          <div class="form-group mb-3 uniform-height" style="display: none;">
            <button type="button" class="btn btn-light mr-2" id="urlBtn">URL</button>
            <button type="button" class="btn btn-light mr-2" id="bbcodeBtn">BBCode</button>
            <button type="button" class="btn btn-light" id="markdownBtn">Markdown</button>
          </div>
          <div class="form-group mb-3 uniform-height" style="display: none;">
            <textarea class="form-control" id="fileLink" readonly></textarea>
          </div>
          <div id="cacheContent" style="display: none;"></div>
        </form>
        </div>
        <p class="project-link">项目开源于 GitHub - <a href="https://github.com/0-RTT/telegraph" target="_blank" rel="noopener noreferrer">0-RTT/telegraph</a></p>
        <script src="https://lf3-cdn-tos.bytecdntp.com/cdn/expire-1-M/jquery/3.6.0/jquery.min.js" type="application/javascript"></script>
        <script src="https://lf26-cdn-tos.bytecdntp.com/cdn/expire-1-M/bootstrap-fileinput/5.2.7/js/fileinput.min.js" type="application/javascript"></script>
        <script src="https://lf26-cdn-tos.bytecdntp.com/cdn/expire-1-M/bootstrap-fileinput/5.2.7/js/locales/zh.min.js" type="application/javascript"></script>
        <script src="https://lf9-cdn-tos.bytecdntp.com/cdn/expire-1-M/toastr.js/2.1.4/toastr.min.js" type="application/javascript"></script>
        <script>
        async function fetchBingImages() {
          const response = await fetch('/bing-images');
          const data = await response.json();
          return data.data.map(image => image.url);
        }
      
        async function setBackgroundImages() {
          const images = await fetchBingImages();
          const backgroundDiv = document.getElementById('background');
          if (images.length > 0) {
            backgroundDiv.style.backgroundImage = 'url(' + images[0] + ')';
          }
          let index = 0;
          let currentBackgroundDiv = backgroundDiv;
          setInterval(() => {
            const nextIndex = (index + 1) % images.length;
            const nextBackgroundDiv = document.createElement('div');
            nextBackgroundDiv.className = 'background next';
            nextBackgroundDiv.style.backgroundImage = 'url(' + images[nextIndex] + ')';
            document.body.appendChild(nextBackgroundDiv);
            nextBackgroundDiv.style.opacity = 0;
            setTimeout(() => {
              nextBackgroundDiv.style.opacity = 1;
            }, 50);
            setTimeout(() => {
              document.body.removeChild(currentBackgroundDiv);
              currentBackgroundDiv = nextBackgroundDiv;
              index = nextIndex;
            }, 1000);
          }, 5000);
        }
      
        $(document).ready(function() {
          let originalImageURLs = [];
          let isCacheVisible = false;
          initFileInput();
          setBackgroundImages();
      
          function initFileInput() {
            $("#fileInput").fileinput({
              theme: 'fa',
              language: 'zh',
              browseClass: "btn btn-primary",
              removeClass: "btn btn-danger",
              showUpload: false,
              showPreview: false,
            }).on('filebatchselected', handleFileSelection)
              .on('fileclear', handleFileClear);
          }
      
          async function handleFileSelection() {
            const files = $('#fileInput')[0].files;
            for (let i = 0; i < files.length; i++) {
              await uploadFile(files[i]);
            }
          }
      
          async function uploadFile(file) {
            try {
              toastr.info('上传中...', '', { timeOut: 0 });
              const interfaceInfo = {
                acceptTypes: 'image/gif,image/jpeg,image/jpg,image/png,video/mp4',
                gifAndVideoMaxSize: 5 * 1024 * 1024,
                otherMaxSize: 5 * 1024 * 1024,
                compressImage: true
              };
              if (['image/gif', 'video/mp4'].includes(file.type)) {
                if (file.size > interfaceInfo.gifAndVideoMaxSize) {
                  toastr.error('文件必须≤' + interfaceInfo.gifAndVideoMaxSize / (1024 * 1024) + 'MB');
                  return;
                }
              } else {
                if (interfaceInfo.compressImage === true) {
                  toastr.info('压缩中...', '', { timeOut: 0 });
                  const compressedFile = await compressImage(file);
                  file = compressedFile;
                } else if (interfaceInfo.compressImage === false) {
                  if (file.size > interfaceInfo.otherMaxSize) {
                    toastr.error('文件必须≤' + interfaceInfo.otherMaxSize / (1024 * 1024) + 'MB');
                    return;
                  }
                }
              }
              const formData = new FormData($('#uploadForm')[0]);
              formData.set('file', file, file.name);
              const uploadResponse = await fetch('/upload', { method: 'POST', body: formData });
              const responseData = await handleUploadResponse(uploadResponse);
              if (responseData.error) {
                toastr.error(responseData.error);
              } else {
                originalImageURLs.push(responseData.data);
                $('#fileLink').val(originalImageURLs.join('\\n\\n'));
                $('.form-group').show();
                adjustTextareaHeight($('#fileLink')[0]);
                toastr.success('文件上传成功！');
      
                saveToLocalCache(responseData.data, file.name);
              }
            } catch (error) {
              console.error('处理文件时出现错误:', error);
              $('#fileLink').val('文件处理失败！');
              toastr.error('文件处理失败！');
            } finally {
              toastr.clear();
            }
          }
      
          async function handleUploadResponse(response) {
            if (response.ok) {
              return await response.json();
            } else {
              const errorData = await response.json();
              return { error: errorData.error };
            }
          }
      
          $(document).on('paste', function(event) {
            const clipboardData = event.originalEvent.clipboardData;
            if (clipboardData && clipboardData.items) {
              for (let i = 0; i < clipboardData.items.length; i++) {
                const item = clipboardData.items[i];
                if (item.kind === 'file') {
                  const pasteFile = item.getAsFile();
                  uploadFile(pasteFile);
                  break;
                }
              }
            }
          });
      
          async function compressImage(file, quality = 0.5, maxResolution = 20000000) {
            return new Promise((resolve) => {
              const image = new Image();
              image.onload = () => {
                const width = image.width;
                const height = image.height;
                const resolution = width * height;
                let scale = 1;
                if (resolution > maxResolution) {
                  scale = Math.sqrt(maxResolution / resolution);
                }
                const targetWidth = Math.round(width * scale);
                const targetHeight = Math.round(height * scale);
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                canvas.width = targetWidth;
                canvas.height = targetHeight;
                ctx.drawImage(image, 0, 0, targetWidth, targetHeight);
                canvas.toBlob((blob) => {
                  const compressedFile = new File([blob], file.name, { type: 'image/jpeg' });
                  toastr.success('图片压缩成功！');
                  resolve(compressedFile);
                }, 'image/jpeg', quality);
              };
              const reader = new FileReader();
              reader.onload = (event) => {
                image.src = event.target.result;
              };
              reader.readAsDataURL(file);
            });
          }
      
          $('#urlBtn, #bbcodeBtn, #markdownBtn').on('click', function() {
            const fileLinks = originalImageURLs.map(url => url.trim()).filter(url => url !== '');
            if (fileLinks.length > 0) {
              let formattedLinks = '';
              switch ($(this).attr('id')) {
                case 'urlBtn':
                  formattedLinks = fileLinks.join('\\n\\n');
                  break;
                case 'bbcodeBtn':
                  formattedLinks = fileLinks.map(url => '[img]' + url + '[/img]').join('\\n\\n');
                  break;
                case 'markdownBtn':
                  formattedLinks = fileLinks.map(url => '![image](' + url + ')').join('\\n\\n');
                  break;
                default:
                  formattedLinks = fileLinks.join('\\n');
              }
              $('#fileLink').val(formattedLinks);
              adjustTextareaHeight($('#fileLink')[0]);
              copyToClipboardWithToastr(formattedLinks);
            }
          });
      
          function handleFileClear(event) {
            $('#fileLink').val('');
            adjustTextareaHeight($('#fileLink')[0]);
            hideButtonsAndTextarea();
            originalImageURLs = [];
          }
      
          function adjustTextareaHeight(textarea) {
            textarea.style.height = '1px';
            textarea.style.height = (textarea.scrollHeight) + 'px';
          }
      
          function copyToClipboardWithToastr(text) {
            const input = document.createElement('textarea');
            input.value = text;
            document.body.appendChild(input);
            input.select();
            document.execCommand('copy');
            document.body.removeChild(input);
            toastr.success('已复制到剪贴板', '', { timeOut: 300 });
          }
      
          function hideButtonsAndTextarea() {
            $('#urlBtn, #bbcodeBtn, #markdownBtn, #fileLink').parent('.form-group').hide();
          }
      
          function saveToLocalCache(url, fileName) {
            const timestamp = new Date().toLocaleString('zh-CN', { hour12: false }); // 使用浏览器时间，24小时制
            const cacheData = JSON.parse(localStorage.getItem('uploadCache')) || [];
            cacheData.push({ url, fileName, timestamp });
            localStorage.setItem('uploadCache', JSON.stringify(cacheData));
          }
      
          $('#viewCacheBtn').on('click', function() {
            const cacheData = JSON.parse(localStorage.getItem('uploadCache')) || [];
            const cacheContent = $('#cacheContent');
            cacheContent.empty();
            if (isCacheVisible) {
              cacheContent.hide();
              $('#fileLink').val('');
              $('#fileLink').parent('.form-group').hide();
              isCacheVisible = false;
            } else {
              if (cacheData.length > 0) {
                cacheData.reverse();
                cacheData.forEach((item) => {
                  const listItem = $('<div class="cache-item"></div>')
                    .text(item.timestamp + ' - ' + item.fileName)
                    .data('url', item.url);
                  cacheContent.append(listItem);
                  cacheContent.append('<br>');
                });
                cacheContent.show();
              } else {
                cacheContent.append('<div>还没有记录哦！</div>').show();
              }
              isCacheVisible = true;
            }
          });
      
          $(document).on('click', '.cache-item', function() {
            const url = $(this).data('url');
            originalImageURLs = [];
            $('#fileLink').val('');
            originalImageURLs.push(url);
            $('#fileLink').val(originalImageURLs.map(url => url.trim()).join('\\n\\n'));
            $('.form-group').show();
            adjustTextareaHeight($('#fileLink')[0]);
          });
        });
      </script>
  </body>
  </html>  
  `, { headers: { 'Content-Type': 'text/html;charset=UTF-8' } });
}

async function handleAdminRequest(DATABASE, request, USERNAME, PASSWORD) {
  if (!authenticate(request, USERNAME, PASSWORD)) {
    return new Response('Unauthorized', { status: 401, headers: { 'WWW-Authenticate': 'Basic realm="Admin"' } });
  }
  return await generateAdminPage(DATABASE);
}

function isValidCredentials(authHeader, USERNAME, PASSWORD) {
  const base64Credentials = authHeader.split(' ')[1];
  const credentials = atob(base64Credentials).split(':');
  const username = credentials[0];
  const password = credentials[1];
  return username === USERNAME && password === PASSWORD;
}

async function generateAdminPage(DATABASE) {
  const mediaData = await fetchMediaData(DATABASE);
  const mediaHtml = mediaData.map(({ key, url, timestamp }) => {
    const fileExtension = url.split('.').pop().toLowerCase();
    if (fileExtension === 'mp4') {
      return `
      <div class="media-container" data-key="${key}" onclick="toggleImageSelection(this)">
        <div class="media-type">视频</div>
        <video class="gallery-video" style="width: 100%; height: 100%; object-fit: contain;" data-src="${url}" controls>
          <source src="${url}" type="video/mp4">
          您的浏览器不支持视频标签。
        </video>
        <div class="upload-time">上传时间: ${new Date(timestamp).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}</div>
      </div>
      `;
    } else {
      return `
      <div class="image-container" data-key="${key}" onclick="toggleImageSelection(this)">
        <img data-src="${url}" alt="Image" class="gallery-image lazy">
        <div class="upload-time">上传时间: ${new Date(timestamp).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}</div>
      </div>
      `;
    }
  }).join('');
  
  const html = `
  <!DOCTYPE html>
  <html>
    <head>
      <title>图库</title>
      <link rel="icon" href="https://p1.meituan.net/csc/c195ee91001e783f39f41ffffbbcbd484286.ico" type="image/x-icon">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
      body {
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        background-color: #f4f4f4;
        margin: 0;
        padding: 20px;
      }
      .header {
        position: sticky;
        top: 0;
        background-color: #ffffff;
        z-index: 1000;
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 20px;
        padding: 15px 20px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        border-radius: 8px;
      }
      .gallery {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
        gap: 16px;
      }
      .image-container, .media-container {
        position: relative;
        overflow: hidden;
        border-radius: 12px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        aspect-ratio: 1 / 1;
        transition: transform 0.3s, box-shadow 0.3s;
      }
      .media-type {
        position: absolute;
        top: 10px;
        left: 10px;
        background-color: rgba(0, 0, 0, 0.7);
        color: white;
        padding: 5px;
        border-radius: 5px;
        font-size: 14px;
        z-index: 10;
        cursor: pointer;
      }
      .image-container .upload-time, .media-container .upload-time {
        position: absolute;
        bottom: 10px;
        left: 10px;
        background-color: rgba(255, 255, 255, 0.7);
        padding: 5px;
        border-radius: 5px;
        color: #000;
        font-size: 14px;
        z-index: 10;
        display: none;
      }
      .image-container:hover, .media-container:hover {
        transform: scale(1.05);
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
      }
      .gallery-image {
        width: 100%;
        height: 100%;
        object-fit: cover;
        transition: opacity 0.3s;
        opacity: 0;
      }
      .gallery-image.loaded {
        opacity: 1;
      }
      .media-container.selected, .image-container.selected {
        border: 2px solid #007bff;
        background-color: rgba(0, 123, 255, 0.1);
      }
      .footer {
        margin-top: 20px;
        text-align: center;
        font-size: 18px;
        color: #555;
      }
      .delete-button {
        background-color: #ff4d4d;
        color: white;
        border: none;
        border-radius: 5px;
        padding: 10px 15px;
        cursor: pointer;
        transition: background-color 0.3s;
        width: auto;
      }
      .delete-button:hover {
        background-color: #ff1a1a;
      }
      .hidden {
        display: none;
      }
      @media (max-width: 600px) {
        .gallery {
          grid-template-columns: repeat(2, 1fr);
        }
        .header {
          flex-direction: column;
          align-items: flex-start;
        }
        .header-right {
          margin-top: 10px;
        }
        .footer {
          font-size: 16px;
        }
        .delete-button {
          width: 100%;
          margin-top: 10px;
        }
      }
      </style>
      <script>
        let selectedCount = 0;
        const selectedKeys = new Set();
        function toggleImageSelection(container) {
          const key = container.getAttribute('data-key');
          container.classList.toggle('selected');
          const uploadTime = container.querySelector('.upload-time');
          if (container.classList.contains('selected')) {
            selectedKeys.add(key);
            selectedCount++;
            uploadTime.style.display = 'block';
          } else {
            selectedKeys.delete(key);
            selectedCount--;
            uploadTime.style.display = 'none';
          }
          updateDeleteButton();
        }
        function updateDeleteButton() {
          const deleteButton = document.getElementById('delete-button');
          const countDisplay = document.getElementById('selected-count');
          countDisplay.textContent = selectedCount;
          const headerRight = document.querySelector('.header-right');
          if (selectedCount > 0) {
            headerRight.classList.remove('hidden');
          } else {
            headerRight.classList.add('hidden');
          }
        }
        async function deleteSelectedImages() {
          if (selectedKeys.size === 0) return;
          const response = await fetch('/delete-images', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(Array.from(selectedKeys))
          });
          if (response.ok) {
            alert('选中的媒体已删除');
            location.reload();
          } else {
            alert('删除失败');
          }
        }
        document.addEventListener('DOMContentLoaded', () => {
          const images = document.querySelectorAll('.gallery-image[data-src]');
          const options = {
            root: null,
            rootMargin: '0px',
            threshold: 0.1
          };
          const imageObserver = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
              if (entry.isIntersecting) {
                const img = entry.target;
                img.src = img.dataset.src;
                img.onload = () => img.classList.add('loaded');
                observer.unobserve(img);
              }
            });
          }, options);
          images.forEach(image => {
            imageObserver.observe(image);
          });
        });
      </script>
    </head>
    <body>
      <div class="header">
        <div class="header-left">
          <span>当前共有 ${mediaData.length} 个媒体文件</span>
        </div>
        <div class="header-right hidden">
          <span>选中数量: <span id="selected-count">0</span></span>
          <button id="delete-button" class="delete-button" onclick="deleteSelectedImages()">删除选中</button>
        </div>
      </div>
      <div class="gallery">
        ${mediaHtml}
      </div>
      <div class="footer">
        到底啦
      </div>
    </body>
  </html>
  `;
  return new Response(html, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

async function fetchMediaData(DATABASE) {
  const result = await DATABASE.prepare('SELECT * FROM media ORDER BY timestamp DESC').all();
  return result.results.map(row => ({
    key: row.key,
    timestamp: row.timestamp,
    url: row.url
  }));
}

async function handleUploadRequest(request, DATABASE, enableAuth, USERNAME, PASSWORD, domain, nsfwApiUrl, nsfwThreshold) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');
    if (!file) throw new Error('缺少文件');

    if (enableAuth && !authenticate(request, USERNAME, PASSWORD)) {
      return new Response('Unauthorized', { status: 401, headers: { 'WWW-Authenticate': 'Basic realm="Admin"' } });
    }

    const response = await fetch('https://telegra.ph/upload?source=bugtracker', {
      method: 'POST',
      body: formData
    });
    if (!response.ok) throw new Error('上传到 telegra.ph 失败');

    const responseData = await response.json();
    const imageKey = responseData.src;
    const telegraPhURL = `https://telegra.ph${imageKey}`;

    if (!nsfwApiUrl) {
      const timestamp = Date.now();
      const imageURL = `https://${domain}${imageKey}`;
      await DATABASE.prepare('INSERT INTO media (key, timestamp, url) VALUES (?, ?, ?)').bind(imageKey, timestamp, imageURL).run();

      return new Response(JSON.stringify({ data: imageURL }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const nsfwResponse = await fetch(`${nsfwApiUrl}?url=${telegraPhURL}`);
    const nsfwData = await nsfwResponse.json();
    const totalNSFWScore = nsfwData.Porn + nsfwData.Sexy + nsfwData.Hentai;

    if (totalNSFWScore > nsfwThreshold) {
      return new Response(JSON.stringify({ error: '上传失败，内容不符合要求' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const timestamp = Date.now();
    const imageURL = `https://${domain}${imageKey}`;
    await DATABASE.prepare('INSERT INTO media (key, timestamp, url) VALUES (?, ?, ?)').bind(imageKey, timestamp, imageURL).run();

    return new Response(JSON.stringify({ data: imageURL }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('内部服务器错误:', error);
    return new Response(JSON.stringify({ error: '内部服务器错误' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}

async function handleBingImagesRequest() {
  const res = await fetch(`https://cn.bing.com/HPImageArchive.aspx?format=js&idx=0&n=5`);
  const bing_data = await res.json();
  const images = bing_data.images.map(image => ({
    url: `https://cn.bing.com${image.url}`
  }));
  const return_data = {
    status: true,
    message: "操作成功",
    data: images
  };
  return new Response(JSON.stringify(return_data), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}

async function handleImageRequest(pathname, DATABASE) {
  const result = await DATABASE.prepare('SELECT url FROM media WHERE key = ?').bind(pathname).first();
  if (result) {
    const url = new URL(result.url);
    url.hostname = 'telegra.ph';
    return fetch(url);
  }
  return new Response(null, { status: 404 });
}

async function handleDeleteImagesRequest(request, DATABASE) {
  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }
  try {
    const keysToDelete = await request.json();
    if (keysToDelete.length === 0) {
      return new Response(JSON.stringify({ message: '没有要删除的项' }), { status: 400 });
    }
    const placeholders = keysToDelete.map(() => '?').join(',');
    await DATABASE.prepare(`DELETE FROM media WHERE key IN (${placeholders})`).bind(...keysToDelete).run();
    return new Response(JSON.stringify({ message: '删除成功' }), { status: 200 });
  } catch (error) {
    console.error('删除图片时出错:', error);
    return new Response(JSON.stringify({ error: '删除失败' }), { status: 500 });
  }
}