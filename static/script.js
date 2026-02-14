const form = document.getElementById("uploadForm");
const photoInput = document.getElementById("photoInput");
const selectedPreviewContainer = document.getElementById("selectedPreviewContainer");
const selectedPreview = document.getElementById("selectedPreview");
const cropOpenBtn = document.getElementById("cropOpenBtn");
const cropModal = document.getElementById("cropModal");
const cropCanvas = document.getElementById("cropCanvas");
const cropClose = document.getElementById("cropClose");
const cancelCropBtn = document.getElementById("cancelCropBtn");
const saveCropBtn = document.getElementById("saveCropBtn");
const saveFilename = document.getElementById("saveFilename");
const dpiInput = document.getElementById("dpiInput");
const cropDims = document.getElementById("cropDims");

const previewContainer = document.getElementById("previewContainer");
const previewImage = document.getElementById("previewImage");
const downloadBtn = document.getElementById("downloadBtn");
const progressBar = document.getElementById("progressBar");
const progressFill = document.getElementById("progressFill");
let previewData = null;

let _progressTimer = null;
let _progressValue = 0;

// cropping state
let croppingImage = null;      // HTMLImageElement for crop modal
let cropCtx = cropCanvas ? cropCanvas.getContext("2d") : null;
let isDragging = false;
let dragStart = null;
let cropRect = null;           // {x,y,w,h} in canvas coords
let canvasScale = 1;           // ratio original->canvas
let croppedBlob = null;        // Blob produced by crop (if saved)

// new: allow moving/resizing persistent selection
let actionMode = null;         // 'move' | 'resize' | null
let activeHandle = -1;         // 0..3 for corners
const handleSize = 12;
let moveOrigin = null;         // store original rect for moving

// default DPI used for converting pixels -> mm (can be changed by user)
let DPI = 300;
if (dpiInput) {
  DPI = parseInt(dpiInput.value, 10) || 300;
  dpiInput.addEventListener("input", () => {
    const v = parseInt(dpiInput.value, 10);
    DPI = Number.isFinite(v) && v > 0 ? v : 300;
    updateCropDimensions();
  });
}

// update the dimensions display (in mm) using cropRect and canvasScale
function updateCropDimensions() {
  if (!cropDims) return;
  if (!cropRect || !canvasScale) {
    cropDims.textContent = "W × H: — mm";
    return;
  }
  // convert canvas coords -> original pixels
  const pxW = Math.round(cropRect.w * canvasScale);
  const pxH = Math.round(cropRect.h * canvasScale);
  // pixels -> inches -> mm
  const inW = pxW / DPI;
  const inH = pxH / DPI;
  const mmW = (inW * 25.4);
  const mmH = (inH * 25.4);
  // show with one decimal
  cropDims.textContent = `W × H: ${mmW.toFixed(1)} × ${mmH.toFixed(1)} mm`;
}

// existing progress helpers
function startProgress() {
  if (!progressBar || !progressFill) return;
  clearInterval(_progressTimer);
  _progressValue = 0;
  progressFill.style.width = "0%";
  progressBar.classList.remove("hidden");
  progressBar.setAttribute("aria-valuenow", "0");

  _progressTimer = setInterval(() => {
    const remaining = 90 - _progressValue;
    if (remaining <= 0) return;
    const inc = Math.max(1, Math.round(remaining * (0.05 + Math.random() * 0.12)));
    _progressValue = Math.min(90, _progressValue + inc);
    progressFill.style.width = _progressValue + "%";
    progressBar.setAttribute("aria-valuenow", String(_progressValue));
  }, 300);
}
function finishProgress(success = true) {
  if (!progressBar || !progressFill) return;
  clearInterval(_progressTimer);
  _progressValue = 100;
  progressFill.style.width = "100%";
  progressBar.setAttribute("aria-valuenow", "100");
  setTimeout(() => {
    progressBar.classList.add("hidden");
    progressFill.style.width = "0%";
    progressBar.setAttribute("aria-valuenow", "0");
  }, success ? 700 : 1200);
}

// track selected previously uploaded filename (use hidden input because you can't set file input.value)
let selectedUploaded = null;
// ensure a hidden input exists in the form to store selection
let selectedUploadedInput = document.getElementById("selectedUploaded");
if (!selectedUploadedInput && form) {
  selectedUploadedInput = document.createElement("input");
  selectedUploadedInput.type = "hidden";
  selectedUploadedInput.id = "selectedUploaded";
  selectedUploadedInput.name = "selectedUploaded";
  form.appendChild(selectedUploadedInput);
}

