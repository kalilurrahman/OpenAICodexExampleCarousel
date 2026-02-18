const form = document.getElementById("generator-form");
const carousel = document.getElementById("carousel");
const editor = document.getElementById("editor");
const editorEmpty = document.getElementById("editorEmpty");
const progressWrap = document.getElementById("progressWrap");
const progressBar = document.getElementById("progressBar");
const progressValue = document.getElementById("progressValue");
const progressText = document.getElementById("progressText");
const generateBtn = document.getElementById("generateBtn");
const statusText = document.getElementById("statusText");

const exportPdfBtn = document.getElementById("exportPdf");
const exportCurrentImageBtn = document.getElementById("exportCurrentImage");

const editHeadline = document.getElementById("editHeadline");
const editBody = document.getElementById("editBody");
const editCta = document.getElementById("editCta");
const editImage = document.getElementById("editImage");

let slides = [];
let selectedSlideId = null;
let meta = {};

function setStatus(message, isError = false) {
  statusText.textContent = message;
  statusText.classList.toggle("error", isError);
}

function setProgress(value, text = "Generating carousel...") {
  progressWrap.classList.remove("hidden");
  const clamped = Math.max(0, Math.min(100, value));
  progressBar.style.width = `${clamped}%`;
  progressValue.textContent = `${Math.round(clamped)}%`;
  progressText.textContent = text;
}

function hideProgress() {
  progressWrap.classList.add("hidden");
}

function renderSlides() {
  carousel.innerHTML = "";

  slides.forEach((slide, index) => {
    const card = document.createElement("article");
    card.className = "slide-card";
    card.draggable = true;
    card.dataset.id = slide.id;

    if (slide.id === selectedSlideId) {
      card.classList.add("selected");
    }

    card.innerHTML = `
      <span class="slide-index">${index + 1}</span>
      <img src="${slide.imageUrl}" alt="${slide.headline}" />
      <h3>${slide.headline}</h3>
      <p>${slide.cta}</p>
    `;

    card.addEventListener("click", () => {
      selectedSlideId = slide.id;
      renderSlides();
      bindEditor();
    });

    card.addEventListener("dragstart", (event) => {
      event.dataTransfer.setData("text/plain", slide.id);
      event.dataTransfer.effectAllowed = "move";
    });

    card.addEventListener("dragover", (event) => {
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
    });

    card.addEventListener("drop", (event) => {
      event.preventDefault();
      const sourceId = event.dataTransfer.getData("text/plain");
      reorderSlides(sourceId, slide.id);
    });

    carousel.appendChild(card);
  });
}

function reorderSlides(sourceId, targetId) {
  if (!sourceId || sourceId === targetId) return;
  const sourceIndex = slides.findIndex((s) => s.id === sourceId);
  const targetIndex = slides.findIndex((s) => s.id === targetId);
  if (sourceIndex < 0 || targetIndex < 0) return;

  const [moved] = slides.splice(sourceIndex, 1);
  slides.splice(targetIndex, 0, moved);
  renderSlides();
  setStatus("Slide order updated.");
}

function bindEditor() {
  const selected = slides.find((slide) => slide.id === selectedSlideId);
  if (!selected) {
    editor.classList.add("hidden");
    editorEmpty.classList.remove("hidden");
    return;
  }

  editor.classList.remove("hidden");
  editorEmpty.classList.add("hidden");

  editHeadline.value = selected.headline;
  editBody.value = selected.body;
  editCta.value = selected.cta;
  editImage.value = selected.imageUrl;
}

document.getElementById("saveSlide").addEventListener("click", () => {
  const selected = slides.find((slide) => slide.id === selectedSlideId);
  if (!selected) return;

  const nextHeadline = editHeadline.value.trim();
  const nextBody = editBody.value.trim();
  const nextCta = editCta.value.trim();
  const nextImage = editImage.value.trim();

  if (!nextHeadline || !nextBody || !nextCta || !nextImage) {
    setStatus("All slide fields are required.", true);
    return;
  }

  selected.headline = nextHeadline;
  selected.body = nextBody;
  selected.cta = nextCta;
  selected.imageUrl = nextImage;

  renderSlides();
  setStatus("Slide saved.");
});