// show small selected preview when user picks a file or after cropping
photoInput && photoInput.addEventListener("change", (e) => {
  // clear gallery selection when user picks a local file
  selectedUploaded = null;
  if (selectedUploadedInput) selectedUploadedInput.value = "";
  document.querySelectorAll("#thumbs .thumb.selected").forEach(el => el.classList.remove("selected"));

  croppedBlob = null; // reset any previous crop when user picks new file
  const f = e.target.files && e.target.files[0];
  if (!f) {
    selectedPreviewContainer.classList.add("hidden");
    selectedPreview.src = "";
    return;
  }
  const url = URL.createObjectURL(f);
  selectedPreview.src = url;
  selectedPreviewContainer.classList.remove("hidden");
  // default save name
  saveFilename.value = `cropped_${f.name || "image.png"}`;
});

// open crop modal (use selected file input or current selectedPreview image)
async function openCropModal() {
  // choose source: if user selected file use that, otherwise if preview exists use its src
  let src = null;
  if (photoInput && photoInput.files && photoInput.files[0]) {
    src = URL.createObjectURL(photoInput.files[0]);
  } else if (selectedPreview && selectedPreview.src) {
    src = selectedPreview.src;
  } else {
    alert("Please choose a file first.");
    return;
  }

  cropModal.classList.remove("hidden");
  croppedBlob = null;

  croppingImage = new Image();
  croppingImage.crossOrigin = "anonymous";
  await new Promise((res, rej) => {
    croppingImage.onload = res;
    croppingImage.onerror = rej;
    croppingImage.src = src;
  });

  // fit canvas to viewport while keeping aspect
  const maxW = Math.min(window.innerWidth * 0.9, 1000);
  const maxH = Math.min(window.innerHeight * 0.75, 800);
  let cw = croppingImage.naturalWidth;
  let ch = croppingImage.naturalHeight;
  const ratio = cw / ch;
  if (cw > maxW) { cw = maxW; ch = Math.round(cw / ratio); }
  if (ch > maxH) { ch = maxH; cw = Math.round(ch * ratio); }

  cropCanvas.width = cw;
  cropCanvas.height = ch;
  canvasScale = croppingImage.naturalWidth / cw;
  cropRect = null;
  drawCropCanvas();
}

// helper: point in rect
function pointInRect(px, py, r) {
  return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
}

// helper: get handle rectangles (tl, tr, br, bl)
function getHandleRects(r) {
  const half = handleSize / 2;
  return [
    { x: r.x - half,          y: r.y - half,          cx: r.x,          cy: r.y },           // tl
    { x: r.x + r.w - half,    y: r.y - half,          cx: r.x + r.w,    cy: r.y },           // tr
    { x: r.x + r.w - half,    y: r.y + r.h - half,    cx: r.x + r.w,    cy: r.y + r.h },       // br
    { x: r.x - half,          y: r.y + r.h - half,    cx: r.x,          cy: r.y + r.h },       // bl
  ];
}
function getHandleAtPoint(px, py) {
  if (!cropRect) return -1;
  const rects = getHandleRects(cropRect);
  for (let i = 0; i < rects.length; i++) {
    const hr = rects[i];
    if (px >= hr.x && px <= hr.x + handleSize && py >= hr.y && py <= hr.y + handleSize) return i;
  }
  return -1;
}

// constrain cropRect inside canvas
function clampRectToCanvas(r) {
  if (!r) return;
  if (r.x < 0) { r.w += r.x; r.x = 0; }
  if (r.y < 0) { r.h += r.y; r.y = 0; }
  if (r.x + r.w > cropCanvas.width) r.w = cropCanvas.width - r.x;
  if (r.y + r.h > cropCanvas.height) r.h = cropCanvas.height - r.y;
  if (r.w < 1) r.w = 1;
  if (r.h < 1) r.h = 1;
}

// draw image, overlay and handles
function drawCropCanvas() {
  if (!cropCtx || !croppingImage) return;
  cropCtx.clearRect(0, 0, cropCanvas.width, cropCanvas.height);
  cropCtx.drawImage(croppingImage, 0, 0, cropCanvas.width, cropCanvas.height);

  if (cropRect) {
    cropCtx.save();
    cropCtx.fillStyle = "rgba(0,0,0,0.35)";
    cropCtx.beginPath();
    cropCtx.rect(0, 0, cropCanvas.width, cropCanvas.height);
    cropCtx.rect(cropRect.x, cropRect.y, cropRect.w, cropRect.h);
    // use evenodd fill if supported
    try { cropCtx.fill("evenodd"); } catch (e) { cropCtx.fill(); }
    cropCtx.restore();

    // dashed outline
    cropCtx.strokeStyle = "#fff";
    cropCtx.lineWidth = 2;
    cropCtx.setLineDash([6,4]);
    cropCtx.strokeRect(cropRect.x + 1, cropRect.y + 1, cropRect.w - 2, cropRect.h - 2);
    cropCtx.setLineDash([]);

    // draw resize handles (solid with subtle stroke)
    const handles = getHandleRects(cropRect);
    cropCtx.fillStyle = "#fff";
    cropCtx.strokeStyle = "rgba(0,0,0,0.45)";
    cropCtx.lineWidth = 1;
    for (const h of handles) {
      cropCtx.beginPath();
      cropCtx.rect(h.x, h.y, handleSize, handleSize);
      cropCtx.fill();
      cropCtx.stroke();
    }
  }

  // update dims display
  updateCropDimensions();
}

// pointer helpers: unified mouse/touch coords (now account for CSS scaling)
function getPointerPos(e) {
  const r = cropCanvas.getBoundingClientRect();
  const clientX = (e.touches && e.touches.length) ? e.touches[0].clientX : e.clientX;
  const clientY = (e.touches && e.touches.length) ? e.touches[0].clientY : e.clientY;
  const xCss = clientX - r.left;
  const yCss = clientY - r.top;
  const scaleX = cropCanvas.width / r.width;
  const scaleY = cropCanvas.height / r.height;
  return { x: Math.round(xCss * scaleX), y: Math.round(yCss * scaleY) };
}