async function pollJob(jobId) {
  const start = Date.now();
  const timeoutMs = 15_000;

  while (Date.now() - start < timeoutMs) {
    const response = await fetch(`/api/jobs/${jobId}`);
    if (!response.ok) {
      throw new Error("Unable to fetch generation job status.");
    }

    const job = await response.json();
    setProgress(job.progress || 0, `Generating text + images (${job.status})...`);

    if (job.status === "completed") {
      return job.result;
    }

    if (job.status === "failed") {
      throw new Error(job.error || "Generation failed.");
    }

    await new Promise((resolve) => setTimeout(resolve, 350));
  }

  throw new Error("Generation timed out. Please try again.");
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  generateBtn.disabled = true;
  setStatus("Starting generation...");

  const payload = {
    topic: document.getElementById("topic").value,
    tone: document.getElementById("tone").value,
    imageStyle: document.getElementById("imageStyle").value,
    count: Number(document.getElementById("count").value)
  };

  try {
    setProgress(2, "Queueing job...");

    const response = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error || "Failed to queue generation.");
    }

    const completed = await pollJob(result.jobId);
    slides = completed.slides;
    meta = completed.meta;
    selectedSlideId = slides[0]?.id || null;

    setProgress(100, "Done");
    setTimeout(hideProgress, 600);
    renderSlides();
    bindEditor();
    setStatus(`Generated ${slides.length} slides for “${meta.topic}”.`);
  } catch (error) {
    hideProgress();
    setStatus(error.message, true);
  } finally {
    generateBtn.disabled = false;
  }
});

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

async function buildSlideCanvas(slide) {
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1080;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#0f172a";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  try {
    const image = await new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = slide.imageUrl;
    });

    ctx.globalAlpha = 0.35;
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    ctx.globalAlpha = 1;
  } catch (_err) {
    // graceful fallback if image fails to load
  }

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 54px Inter, sans-serif";
  wrapText(ctx, slide.headline, 80, 150, 920, 64);

  ctx.font = "36px Inter, sans-serif";
  wrapText(ctx, slide.body, 80, 320, 920, 48);

  ctx.fillStyle = "#a5b4fc";
  ctx.font = "bold 32px Inter, sans-serif";
  wrapText(ctx, slide.cta, 80, 940, 920, 44);

  return canvas;
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(" ");
  let line = "";

  for (let i = 0; i < words.length; i += 1) {
    const testLine = `${line}${words[i]} `;
    const width = ctx.measureText(testLine).width;

    if (width > maxWidth && i > 0) {
      ctx.fillText(line, x, y);
      line = `${words[i]} `;
      y += lineHeight;
    } else {
      line = testLine;
    }
  }

  ctx.fillText(line, x, y);
}

exportCurrentImageBtn.addEventListener("click", async () => {
  const slide = slides.find((item) => item.id === selectedSlideId);
  if (!slide) {
    setStatus("Select a slide first.", true);
    return;
  }

  const canvas = await buildSlideCanvas(slide);
  canvas.toBlob((blob) => downloadBlob(blob, `${slide.id}.png`), "image/png", 1);
  setStatus("Selected slide exported as PNG.");
});

exportPdfBtn.addEventListener("click", async () => {
  if (!slides.length) {
    setStatus("Generate slides first.", true);
    return;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: "portrait", unit: "px", format: [1080, 1080] });

  for (let i = 0; i < slides.length; i += 1) {
    const canvas = await buildSlideCanvas(slides[i]);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
    if (i > 0) doc.addPage();
    doc.addImage(dataUrl, "JPEG", 0, 0, 1080, 1080);
  }

  doc.setProperties({
    title: `${meta.topic || "AI Carousel"} Carousel`,
    subject: `Tone: ${meta.tone || "n/a"}; Style: ${meta.imageStyle || "n/a"}; Version: ${meta.version || "n/a"}`,
    author: meta.author || "Vibe Coding App",
    keywords: `carousel,ai,${meta.topic || ""}`,
    creator: "Vibe Coding App"
  });

  doc.save(`carousel-${Date.now()}.pdf`);
  setStatus("Carousel exported as PDF.");
});