// mouse / touch handlers for crop drawing with move/resize
if (cropCanvas) {
  cropCanvas.addEventListener("mousedown", (ev) => {
    const pos = getPointerPos(ev);
    const hx = getHandleAtPoint(pos.x, pos.y);
    if (hx >= 0 && cropRect) {
      // start resizing by handle
      isDragging = true;
      actionMode = "resize";
      activeHandle = hx;
      dragStart = pos;
      moveOrigin = { x: cropRect.x, y: cropRect.y, w: cropRect.w, h: cropRect.h };
      return;
    }
    if (cropRect && pointInRect(pos.x, pos.y, cropRect)) {
      // start move
      isDragging = true;
      actionMode = "move";
      dragStart = pos;
      moveOrigin = { x: cropRect.x, y: cropRect.y, w: cropRect.w, h: cropRect.h };
      return;
    }
    // start new selection
    isDragging = true;
    actionMode = "new";
    dragStart = pos;
    cropRect = { x: pos.x, y: pos.y, w: 0, h: 0 };
  });

  cropCanvas.addEventListener("mousemove", (ev) => {
    const pos = getPointerPos(ev);

    // when not dragging, update cursor to show possible actions and exit
    if (!isDragging || !dragStart) {
      const hx = getHandleAtPoint(pos.x, pos.y);
      if (hx >= 0) {
        cropCanvas.style.cursor = cursorForHandle(hx);
      } else if (cropRect && pointInRect(pos.x, pos.y, cropRect)) {
        cropCanvas.style.cursor = "move";
      } else {
        cropCanvas.style.cursor = "crosshair";
      }
      return;
    }

    // dragging logic (unchanged)
    const dx = pos.x - dragStart.x;
    const dy = pos.y - dragStart.y;

    if (actionMode === "move" && moveOrigin) {
      cropRect.x = Math.round(moveOrigin.x + dx);
      cropRect.y = Math.round(moveOrigin.y + dy);
      clampRectToCanvas(cropRect);
    } else if (actionMode === "resize" && moveOrigin) {
      let nx = moveOrigin.x, ny = moveOrigin.y, nw = moveOrigin.w, nh = moveOrigin.h;
      switch (activeHandle) {
        case 0: // tl
          nx = Math.round(moveOrigin.x + dx);
          ny = Math.round(moveOrigin.y + dy);
          nw = Math.round(moveOrigin.w - dx);
          nh = Math.round(moveOrigin.h - dy);
          break;
        case 1: // tr
          ny = Math.round(moveOrigin.y + dy);
          nw = Math.round(moveOrigin.w + dx);
          nh = Math.round(moveOrigin.h - dy);
          break;
        case 2: // br
          nw = Math.round(moveOrigin.w + dx);
          nh = Math.round(moveOrigin.h + dy);
          break;
        case 3: // bl
          nx = Math.round(moveOrigin.x + dx);
          nw = Math.round(moveOrigin.w - dx);
          nh = Math.round(moveOrigin.h + dy);
          break;
      }
      // normalize so width/height positive
      if (nw < 0) { nw = Math.abs(nw); nx = nx - nw; }
      if (nh < 0) { nh = Math.abs(nh); ny = ny - nh; }
      cropRect.x = nx; cropRect.y = ny; cropRect.w = nw; cropRect.h = nh;
      clampRectToCanvas(cropRect);
    } else if (actionMode === "new") {
      const x0 = dragStart.x, y0 = dragStart.y;
      const nx = Math.min(pos.x, x0), ny = Math.min(pos.y, y0);
      const nw = Math.abs(pos.x - x0), nh = Math.abs(pos.y - y0);
      cropRect.x = nx; cropRect.y = ny; cropRect.w = nw; cropRect.h = nh;
      clampRectToCanvas(cropRect);
    }

    drawCropCanvas();
  });

  // pull endDrag to function scope so window listeners can call it reliably
  function endDrag() {
    isDragging = false;
    actionMode = null;
    activeHandle = -1;
    dragStart = null;
    moveOrigin = null;
    if (cropRect && (cropRect.w === 0 || cropRect.h === 0)) cropRect = null;
    cropCanvas.style.cursor = "crosshair";
    drawCropCanvas();
  }

  cropCanvas.addEventListener("mouseup", endDrag);
  cropCanvas.addEventListener("mouseleave", endDrag);

  // touch equivalents
  cropCanvas.addEventListener("touchstart", (ev) => {
    ev.preventDefault();
    const pos = getPointerPos(ev);
    const hx = getHandleAtPoint(pos.x, pos.y);
    if (hx >= 0 && cropRect) {
      isDragging = true; actionMode = "resize"; activeHandle = hx; dragStart = pos; moveOrigin = { x: cropRect.x, y: cropRect.y, w: cropRect.w, h: cropRect.h }; return;
    }
    if (cropRect && pointInRect(pos.x, pos.y, cropRect)) {
      isDragging = true; actionMode = "move"; dragStart = pos; moveOrigin = { x: cropRect.x, y: cropRect.y, w: cropRect.w, h: cropRect.h }; return;
    }
    isDragging = true; actionMode = "new"; dragStart = pos; cropRect = { x: pos.x, y: pos.y, w: 0, h: 0 };
  }, { passive: false });

  cropCanvas.addEventListener("touchmove", (ev) => {
    ev.preventDefault();
    if (!isDragging) return;
    const pos = getPointerPos(ev);
    const dx = pos.x - dragStart.x;
    const dy = pos.y - dragStart.y;
    if (actionMode === "move" && moveOrigin) {
      cropRect.x = Math.round(moveOrigin.x + dx); cropRect.y = Math.round(moveOrigin.y + dy); clampRectToCanvas(cropRect);
    } else if (actionMode === "resize" && moveOrigin) {
      // reuse mouse resize logic: compute based on activeHandle
      let nx = moveOrigin.x, ny = moveOrigin.y, nw = moveOrigin.w, nh = moveOrigin.h;
      switch (activeHandle) {
        case 0: nx = Math.round(moveOrigin.x + dx); ny = Math.round(moveOrigin.y + dy); nw = Math.round(moveOrigin.w - dx); nh = Math.round(moveOrigin.h - dy); break;
        case 1: ny = Math.round(moveOrigin.y + dy); nw = Math.round(moveOrigin.w + dx); nh = Math.round(moveOrigin.h - dy); break;
        case 2: nw = Math.round(moveOrigin.w + dx); nh = Math.round(moveOrigin.h + dy); break;
        case 3: nx = Math.round(moveOrigin.x + dx); nw = Math.round(moveOrigin.w - dx); nh = Math.round(moveOrigin.h + dy); break;
      }
      if (nw < 0) { nw = Math.abs(nw); nx = nx - nw; }
      if (nh < 0) { nh = Math.abs(nh); ny = ny - nh; }
      cropRect.x = nx; cropRect.y = ny; cropRect.w = nw; cropRect.h = nh; clampRectToCanvas(cropRect);
    } else if (actionMode === "new") {
      const x0 = dragStart.x, y0 = dragStart.y; const nx = Math.min(pos.x, x0), ny = Math.min(pos.y, y0);
      const nw = Math.abs(pos.x - x0), nh = Math.abs(pos.y - y0);
      cropRect.x = nx; cropRect.y = ny; cropRect.w = nw; cropRect.h = nh; clampRectToCanvas(cropRect);
    }
    drawCropCanvas();
  }, { passive: false });

  cropCanvas.addEventListener("touchend", endDrag);

  // also listen on window so releasing outside canvas ends drag reliably
  window.addEventListener("mouseup", () => { if (isDragging) endDrag(); });
  window.addEventListener("touchend", () => { if (isDragging) endDrag(); }, { passive: true });
}

// open/close modal handlers
cropOpenBtn && cropOpenBtn.addEventListener("click", openCropModal);
cropClose && cropClose.addEventListener("click", () => cropModal.classList.add("hidden"));
cancelCropBtn && cancelCropBtn.addEventListener("click", () => cropModal.classList.add("hidden"));

// Save crop: create full-resolution crop blob and set as croppedBlob + update selected preview
saveCropBtn && saveCropBtn.addEventListener("click", async () => {
  if (!cropRect || !croppingImage) {
    alert("Please draw a crop rectangle first.");
    return;
  }
  const sx = Math.round(cropRect.x * canvasScale);
  const sy = Math.round(cropRect.y * canvasScale);
  const sw = Math.round(cropRect.w * canvasScale);
  const sh = Math.round(cropRect.h * canvasScale);
  if (sw <= 0 || sh <= 0) {
    alert("Invalid crop area.");
    return;
  }

  // draw full-resolution crop into offscreen canvas
  const tcanvas = document.createElement("canvas");
  tcanvas.width = sw;
  tcanvas.height = sh;
  const tctx = tcanvas.getContext("2d");
  // drawImage(img, sx, sy, sw, sh, 0,0, sw, sh)
  tctx.drawImage(croppingImage, sx, sy, sw, sh, 0, 0, sw, sh);

  // convert to blob (png)
  tcanvas.toBlob((blob) => {
    if (!blob) {
      alert("Failed to create cropped image.");
      return;
    }
    croppedBlob = blob;
    // update preview and filename suggestion
    const objUrl = URL.createObjectURL(blob);
    selectedPreview.src = objUrl;
    selectedPreviewContainer.classList.remove("hidden");
    const fname = (photoInput && photoInput.files && photoInput.files[0]) ? photoInput.files[0].name : "image.png";
    saveFilename.value = `cropped_${fname}`;
    cropModal.classList.add("hidden");
  }, "image/png");
});

// submit / generate handler: if croppedBlob present, use it; else prefer local file; else use selectedUploaded
form && form.addEventListener("submit", async (e) => {
  e.preventDefault();
  previewContainer.classList.add("hidden");
  startProgress();

  try {
    let res, data;
    const hasLocalFile = photoInput && photoInput.files && photoInput.files[0];
    // Priority: croppedBlob -> local file -> selectedUploaded
    if (croppedBlob) {
      const fd = new FormData();
      fd.append("photo", croppedBlob, saveFilename.value || "cropped.png");
      res = await fetch("/upload", { method: "POST", body: fd });
      data = await res.json().catch(() => ({ error: "Invalid server response" }));
    } else if (hasLocalFile) {
      const fd = new FormData();
      fd.append("photo", photoInput.files[0]);
      res = await fetch("/upload", { method: "POST", body: fd });
      data = await res.json().catch(() => ({ error: "Invalid server response" }));
    } else if (selectedUploadedInput && selectedUploadedInput.value) {
      // send JSON with selected filename (server should handle { selected: filename })
      res = await fetch("/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ selected: selectedUploadedInput.value }),
      });
      data = await res.json().catch(() => ({ error: "Invalid server response" }));
    } else {
      alert("No image selected.");
      finishProgress(false);
      return;
    }

    if (!res.ok || data.error) {
      alert(data.error || `Server error (${res.status})`);
      finishProgress(false);
      return;
    }

    previewData = data.preview;
    previewImage.src = previewData;
    previewContainer.classList.remove("hidden");
    finishProgress(true);

    // refresh gallery after upload of a new file (local upload or saved crop)
    if (!selectedUploadedInput || !selectedUploadedInput.value) {
      loadGallery().catch(() => {});
    }
  } catch (err) {
    console.error("Upload error:", err);
    alert("Network or server error");
    finishProgress(false);
  }
});

// download handler (unchanged)
downloadBtn && downloadBtn.addEventListener("click", async () => {
  if (!previewData) return;
  try {
    const res = await fetch("/download", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image: previewData }),
    });
    if (!res.ok) {
      alert("Download failed.");
      return;
    }
    const blob = await res.blob();
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "passport_4x6.jpg";
    document.body.appendChild(link);
    link.click();
    link.remove();
  } catch (err) {
    console.error("Download error:", err);
    alert("Download failed");
  }
});

// reset button clears inputs and any crop
resetBtn && resetBtn.addEventListener("click", () => {
  if (form) form.reset();
  selectedPreview.src = "";
  selectedPreviewContainer.classList.add("hidden");
  croppedBlob = null;
  previewImage.src = "";
  previewContainer.classList.add("hidden");
});

// -- Gallery loading and interaction --
async function loadGallery() {
  const thumbs = document.getElementById("thumbs");
  if (!thumbs) return;
  thumbs.innerHTML = "";
  try {
    const res = await fetch("/list_uploads");
    if (!res.ok) return;
    const data = await res.json();
    const files = data.files || [];

    // filter out non-image and hidden files (e.g. .DS_Store)
    const imageRe = /\.(jpe?g|png|gif|webp|bmp|tiff|heic)$/i;
    const images = files.filter(f =>
      typeof f === "string" &&
      f.trim() !== "" &&
      !f.startsWith(".") &&       // skip hidden files
      imageRe.test(f)             // only image extensions
    );

    if (images.length === 0) {
      thumbs.innerHTML = '<div class="text-sm text-gray-500">No uploads</div>';
      return;
    }

    images.forEach((fname) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "thumb block w-full p-0 border rounded overflow-hidden";
      btn.title = fname;
      btn.style = "background:#fff;border:1px solid rgba(0,0,0,0.06);";

      const img = document.createElement("img");
      img.src = `/uploads/${encodeURIComponent(fname)}`;
      img.alt = fname;
      img.style = "width:100%;height:72px;object-fit:cover;display:block;";
      img.loading = "lazy";

      btn.appendChild(img);
      btn.addEventListener("click", () => {
        // select this thumbnail as the source for cropping / preview / generate
        document.querySelectorAll("#thumbs .thumb.selected").forEach(el => el.classList.remove("selected"));
        btn.classList.add("selected");
        // show it in selectedPreview and clear file input
        const selectedPreviewEl = document.getElementById("selectedPreview");
        const selectedPreviewContainerEl = document.getElementById("selectedPreviewContainer");
        const photoInputEl = document.getElementById("photoInput");
        if (photoInputEl) {
          // cannot set file input.value for security reasons; just clear it
          photoInputEl.value = "";
        }
        if (selectedPreviewEl) {
          selectedPreviewEl.src = img.src;
          selectedPreviewContainerEl && selectedPreviewContainerEl.classList.remove("hidden");
        }
        // store selection for use on submit
        selectedUploaded = fname;
        if (selectedUploadedInput) selectedUploadedInput.value = fname;
        // clear any existing crop
        croppedBlob = null;
      });

      thumbs.appendChild(btn);
    });
  } catch (err) {
    console.error("Failed to load gallery:", err);
    thumbs.innerHTML = '<div class="text-sm text-red-500">Error loading</div>';
  }
}

// refresh gallery on page load and after saves/uploads
window.addEventListener("load", () => {
  loadGallery().catch(() => {});
});

// If you already call loadGallery elsewhere (e.g. after upload/save), this will still work.
